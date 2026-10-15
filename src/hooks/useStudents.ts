import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { recordAuditLog } from '../lib/audit';
import { generateMatricule } from '../lib/utils';
import type { Student, StudentParent, Profile } from '../types';
import { resolveStudentFinance } from '../lib/financePlanResolver';

export interface StudentFormInput {
  matricule?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  birth_place: string;
  nationality: string;
  photo_url: string;
  address: string;
  phone: string;
  email: string;
  class_id: string;
  status: string;
  medical_info: string;
  previous_school: string;
  parent_mode?: 'existing' | 'new' | 'none';
  selected_parent_id?: string;
  relationship?: string;
  new_parent_first_name?: string;
  new_parent_last_name?: string;
  new_parent_phone?: string;
  new_parent_email?: string;
  new_parent_profession?: string;
}

export interface FamilyLinkInput {
  parent_id: string;
  relationship: string;
  is_primary: boolean;
  is_billing_contact: boolean;
  is_pickup_authorized: boolean;
  emergency_priority: number;
  notes: string;
}

export function useStudents(schoolId?: string) {
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: ['students', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];

      const [studentsRes, plansRes, paymentsRes, canteenPaymentsRes, classesRes] = await Promise.all([
        supabase
          .from('students')
          .select(`
            *,
            class:classes(id, name, level_id),
            student_parents(parent_id, relationship, is_primary, is_billing_contact, parent:parents(*)),
            student_fees(discount_amount, canteen_option, plan:payment_plans(*))
          `)
          .eq('school_id', schoolId)
          .order('last_name'),
        supabase
          .from('payment_plans')
          .select(`
            *,
            levels:payment_plan_levels(level_id),
            schedule:payment_schedule_templates(*),
            composition:payment_plan_compositions(*)
          `)
          .eq('school_id', schoolId),
        supabase
          .from('payments')
          .select('id, student_id, receipt_number, payment_date, payment_method, amount, status, notes')
          .eq('school_id', schoolId)
          .order('payment_date', { ascending: false }),
        supabase
          .from('canteen_payments')
          .select('id, student_id, receipt_number, payment_date, payment_method, amount, trimester, notes')
          .eq('school_id', schoolId)
          .order('payment_date', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name, level_id')
          .eq('school_id', schoolId),
      ]);

      if (studentsRes.error) throw studentsRes.error;

      const plans = plansRes.data || [];
      const classes = classesRes.data || [];

      // Group payments by student
      const paymentsByStudent: Record<string, any[]> = {};
      (paymentsRes.data || []).forEach(p => {
        if (!paymentsByStudent[p.student_id]) paymentsByStudent[p.student_id] = [];
        paymentsByStudent[p.student_id].push(p);
      });

      const canteenByStudent: Record<string, any[]> = {};
      (canteenPaymentsRes.data || []).forEach(cp => {
        if (!canteenByStudent[cp.student_id]) canteenByStudent[cp.student_id] = [];
        canteenByStudent[cp.student_id].push(cp);
      });

      return (studentsRes.data || []).map(student => {
        const studentFees = student.student_fees
          ? (Array.isArray(student.student_fees) ? student.student_fees : [student.student_fees])
          : [];

        const tuitionPayments = paymentsByStudent[student.id] || [];
        const canteenPayments = canteenByStudent[student.id] || [];

        const finance = resolveStudentFinance({
          student,
          plans,
          studentFees,
          tuitionPayments,
          canteenPayments,
          classes,
        });

        return {
          ...student,
          family_count: student.student_parents?.length || 0,
          parents: student.student_parents || [],
          payments: tuitionPayments,
          canteen_payments: canteenPayments,
          financial_plan_name: finance.planName,
          financial_expected: finance.totalExpected,
          financial_paid: finance.totalPaid,
          financial_remaining: finance.remaining,
          financial_tuition_expected: finance.totalExpectedTuition,
          financial_tuition_paid: finance.paidTuition,
          financial_canteen_paid: finance.paidCanteen,
          financial_schedule: finance.schedule,
          financial_status: finance.status,
          financial_has_plan: true,
          finance,
        };
      });
    },
    enabled: !!schoolId,
  });

  const saveStudentMutation = useMutation({
    mutationFn: async ({
      form,
      studentId,
      profile,
      studentCount,
    }: {
      form: StudentFormInput;
      studentId?: string;
      profile?: Profile | null;
      studentCount: number;
    }) => {
      if (!schoolId) throw new Error('School ID is required');

      const {
        parent_mode,
        selected_parent_id,
        relationship,
        new_parent_first_name,
        new_parent_last_name,
        new_parent_phone,
        new_parent_email,
        new_parent_profession,
        ...studentFields
      } = form;

      const cleanedForm: any = {
        ...studentFields,
        class_id: studentFields.class_id || null,
        date_of_birth: studentFields.date_of_birth || null,
        email: studentFields.email || null,
        phone: studentFields.phone || null,
      };

      if (studentFields.matricule !== undefined && studentFields.matricule.trim() !== '') {
        cleanedForm.matricule = studentFields.matricule.trim();
      }

      let savedStudent: any;

      if (studentId) {
        // Update
        const { data, error } = await supabase
          .from('students')
          .update(cleanedForm)
          .eq('id', studentId)
          .select()
          .single();

        if (error) throw error;
        savedStudent = data;

        await recordAuditLog({
          schoolId,
          userId: profile?.id,
          action: 'student_updated',
          entityType: 'student',
          entityId: studentId,
          details: { matricule: (data as Student).matricule },
        });
      } else {
        // Insert
        const count = studentCount + 1;
        const matricule = studentFields.matricule?.trim() || generateMatricule('ELV', count);
        const { data, error } = await supabase
          .from('students')
          .insert({ ...cleanedForm, school_id: schoolId, matricule })
          .select()
          .single();

        if (error) throw error;
        savedStudent = data;

        await recordAuditLog({
          schoolId,
          userId: profile?.id,
          action: 'student_created',
          entityType: 'student',
          entityId: (data as Student).id,
          details: { matricule },
        });
      }

      // Handle Parent Linking
      if (savedStudent && parent_mode && parent_mode !== 'none') {
        let parentIdToLink = selected_parent_id;

        if (parent_mode === 'new' && new_parent_first_name?.trim() && new_parent_last_name?.trim()) {
          const { data: newParent, error: pErr } = await supabase
            .from('parents')
            .insert({
              school_id: schoolId,
              first_name: new_parent_first_name.trim(),
              last_name: new_parent_last_name.trim(),
              phone: new_parent_phone?.trim() || '',
              email: new_parent_email?.trim() || '',
              profession: new_parent_profession?.trim() || '',
            })
            .select()
            .single();

          if (!pErr && newParent) {
            parentIdToLink = newParent.id;
          }
        }

        if (parentIdToLink) {
          const { data: existingLinks } = await supabase
            .from('student_parents')
            .select('id')
            .eq('student_id', savedStudent.id)
            .eq('parent_id', parentIdToLink);

          if (!existingLinks || existingLinks.length === 0) {
            await supabase.from('student_parents').insert({
              student_id: savedStudent.id,
              parent_id: parentIdToLink,
              relationship: relationship || 'Père/Mère',
              is_primary: true,
              is_billing_contact: true,
              emergency_priority: 1,
            });
          }
        }
      }

      return savedStudent;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['parents', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_family_links'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });

  const archiveStudentMutation = useMutation({
    mutationFn: async ({ id, profile }: { id: string; profile?: Profile | null }) => {
      if (!schoolId) throw new Error('School ID is required');

      const { error } = await supabase
        .from('students')
        .update({ status: 'transferred' })
        .eq('id', id);

      if (error) throw error;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_archived',
        entityType: 'student',
        entityId: id,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });

  const reactivateStudentMutation = useMutation({
    mutationFn: async ({ id, profile }: { id: string; profile?: Profile | null }) => {
      if (!schoolId) throw new Error('School ID is required');

      const { error } = await supabase
        .from('students')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_reactivated',
        entityType: 'student',
        entityId: id,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });

  const updateMatriculeMutation = useMutation({
    mutationFn: async ({
      studentId,
      newMatricule,
      profile,
    }: {
      studentId: string;
      newMatricule: string;
      profile?: Profile | null;
    }) => {
      if (!schoolId) throw new Error('School ID is required');
      const cleanMatricule = newMatricule.trim();
      if (!cleanMatricule) throw new Error('Le numéro matricule ne peut pas être vide');

      const { data, error } = await supabase
        .from('students')
        .update({ matricule: cleanMatricule })
        .eq('id', studentId)
        .select()
        .single();

      if (error) throw error;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_matricule_updated',
        entityType: 'student',
        entityId: studentId,
        details: { new_matricule: cleanMatricule },
      });

      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });

  return {
    studentsQuery,
    saveStudent: saveStudentMutation.mutateAsync,
    isSaving: saveStudentMutation.isPending,
    archiveStudent: archiveStudentMutation.mutateAsync,
    isArchiving: archiveStudentMutation.isPending,
    reactivateStudent: reactivateStudentMutation.mutateAsync,
    isReactivating: reactivateStudentMutation.isPending,
    updateMatricule: updateMatriculeMutation.mutateAsync,
    isUpdatingMatricule: updateMatriculeMutation.isPending,
  };
}

export function useStudentFamilyLinks(studentId?: string, schoolId?: string) {
  const queryClient = useQueryClient();

  const familyLinksQuery = useQuery({
    queryKey: ['student_family_links', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('student_parents')
        .select('*, parent:parents(*)')
        .eq('student_id', studentId)
        .order('emergency_priority', { ascending: true });

      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!studentId,
  });

  const saveFamilyLinksMutation = useMutation({
    mutationFn: async ({
      familyLinks,
      linkForm,
      profile,
    }: {
      familyLinks: any[];
      linkForm: FamilyLinkInput;
      profile?: Profile | null;
    }) => {
      if (!studentId || !schoolId) throw new Error('Missing studentId or schoolId');

      const draftWillBeInserted = Boolean(linkForm.parent_id);
      const effectiveLinks = [
        ...familyLinks.map(link => ({
          id: link.id,
          parent_id: link.parent_id,
          relationship: link.relationship,
          is_primary: link.is_primary,
          is_billing_contact: link.is_billing_contact,
          is_pickup_authorized: link.is_pickup_authorized,
          emergency_priority: link.emergency_priority,
          notes: link.notes || '',
        })),
        ...(draftWillBeInserted
          ? [
              {
                id: `draft-${linkForm.parent_id}`,
                parent_id: linkForm.parent_id,
                relationship: linkForm.relationship,
                is_primary: linkForm.is_primary,
                is_billing_contact: linkForm.is_billing_contact,
                is_pickup_authorized: linkForm.is_pickup_authorized,
                emergency_priority: linkForm.emergency_priority,
                notes: linkForm.notes,
              },
            ]
          : []),
      ];

      const primaryParentId = effectiveLinks.find(link => link.is_primary)?.parent_id || null;
      const billingParentId = effectiveLinks.find(link => link.is_billing_contact)?.parent_id || primaryParentId;

      for (const link of familyLinks) {
        const { error } = await supabase
          .from('student_parents')
          .update({
            relationship: link.relationship,
            is_primary: primaryParentId === link.parent_id,
            is_billing_contact: billingParentId === link.parent_id,
            is_pickup_authorized: link.is_pickup_authorized,
            emergency_priority: Number(link.emergency_priority) || 1,
            notes: link.notes || '',
          })
          .eq('id', link.id);
        if (error) throw error;
      }

      if (draftWillBeInserted) {
        const { error } = await supabase.from('student_parents').insert({
          student_id: studentId,
          parent_id: linkForm.parent_id,
          relationship: linkForm.relationship,
          is_primary: primaryParentId === linkForm.parent_id,
          is_billing_contact: billingParentId === linkForm.parent_id,
          is_pickup_authorized: linkForm.is_pickup_authorized,
          emergency_priority: Number(linkForm.emergency_priority) || 1,
          notes: linkForm.notes,
        });
        if (error) throw error;
      }

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_family_links_saved',
        entityType: 'student',
        entityId: studentId,
        details: { linkedParents: effectiveLinks.length },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student_family_links', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['parents', schoolId] });
    },
  });

  const removeFamilyLinkMutation = useMutation({
    mutationFn: async ({ linkId, profile }: { linkId: string; profile?: Profile | null }) => {
      if (!schoolId || !studentId) throw new Error('Missing schoolId or studentId');

      const { error } = await supabase.from('student_parents').delete().eq('id', linkId);
      if (error) throw error;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_parent_detached',
        entityType: 'student',
        entityId: studentId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student_family_links', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['parents', schoolId] });
    },
  });

  return {
    familyLinksQuery,
    saveFamilyLinks: saveFamilyLinksMutation.mutateAsync,
    isSavingLinks: saveFamilyLinksMutation.isPending,
    removeFamilyLink: removeFamilyLinkMutation.mutateAsync,
    isRemovingLink: removeFamilyLinkMutation.isPending,
  };
}
