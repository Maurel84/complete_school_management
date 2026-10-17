import { supabase } from './supabase';
import {
  PRIMARY_LEVEL_PRESETS,
  PRIMARY_SUBJECT_PRESETS,
  PRIMARY_FEE_TYPE_PRESETS,
  generateMatricule,
  generateReceiptNumber,
} from './utils';

export interface InitializationResult {
  levelsCount: number;
  classesCount: number;
  subjectsCount: number;
  academicYearName: string;
  plansCount: number;
  studentsCount: number;
}

export async function initializeSchoolFullStructure(
  schoolId: string,
  options: { withSampleData?: boolean } = { withSampleData: true },
): Promise<InitializationResult> {
  const result: InitializationResult = {
    levelsCount: 0,
    classesCount: 0,
    subjectsCount: 0,
    academicYearName: '',
    plansCount: 0,
    studentsCount: 0,
  };

  // 1. ENSURE ACTIVE ACADEMIC YEAR
  let activeYearId = '';
  const { data: existingYears } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });

  if (existingYears && existingYears.length > 0) {
    const active = existingYears.find(y => y.active) || existingYears[0];
    activeYearId = active.id;
    result.academicYearName = active.name;
  } else {
    const { data: newYear, error: yrErr } = await supabase
      .from('academic_years')
      .insert({
        school_id: schoolId,
        name: '2026-2027',
        start_date: '2026-09-15',
        end_date: '2027-06-30',
        active: true,
      })
      .select()
      .single();

    if (!yrErr && newYear) {
      activeYearId = newYear.id;
      result.academicYearName = newYear.name;
    }
  }

  // 2. ENSURE LEVELS (PS à CM2)
  const { data: existingLevels } = await supabase
    .from('levels')
    .select('*')
    .eq('school_id', schoolId);

  const existingLevelNames = new Set((existingLevels || []).map(l => l.name.toLowerCase()));
  const levelsToInsert = PRIMARY_LEVEL_PRESETS.filter(l => !existingLevelNames.has(l.name.toLowerCase()))
    .map(l => ({ ...l, school_id: schoolId }));

  if (levelsToInsert.length > 0) {
    await supabase.from('levels').insert(levelsToInsert);
  }

  const { data: allLevels } = await supabase
    .from('levels')
    .select('*')
    .eq('school_id', schoolId)
    .order('order_index');

  const currentLevels = allLevels || [];
  result.levelsCount = currentLevels.length;

  // 3. ENSURE CLASSES FOR EACH LEVEL
  const { data: existingClasses } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId);

  const existingClassNames = new Set((existingClasses || []).map(c => c.name.toLowerCase()));
  const classesToInsert = currentLevels
    .filter(level => !existingClassNames.has(level.name.toLowerCase()))
    .map(level => ({
      school_id: schoolId,
      level_id: level.id,
      name: level.name,
      capacity: 35,
    }));

  if (classesToInsert.length > 0) {
    await supabase.from('classes').insert(classesToInsert);
  }

  const { data: allClasses } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  const currentClasses = allClasses || [];
  result.classesCount = currentClasses.length;

  // 4. ENSURE SUBJECTS
  const { data: existingSubjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId);

  const existingSubjNames = new Set((existingSubjects || []).map(s => s.name.toLowerCase()));
  const subjectsToInsert = PRIMARY_SUBJECT_PRESETS.filter(s => !existingSubjNames.has(s.name.toLowerCase()))
    .map(s => ({ ...s, school_id: schoolId }));

  if (subjectsToInsert.length > 0) {
    await supabase.from('subjects').insert(subjectsToInsert);
  }

  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('id')
    .eq('school_id', schoolId);
  result.subjectsCount = allSubjects?.length || 0;

  // 5. ENSURE FEE TYPES
  const { data: existingFeeTypes } = await supabase
    .from('fee_types')
    .select('*')
    .eq('school_id', schoolId);

  const existingFeeNames = new Set((existingFeeTypes || []).map(f => f.name.toLowerCase()));
  const feeTypesToInsert = PRIMARY_FEE_TYPE_PRESETS.filter(f => !existingFeeNames.has(f.name.toLowerCase()))
    .map(f => ({ ...f, school_id: schoolId }));

  if (feeTypesToInsert.length > 0) {
    await supabase.from('fee_types').insert(feeTypesToInsert);
  }

  // 6. ENSURE PAYMENT PLANS (Maternelle, Primaire, CM2)
  if (activeYearId) {
    const { data: existingPlans } = await supabase
      .from('payment_plans')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('academic_year_id', activeYearId);

    const existingPlanNames = new Set((existingPlans || []).map(p => p.name.toLowerCase()));

    const plansConfig = [
      {
        name: 'Maternelle (PS, MS, GS)',
        total_amount: 125000,
        canteen_monthly: 7000,
        canteen_quarterly: 21000,
        canteen_annual: 56000,
        levelKeys: ['petite section', 'moyenne section', 'grande section'],
        schedules: [
          { installment_number: 1, label: '1ère Tranche (Rentrée)', amount: 55000, due_date: '2026-09-30' },
          { installment_number: 2, label: '2ème Tranche (2ème Trimestre)', amount: 35000, due_date: '2026-12-15' },
          { installment_number: 3, label: '3ème Tranche (3ème Trimestre)', amount: 35000, due_date: '2027-03-15' },
        ],
      },
      {
        name: 'Primaire (CP1 - CM1)',
        total_amount: 145000,
        canteen_monthly: 8000,
        canteen_quarterly: 24000,
        canteen_annual: 64000,
        levelKeys: ['cp', 'cp1', 'cp2', 'ce1', 'ce2', 'cm1'],
        schedules: [
          { installment_number: 1, label: '1ère Tranche (Rentrée)', amount: 65000, due_date: '2026-09-30' },
          { installment_number: 2, label: '2ème Tranche (2ème Trimestre)', amount: 40000, due_date: '2026-12-15' },
          { installment_number: 3, label: '3ème Tranche (3ème Trimestre)', amount: 40000, due_date: '2027-03-15' },
        ],
      },
      {
        name: 'CM2 (Examen National)',
        total_amount: 165000,
        canteen_monthly: 8000,
        canteen_quarterly: 24000,
        canteen_annual: 64000,
        levelKeys: ['cm2'],
        schedules: [
          { installment_number: 1, label: '1ère Tranche (Rentrée & Dossier)', amount: 75000, due_date: '2026-09-30' },
          { installment_number: 2, label: '2ème Tranche (2ème Trimestre)', amount: 45000, due_date: '2026-12-15' },
          { installment_number: 3, label: '3ème Tranche (3ème Trimestre)', amount: 45000, due_date: '2027-03-15' },
        ],
      },
    ];

    for (const planDef of plansConfig) {
      if (!existingPlanNames.has(planDef.name.toLowerCase())) {
        try {
          const { data: newPlan, error: pErr } = await supabase
            .from('payment_plans')
            .insert({
              school_id: schoolId,
              academic_year_id: activeYearId,
              name: planDef.name,
              total_amount: planDef.total_amount,
              canteen_monthly: planDef.canteen_monthly,
              canteen_quarterly: planDef.canteen_quarterly,
              canteen_annual: planDef.canteen_annual,
            })
            .select()
            .single();

          if (!pErr && newPlan) {
            // Link matching levels
            const matchingLevels = currentLevels.filter(l =>
              planDef.levelKeys.some(k => l.name.toLowerCase().includes(k)),
            );
            if (matchingLevels.length > 0) {
              const planLevels = matchingLevels.map(ml => ({
                plan_id: newPlan.id,
                level_id: ml.id,
              }));
              await supabase.from('payment_plan_levels').insert(planLevels);
            }

            // Insert schedule templates
            const schedRows = planDef.schedules.map(s => ({
              plan_id: newPlan.id,
              installment_number: s.installment_number,
              label: s.label,
              amount: s.amount,
              due_date: s.due_date,
            }));
            await supabase.from('payment_schedule_templates').insert(schedRows);
          }
        } catch (e) {
          console.warn('Error creating plan', planDef.name, e);
        }
      }
    }

    const { data: allPlans } = await supabase
      .from('payment_plans')
      .select('id')
      .eq('school_id', schoolId);
    result.plansCount = allPlans?.length || 0;
  }

  // 7. SEED SAMPLE STUDENTS AND PARENTS (If school is currently empty)
  if (options.withSampleData && currentClasses.length > 0) {
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId);

    if ((studentCount || 0) === 0) {
      const samplePupils = [
        { first_name: 'Ange-Emmanuel', last_name: 'KOUADIO', sex: 'M', dob: '2021-04-12', classKey: 'petite section', parentName: 'KOUADIO Marc', phone: '+225 07 01 23 45 67' },
        { first_name: 'Marie-Esther', last_name: 'KOUASSI', sex: 'F', dob: '2020-08-24', classKey: 'moyenne section', parentName: 'KOUASSI Blandine', phone: '+225 07 48 12 34 56' },
        { first_name: 'Emmanuelle Uria', last_name: 'AGOHI-N’GUESSAN', sex: 'F', dob: '2019-05-14', classKey: 'grande section', parentName: 'AGOHI Maurel', phone: '+225 07 00 27 66 89' },
        { first_name: 'Mohamed', last_name: 'TOURE', sex: 'M', dob: '2018-02-17', classKey: 'cp', parentName: 'TOURE Bakary', phone: '+225 05 12 34 56 78' },
        { first_name: 'Grace Emmanuelle', last_name: 'YAO', sex: 'F', dob: '2017-09-03', classKey: 'ce1', parentName: 'YAO Patrick', phone: '+225 07 89 45 12 30' },
        { first_name: 'Jean-Eudes', last_name: 'KONAN', sex: 'M', dob: '2016-11-20', classKey: 'ce2', parentName: 'KONAN Felicite', phone: '+225 01 23 45 67 89' },
        { first_name: 'Aïssatou', last_name: 'DIALLO', sex: 'F', dob: '2015-06-15', classKey: 'cm1', parentName: 'DIALLO Oumar', phone: '+225 05 67 89 12 34' },
        { first_name: 'David', last_name: 'ZADI', sex: 'M', dob: '2014-03-29', classKey: 'cm2', parentName: 'ZADI Prosper', phone: '+225 07 77 88 99 00' },
      ];

      for (let i = 0; i < samplePupils.length; i++) {
        const pupil = samplePupils[i];
        const assignedClass = currentClasses.find(c => c.name.toLowerCase().includes(pupil.classKey)) || currentClasses[0];

        try {
          // 1. Create Parent
          const parentNames = pupil.parentName.split(' ');
          const { data: newParent } = await supabase
            .from('parents')
            .insert({
              school_id: schoolId,
              first_name: parentNames[1] || 'Parent',
              last_name: parentNames[0] || 'Famille',
              phone: pupil.phone,
              email: `${pupil.first_name.toLowerCase().replace(/[^a-z]/g, '')}.parent@gmail.com`,
              address: 'Abidjan',
            })
            .select()
            .single();

          // 2. Create Student
          const { data: newStudent } = await supabase
            .from('students')
            .insert({
              school_id: schoolId,
              matricule: generateMatricule('ELV', i + 1),
              first_name: pupil.first_name,
              last_name: pupil.last_name,
              date_of_birth: pupil.dob,
              sex: pupil.sex,
              phone: pupil.phone,
              email: '',
              class_id: assignedClass?.id,
              status: 'active',
            })
            .select()
            .single();

          if (newStudent && newParent) {
            // Link student and parent
            await supabase.from('student_parents').insert({
              student_id: newStudent.id,
              parent_id: newParent.id,
              relationship: 'pere',
              is_primary: true,
            });

            // Insert initial payment receipt
            await supabase.from('payments').insert({
              school_id: schoolId,
              student_id: newStudent.id,
              amount: 55000,
              payment_date: '2026-09-20',
              payment_method: 'mobile_money',
              receipt_number: generateReceiptNumber(),
              status: 'validated',
              notes: 'Inscription et 1ère tranche validées',
            });

            result.studentsCount++;
          }
        } catch (e) {
          console.warn('Error creating sample pupil', pupil.first_name, e);
        }
      }
    }
  }

  return result;
}
