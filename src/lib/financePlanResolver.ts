/**
 * Finance Plan Resolver for Complete School Management SaaS
 * 
 * Accurately determines the financial plan, annual tuition, canteen rates,
 * payment schedule (tranches), and balance (paid vs remaining) for any student.
 * 
 * Works seamlessly whether a student has an explicit entry in `student_fees`
 * or relies on the class/level payment plan configured in "Tarif & Configuration".
 */

export interface ScheduleItem {
  installment_number: number;
  label: string;
  amount: number;
  due_date: string;
}

export interface CompositionItem {
  item_name: string;
  amount: number;
}

export interface ResolvedStudentFinance {
  planId?: string;
  planName: string;
  className: string;
  totalTuition: number;
  discount: number;
  canteenOption: string;
  canteenMonthly: number;
  canteenQuarterly: number;
  canteenAnnual: number;
  totalExpectedTuition: number;
  totalExpectedCanteen: number;
  totalExpected: number;
  paidTuition: number;
  paidCanteen: number;
  totalPaid: number;
  remaining: number;
  delayAmount: number;
  schedule: ScheduleItem[];
  composition: CompositionItem[];
  status: 'paid' | 'partial' | 'unpaid' | 'not_configured';
}

export const DEFAULT_MATERNELLE_CONFIG = {
  name: 'Maternelle',
  total_amount: 110000,
  canteen_monthly: 7000,
  canteen_quarterly: 21000,
  canteen_annual: 56000,
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 30000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Fournitures scolaires', amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 10000 },
    { item_name: 'Tenue de sport', amount: 7000 },
    { item_name: 'Macaron', amount: 3000 },
  ],
};

export const DEFAULT_PRIMAIRE_CONFIG = {
  name: 'Primaire (CP1 à CM1)',
  total_amount: 105000,
  canteen_monthly: 8000,
  canteen_quarterly: 24000,
  canteen_annual: 64000,
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 25000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 15000 },
    { item_name: 'Tenue de sport', amount: 15000 },
    { item_name: 'Macaron', amount: 5000 },
  ],
};

export const DEFAULT_CM2_CONFIG = {
  name: 'CM2',
  total_amount: 110000,
  canteen_monthly: 8000,
  canteen_quarterly: 24000,
  canteen_annual: 64000,
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 30000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 15000 },
    { item_name: 'Tenue de sport', amount: 15000 },
    { item_name: 'Macaron', amount: 5000 },
    { item_name: "Droit d'examen", amount: 3000 },
  ],
};

/**
 * Resolves the financial configuration and debt status for a student.
 */
export function resolveStudentFinance({
  student,
  plans = [],
  studentFees = [],
  studentInstallments = [],
  tuitionPayments = [],
  canteenPayments = [],
  classes = [],
}: {
  student: any;
  plans?: any[];
  studentFees?: any[];
  studentInstallments?: any[];
  tuitionPayments?: any[];
  canteenPayments?: any[];
  classes?: any[];
}): ResolvedStudentFinance {
  const studentId = student?.id;
  const today = new Date().toISOString().split('T')[0];

  // 1. Resolve student's class and level
  const studentClassId = student?.class_id || student?.class?.id;
  const cls = (classes || []).find((c: any) => c.id === studentClassId) || student?.class;
  const className = (cls?.name || '').trim();
  const lowerClassName = className.toLowerCase();
  const levelId = cls?.level_id;

  // 2. Check if student has explicit fee assignment
  const feeLink = (studentFees || []).find((sf: any) => sf.student_id === studentId);
  let resolvedPlan: any = null;
  let canteenOption = feeLink?.canteen_option || 'none';
  let discount = Number(feeLink?.discount_amount || 0);

  if (feeLink?.plan_id) {
    resolvedPlan = (plans || []).find((p: any) => p.id === feeLink.plan_id) || feeLink.plan;
  }

  // 3. If no plan resolved via student_fees, match via class or level
  if (!resolvedPlan || Number(resolvedPlan.total_amount || 0) === 0) {
    // 3a. Match by level ID
    if (levelId && plans && plans.length > 0) {
      resolvedPlan = plans.find((p: any) =>
        p.levels?.some((l: any) => (l.level_id || l?.id || l) === levelId)
      );
    }

    // 3b. Match by class name keyword
    if (!resolvedPlan && plans && plans.length > 0) {
      if (
        lowerClassName.includes('maternelle') ||
        lowerClassName.includes('petite') ||
        lowerClassName.includes('moyenne') ||
        lowerClassName.includes('grande') ||
        lowerClassName.includes('creche') ||
        lowerClassName.includes('crèche') ||
        lowerClassName.includes('garderie') ||
        lowerClassName.includes('ps') ||
        lowerClassName.includes('ms') ||
        lowerClassName.includes('gs')
      ) {
        resolvedPlan = plans.find((p: any) => p.name?.toLowerCase().includes('maternelle'));
      } else if (lowerClassName.includes('cm2')) {
        resolvedPlan = plans.find((p: any) => p.name?.toLowerCase().includes('cm2'));
      } else if (
        lowerClassName.includes('cp') ||
        lowerClassName.includes('ce') ||
        lowerClassName.includes('cm1') ||
        lowerClassName.includes('primaire')
      ) {
        resolvedPlan = plans.find(
          (p: any) =>
            p.name?.toLowerCase().includes('primaire') || p.name?.toLowerCase().includes('cp1')
        );
      }
    }
  }

  // 4. Default configuration fallback if DB plan is not present
  let planName = resolvedPlan?.name || '';
  let totalTuition = Number(resolvedPlan?.total_amount || 0);
  let canteenMonthly = Number(resolvedPlan?.canteen_monthly || 0);
  let canteenQuarterly = Number(resolvedPlan?.canteen_quarterly || 0);
  let canteenAnnual = Number(resolvedPlan?.canteen_annual || 0);
  let schedule: ScheduleItem[] = resolvedPlan?.schedule || [];
  let composition: CompositionItem[] = resolvedPlan?.composition || [];

  if (totalTuition === 0) {
    if (
      lowerClassName.includes('maternelle') ||
      lowerClassName.includes('petite') ||
      lowerClassName.includes('moyenne') ||
      lowerClassName.includes('grande') ||
      lowerClassName.includes('creche') ||
      lowerClassName.includes('crèche') ||
      lowerClassName.includes('garderie') ||
      lowerClassName.includes('ps') ||
      lowerClassName.includes('ms') ||
      lowerClassName.includes('gs')
    ) {
      planName = DEFAULT_MATERNELLE_CONFIG.name;
      totalTuition = DEFAULT_MATERNELLE_CONFIG.total_amount;
      canteenMonthly = DEFAULT_MATERNELLE_CONFIG.canteen_monthly;
      canteenQuarterly = DEFAULT_MATERNELLE_CONFIG.canteen_quarterly;
      canteenAnnual = DEFAULT_MATERNELLE_CONFIG.canteen_annual;
      schedule = DEFAULT_MATERNELLE_CONFIG.schedule;
      composition = DEFAULT_MATERNELLE_CONFIG.composition;
    } else if (lowerClassName.includes('cm2')) {
      planName = DEFAULT_CM2_CONFIG.name;
      totalTuition = DEFAULT_CM2_CONFIG.total_amount;
      canteenMonthly = DEFAULT_CM2_CONFIG.canteen_monthly;
      canteenQuarterly = DEFAULT_CM2_CONFIG.canteen_quarterly;
      canteenAnnual = DEFAULT_CM2_CONFIG.canteen_annual;
      schedule = DEFAULT_CM2_CONFIG.schedule;
      composition = DEFAULT_CM2_CONFIG.composition;
    } else {
      // Default to Primaire (CP1 - CM1)
      planName = DEFAULT_PRIMAIRE_CONFIG.name;
      totalTuition = DEFAULT_PRIMAIRE_CONFIG.total_amount;
      canteenMonthly = DEFAULT_PRIMAIRE_CONFIG.canteen_monthly;
      canteenQuarterly = DEFAULT_PRIMAIRE_CONFIG.canteen_quarterly;
      canteenAnnual = DEFAULT_PRIMAIRE_CONFIG.canteen_annual;
      schedule = DEFAULT_PRIMAIRE_CONFIG.schedule;
      composition = DEFAULT_PRIMAIRE_CONFIG.composition;
    }
  }

  // 5. Compute payments made
  const paidTuition = (tuitionPayments || [])
    .filter((p: any) => p.student_id === studentId && p.status !== 'cancelled')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const paidCanteen = (canteenPayments || [])
    .filter((p: any) => p.student_id === studentId)
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  // 6. If student has payments for canteen, ensure canteenOption reflects it
  if (paidCanteen > 0 && canteenOption === 'none') {
    canteenOption = 'quarterly';
  }

  const totalExpectedTuition = Math.max(0, totalTuition - discount);
  const totalExpectedCanteen = canteenOption === 'none' ? 0 : canteenQuarterly * 3;
  const totalExpected = totalExpectedTuition + totalExpectedCanteen;
  const totalPaid = paidTuition + paidCanteen;
  const remaining = Math.max(0, totalExpected - totalPaid);

  // 7. Installments for student
  const explicitInstallments = (studentInstallments || [])
    .filter((si: any) => si.student_id === studentId)
    .sort((a: any, b: any) => a.installment_number - b.installment_number);

  const finalSchedule: ScheduleItem[] =
    explicitInstallments.length > 0
      ? explicitInstallments.map((inst: any) => ({
          installment_number: inst.installment_number,
          label: inst.label || `Tranche ${inst.installment_number}`,
          amount: Number(inst.amount),
          due_date: inst.due_date,
        }))
      : schedule.slice().sort((a, b) => a.installment_number - b.installment_number);

  // 8. Compute delay (retard exigible)
  let totalDueToday = 0;
  finalSchedule.forEach(inst => {
    if (inst.due_date <= today) {
      totalDueToday += Number(inst.amount);
    }
  });

  const adjustedDueToday = Math.max(0, totalDueToday - discount);
  const isLate = paidTuition < adjustedDueToday;
  const delayAmount = isLate ? adjustedDueToday - paidTuition : 0;

  // 9. Payment status
  let status: 'paid' | 'partial' | 'unpaid' | 'not_configured' = 'unpaid';
  if (totalExpected === 0) {
    status = 'not_configured';
  } else if (remaining === 0) {
    status = 'paid';
  } else if (totalPaid > 0) {
    status = 'partial';
  }

  return {
    planId: resolvedPlan?.id,
    planName,
    className: className || 'Non assigné',
    totalTuition,
    discount,
    canteenOption,
    canteenMonthly,
    canteenQuarterly,
    canteenAnnual,
    totalExpectedTuition,
    totalExpectedCanteen,
    totalExpected,
    paidTuition,
    paidCanteen,
    totalPaid,
    remaining,
    delayAmount,
    schedule: finalSchedule,
    composition,
    status,
  };
}
