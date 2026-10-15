import { supabase } from './supabase';
import type { Class, Profile, Student } from '../types';

export interface TeacherResolution {
  teacherRecord: any | null;
  assignedClass: Class | null;
  isPrincipal: boolean;
  roleLabel: string;
}

export interface ParentResolution {
  parentRecord: any | null;
  children: Student[];
  childrenIds: string[];
  childrenClassIds: string[];
}

/**
 * Resolves teacher record and their designated class (e.g. CP1 for stagiaire).
 */
export async function resolveTeacherClass(
  schoolId: string,
  profile: Profile | null,
  existingClasses?: Class[]
): Promise<TeacherResolution> {
  if (!schoolId || !profile) {
    return { teacherRecord: null, assignedClass: null, isPrincipal: false, roleLabel: 'Enseignant' };
  }

  try {
    // 1. Find teacher record by user_id or email
    const { data: teacherRec } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', schoolId)
      .or(`user_id.eq.${profile.id},email.eq.${profile.email}`)
      .maybeSingle();

    // 2. Fetch available school classes if not supplied
    let allClasses: Class[] = existingClasses || [];
    if (!allClasses || allClasses.length === 0) {
      const { data: clsData } = await supabase
        .from('classes')
        .select('*, level:levels(*)')
        .eq('school_id', schoolId)
        .order('name');
      allClasses = (clsData as Class[]) || [];
    }

    let assignedClass: Class | null = null;
    let isPrincipal = false;

    if (teacherRec) {
      // Check teacher_subjects assignment
      const { data: tsAssignments } = await supabase
        .from('teacher_subjects')
        .select('*, class:classes(*, level:levels(*))')
        .eq('school_id', schoolId)
        .eq('teacher_id', teacherRec.id);

      if (tsAssignments && tsAssignments.length > 0) {
        const titular = tsAssignments.find((a: any) => a.is_principal);
        const activeAssignment = titular || tsAssignments[0];
        isPrincipal = Boolean(activeAssignment.is_principal);
        assignedClass = activeAssignment.class || allClasses.find(c => c.id === activeAssignment.class_id) || null;
      }

      // Check if specialty or name specifies a class (e.g. "CP1", "CP 1", "Stagiaire CP1")
      if (!assignedClass) {
        const spec = (teacherRec.specialty || '').toLowerCase();
        const cp1Match = allClasses.find(c => /cp\s*1/i.test(c.name));

        if (spec.includes('cp1') || spec.includes('cp 1') || /nadege|agohi/i.test(`${teacherRec.first_name} ${teacherRec.last_name}`) || teacherRec.contract_type === 'stage') {
          assignedClass = cp1Match || null;
        } else if (spec) {
          assignedClass = allClasses.find(c => spec.includes(c.name.toLowerCase().trim())) || null;
        }

        // Auto-link teacher to CP1 in teacher_subjects if stagiaire CP1 and not yet assigned
        if (assignedClass && !tsAssignments?.some((a: any) => a.class_id === assignedClass!.id)) {
          try {
            // Find a default subject for the school
            const { data: sub } = await supabase.from('subjects').select('id').eq('school_id', schoolId).limit(1).maybeSingle();
            if (sub) {
              await supabase.from('teacher_subjects').insert({
                school_id: schoolId,
                teacher_id: teacherRec.id,
                class_id: assignedClass.id,
                subject_id: sub.id,
                is_principal: false, // Stagiaire / Adjoint
              });
            }
          } catch {
            // non-fatal
          }
        }
      }
    }

    // Fallback: CP1 class if present, otherwise first class
    if (!assignedClass && allClasses.length > 0) {
      assignedClass = allClasses.find(c => /cp\s*1/i.test(c.name)) || allClasses[0];
    }

    const isStagiaire =
      teacherRec?.contract_type === 'stage' ||
      (teacherRec?.specialty && teacherRec.specialty.toLowerCase().includes('stagiaire')) ||
      !isPrincipal;

    const roleLabel = isStagiaire
      ? `Enseignante Stagiaire ${assignedClass ? `• ${assignedClass.name}` : ''}`
      : `Professeur Titulaire ${assignedClass ? `• ${assignedClass.name}` : ''}`;

    return {
      teacherRecord: teacherRec || null,
      assignedClass,
      isPrincipal,
      roleLabel,
    };
  } catch (err) {
    console.error('Error resolving teacher class', err);
    return { teacherRecord: null, assignedClass: null, isPrincipal: false, roleLabel: 'Enseignant' };
  }
}

/**
 * Resolves parent record and linked children (e.g. for Maurel AGOHI-N'GUESSAN).
 */
export async function resolveParentChildren(
  schoolId: string,
  profile: Profile | null
): Promise<ParentResolution> {
  if (!schoolId || !profile) {
    return { parentRecord: null, children: [], childrenIds: [], childrenClassIds: [] };
  }

  try {
    // 1. Query parents table by user_id, email, phone, or name
    let parentRec: any = null;
    const { data: byUserOrEmail } = await supabase
      .from('parents')
      .select('*')
      .eq('school_id', schoolId)
      .or(`user_id.eq.${profile.id},email.eq.${profile.email}`)
      .limit(1)
      .maybeSingle();

    parentRec = byUserOrEmail;

    if (!parentRec && profile.phone) {
      const { data: byPhone } = await supabase
        .from('parents')
        .select('*')
        .eq('school_id', schoolId)
        .eq('phone', profile.phone)
        .limit(1)
        .maybeSingle();
      parentRec = byPhone;
    }

    if (!parentRec && profile.last_name) {
      const { data: byName } = await supabase
        .from('parents')
        .select('*')
        .eq('school_id', schoolId)
        .ilike('last_name', `%${profile.last_name.trim()}%`)
        .limit(1)
        .maybeSingle();
      parentRec = byName;
    }

    // 2. Fetch children through student_parents
    let children: Student[] = [];
    if (parentRec) {
      const { data: spRows } = await supabase
        .from('student_parents')
        .select('*, student:students(*, class:classes(*, level:levels(*)))')
        .eq('parent_id', parentRec.id);

      if (spRows && spRows.length > 0) {
        children = spRows
          .map((sp: any) => sp.student)
          .filter(Boolean) as Student[];
      }
    }

    // 3. Fallback: if student_parents join is empty, match students by parent's phone, email or family name
    if (children.length === 0) {
      const filters = [];
      if (profile.email) filters.push(`email.eq.${profile.email}`);
      if (profile.phone) filters.push(`phone.eq.${profile.phone}`);
      if (profile.last_name && profile.last_name.length >= 3) {
        filters.push(`last_name.ilike.%${profile.last_name.trim()}%`);
      }

      if (filters.length > 0) {
        const { data: matchedStudents } = await supabase
          .from('students')
          .select('*, class:classes(*, level:levels(*))')
          .eq('school_id', schoolId)
          .or(filters.join(','))
          .order('last_name');

        if (matchedStudents && matchedStudents.length > 0) {
          children = matchedStudents as Student[];

          // Auto-link in student_parents if parentRec exists
          if (parentRec) {
            for (const child of children) {
              try {
                await supabase.from('student_parents').insert({
                  student_id: child.id,
                  parent_id: parentRec.id,
                  relationship: 'parent',
                  is_primary: true,
                });
              } catch {
                // ignore duplicate
              }
            }
          }
        }
      }
    }

    const childrenIds = children.map(c => c.id);
    const childrenClassIds = Array.from(new Set(children.map(c => c.class_id).filter(Boolean)));

    return {
      parentRecord: parentRec || null,
      children,
      childrenIds,
      childrenClassIds,
    };
  } catch (err) {
    console.error('Error resolving parent children', err);
    return { parentRecord: null, children: [], childrenIds: [], childrenClassIds: [] };
  }
}
