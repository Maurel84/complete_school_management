import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { recordAuditLog } from '../lib/audit';
import type { Profile } from '../types';

export interface PaymentPlanInput {
  name: string;
  total_amount: number;
  canteen_monthly: number;
  canteen_quarterly: number;
  canteen_annual: number;
  levels: string[]; // level IDs
  schedule: {
    installment_number: number;
    label: string;
    amount: number;
    due_date: string;
  }[];
  composition: {
    item_name: string;
    amount: number;
  }[];
}

export function useFinance(schoolId?: string, academicYearId?: string) {
  const queryClient = useQueryClient();

  // Fetch payment plans with their levels, schedules and compositions
  const plansQuery = useQuery({
    queryKey: ['payment_plans', schoolId, academicYearId],
    queryFn: async () => {
      if (!schoolId || !academicYearId) return [];
      const { data, error } = await supabase
        .from('payment_plans')
        .select(`
          *,
          levels:payment_plan_levels(level_id),
          schedule:payment_schedule_templates(*),
          composition:payment_plan_compositions(*)
        `)
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYearId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!academicYearId,
  });

  // Fetch all student fee assignments
  const studentFeesQuery = useQuery({
    queryKey: ['student_fees', schoolId, academicYearId],
    queryFn: async () => {
      if (!schoolId || !academicYearId) return [];
      const { data, error } = await supabase
        .from('student_fees')
        .select(`
          *,
          student:students(id, first_name, last_name, matricule, class_id, class:classes(id, name, level_id)),
          plan:payment_plans(*)
        `);

      if (error) throw error;

      // Filter by school_id in students to bypass missing joins filter
      const filtered = (data || []).filter(
        (sf: any) => sf.student && sf.student.class
      );
      return filtered;
    },
    enabled: !!schoolId && !!academicYearId,
  });

  // Fetch all installments for all students (to compute debts in the dashboard)
  const studentInstallmentsQuery = useQuery({
    queryKey: ['student_installments_all', schoolId, academicYearId],
    queryFn: async () => {
      if (!schoolId || !academicYearId) return [];
      const { data, error } = await supabase
        .from('student_installments')
        .select(`
          *,
          student:students(id, school_id, first_name, last_name, class_id, class:classes(name))
        `);

      if (error) throw error;
      return (data || []).filter((si: any) => si.student && si.student.school_id === schoolId);
    },
    enabled: !!schoolId && !!academicYearId,
  });

  // Fetch all canteen payments
  const canteenPaymentsQuery = useQuery({
    queryKey: ['canteen_payments', schoolId, academicYearId],
    queryFn: async () => {
      if (!schoolId || !academicYearId) return [];
      const { data, error } = await supabase
        .from('canteen_payments')
        .select('*, student:students(first_name, last_name, matricule, class:classes(name)), processor:profiles(first_name, last_name)')
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYearId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!academicYearId,
  });

  // Save/Update Admin Configuration Plan
  const savePlanMutation = useMutation({
    mutationFn: async ({
      plan,
      planId,
      profile,
    }: {
      plan: PaymentPlanInput;
      planId?: string;
      profile?: Profile | null;
    }) => {
      if (!schoolId || !academicYearId) throw new Error('Missing school or year context');

      const planPayload = {
        school_id: schoolId,
        academic_year_id: academicYearId,
        name: plan.name,
        total_amount: plan.total_amount,
        canteen_monthly: plan.canteen_monthly,
        canteen_quarterly: plan.canteen_quarterly,
        canteen_annual: plan.canteen_annual,
      };

      let activePlanId = planId;

      if (planId) {
        // Update plan
        const { error } = await supabase.from('payment_plans').update(planPayload).eq('id', planId);
        if (error) throw error;
      } else {
        // Create plan
        const { data, error } = await supabase.from('payment_plans').insert(planPayload).select('id').single();
        if (error) throw error;
        activePlanId = data.id;
      }

      if (!activePlanId) throw new Error('Failed to resolve Plan ID');

      // Clear existing levels, schedule and compositions
      await supabase.from('payment_plan_levels').delete().eq('plan_id', activePlanId);
      await supabase.from('payment_schedule_templates').delete().eq('plan_id', activePlanId);
      await supabase.from('payment_plan_compositions').delete().eq('plan_id', activePlanId);

      // Insert new levels
      if (plan.levels.length > 0) {
        const { error } = await supabase.from('payment_plan_levels').insert(
          plan.levels.map(levelId => ({ plan_id: activePlanId, level_id: levelId }))
        );
        if (error) throw error;
      }

      // Insert schedules
      if (plan.schedule.length > 0) {
        const { error } = await supabase.from('payment_schedule_templates').insert(
          plan.schedule.map(s => ({
            plan_id: activePlanId,
            installment_number: s.installment_number,
            label: s.label,
            amount: s.amount,
            due_date: s.due_date,
          }))
        );
        if (error) throw error;
      }

      // Insert compositions
      if (plan.composition.length > 0) {
        const { error } = await supabase.from('payment_plan_compositions').insert(
          plan.composition.map(c => ({
            plan_id: activePlanId,
            item_name: c.item_name,
            amount: c.amount,
          }))
        );
        if (error) throw error;
      }

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: planId ? 'payment_plan_updated' : 'payment_plan_created',
        entityType: 'payment_plan',
        entityId: activePlanId,
        details: { name: plan.name },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment_plans', schoolId, academicYearId] });
      void queryClient.invalidateQueries({ queryKey: ['student_fees', schoolId, academicYearId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, academicYearId] });
    },
  });

  // Assign Student to plan
  const assignStudentPlanMutation = useMutation({
    mutationFn: async ({
      studentId,
      planId,
      canteenOption,
      discountAmount,
      profile,
    }: {
      studentId: string;
      planId: string;
      canteenOption: string;
      discountAmount: number;
      profile?: Profile | null;
    }) => {
      if (!schoolId) throw new Error('Missing school ID');

      const { data, error } = await supabase
        .from('student_fees')
        .upsert({
          student_id: studentId,
          plan_id: planId,
          canteen_option: canteenOption,
          discount_amount: discountAmount,
        })
        .select()
        .single();

      if (error) throw error;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'student_plan_assigned',
        entityType: 'student_fees',
        entityId: data.id,
        details: { student_id: studentId, plan_id: planId },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student_fees', schoolId, academicYearId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, academicYearId] });
    },
  });

  // Save tuition payment with details and receipt metadata
  const saveDetailedPaymentMutation = useMutation({
    mutationFn: async ({
      paymentData,
      details,
      profile,
      qrHash,
      digitalSig,
    }: {
      paymentData: any;
      details: { item_name: string; amount: number }[];
      profile?: Profile | null;
      qrHash: string;
      digitalSig: string;
    }) => {
      if (!schoolId || !academicYearId) throw new Error('Missing school or year context');

      const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert({
          ...paymentData,
          school_id: schoolId,
          academic_year_id: academicYearId,
          processed_by: profile?.id,
        })
        .select()
        .single();

      if (payError) throw payError;

      // Insert details (compositions)
      if (details.length > 0) {
        const { error: detError } = await supabase.from('payment_details').insert(
          details.map(d => ({
            payment_id: payment.id,
            item_name: d.item_name,
            amount: d.amount,
          }))
        );
        if (detError) throw detError;
      }

      // Insert receipt metadata
      const { error: recError } = await supabase.from('receipts').insert({
        payment_id: payment.id,
        receipt_number: payment.receipt_number,
        qr_code_hash: qrHash,
        digital_signature: digitalSig,
      });

      if (recError) throw recError;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'payment_tuition_created_detailed',
        entityType: 'payment',
        entityId: payment.id,
        details: { receipt_number: payment.receipt_number, amount: payment.amount },
      });

      return payment;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, academicYearId] });
    },
  });

  // Save canteen payment
  const saveCanteenPaymentMutation = useMutation({
    mutationFn: async ({
      canteenData,
      profile,
      qrHash,
      digitalSig,
    }: {
      canteenData: any;
      profile?: Profile | null;
      qrHash: string;
      digitalSig: string;
    }) => {
      if (!schoolId || !academicYearId) throw new Error('Missing school or year context');

      const { data: cp, error: cpError } = await supabase
        .from('canteen_payments')
        .insert({
          ...canteenData,
          school_id: schoolId,
          academic_year_id: academicYearId,
          processed_by: profile?.id,
        })
        .select()
        .single();

      if (cpError) throw cpError;

      // Insert receipt metadata
      const { error: recError } = await supabase.from('receipts').insert({
        canteen_payment_id: cp.id,
        receipt_number: cp.receipt_number,
        qr_code_hash: qrHash,
        digital_signature: digitalSig,
      });

      if (recError) throw recError;

      await recordAuditLog({
        schoolId,
        userId: profile?.id,
        action: 'payment_canteen_created',
        entityType: 'canteen_payment',
        entityId: cp.id,
        details: { receipt_number: cp.receipt_number, amount: cp.amount },
      });

      return cp;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canteen_payments', schoolId, academicYearId] });
    },
  });

  return {
    plansQuery,
    studentFeesQuery,
    studentInstallmentsQuery,
    canteenPaymentsQuery,
    savePlan: savePlanMutation.mutateAsync,
    isSavingPlan: savePlanMutation.isPending,
    assignStudentPlan: assignStudentPlanMutation.mutateAsync,
    isAssigningPlan: assignStudentPlanMutation.isPending,
    saveDetailedPayment: saveDetailedPaymentMutation.mutateAsync,
    isSavingDetailedPayment: saveDetailedPaymentMutation.isPending,
    saveCanteenPayment: saveCanteenPaymentMutation.mutateAsync,
    isSavingCanteenPayment: saveCanteenPaymentMutation.isPending,
  };
}

export function useReceipts(paymentId?: string, canteenPaymentId?: string) {
  return useQuery({
    queryKey: ['receipt_metadata', paymentId, canteenPaymentId],
    queryFn: async () => {
      if (!paymentId && !canteenPaymentId) return null;
      let query = supabase.from('receipts').select('*');
      if (paymentId) query = query.eq('payment_id', paymentId);
      else query = query.eq('canteen_payment_id', canteenPaymentId);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!paymentId || !!canteenPaymentId,
  });
}

export function usePaymentDetails(paymentId?: string) {
  return useQuery({
    queryKey: ['payment_details', paymentId],
    queryFn: async () => {
      if (!paymentId) return [];
      const { data, error } = await supabase
        .from('payment_details')
        .select('*')
        .eq('payment_id', paymentId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!paymentId,
  });
}
