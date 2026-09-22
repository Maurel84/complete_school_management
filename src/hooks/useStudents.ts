import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { recordAuditLog } from '../lib/audit';
import { generateMatricule } from '../lib/utils';
import type { Student, StudentParent, Profile } from '../types';

export interface StudentFormInput {
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
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          student_parents(parent_id),
          student_fees(discount_amount, canteen_option, plan:payment_plans(total_amount, canteen_quarterly)),
          payments(amount, status),
          canteen_payments(amount)
        `)
        .eq('school_id', schoolId)
        .order('last_name');

      if (error) throw error;

      return (data || []).map(student => {
        const planLink = Array.isArray(student.student_fees)
          ? student.student_fees[0]
          : (student.student_fees as any);

        const basePlanAmount = Number(planLink?.plan?.total_amount || 0);
        const discount = Number(planLink?.discount_amount || 0);
        const canteenOption = planLink?.canteen_option || 'none';
        const canteenRate = canteenOption === 'none' ? 0 : Number(planLink?.plan?.canteen_quarterly || 0) * 3;
        
        const expected = Math.max(0, basePlanAmount - discount) + canteenRate;
        
        const paidTuition = (student.payments || [])
          .filter((p: any) => p.status === 'paid')
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          
        const paidCanteen = (student.canteen_payments || [])
          .reduce((sum: number, cp: any) => sum + Number(cp.amount), 0);
          
        const paid = paidTuition + paidCanteen;
        const remaining = Math.max(0, expected - paid);

        return {
          ...student,
          family_count: student.student_parents?.length || 0,
          financial_expected: expected,
          financial_paid: paid,
          financial_remaining: remaining,
          financial_has_plan: !!planLink,
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

      const cleanedForm = {
        ...studentFields,
        class_id: studentFields.class_id || null,
        date_of_birth: studentFields.date_of_birth || null,
        email: studentFields.email || null,
        phone: studentFields.phone || null,
      };

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
        const matricule = generateMatricule('ELV', count);
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
    },
  });

  return {
    studentsQuery,
    saveStudent: saveStudentMutation.mutateAsync,
    isSaving: saveStudentMutation.isPending,
    archiveStudent: archiveStudentMutation.mutateAsync,
    isArchiving: archiveStudentMutation.isPending,
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
