import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import { CONTRACT_TYPES, SEX_OPTIONS, formatDate, generateMatricule, getInitials } from '../../lib/utils';
import type { Class, Subject, Teacher } from '../../types';
import { Plus, BookOpen, Edit, Trash2, Eye, School, Sparkles } from 'lucide-react';

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  academic_year_id: string | null;
  is_principal: boolean;
  class?: { name: string } | null;
  subject?: { name: string } | null;
};

export default function TeachersPage() {
  const { school, academicYear } = useApp();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: 'M',
    phone: '',
    email: '',
    address: '',
    specialty: '',
    contract_type: 'cdi',
    hire_date: '',
    status: 'active',
  });
  const [assignmentForm, setAssignmentForm] = useState({
    class_id: '',
    subject_id: '',
    is_principal: false,
  });

  useEffect(() => {
    if (!school) return;
    void fetchData();
  }, [school, academicYear]);

  async function fetchData() {
    if (!school) return;
    setLoading(true);
    setAssignmentLoading(true);

    const schoolId = school.id;
    const [teacherRes, classRes, subjectRes, assignmentRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('last_name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabase
        .from('teacher_subjects')
        .select('id, teacher_id, subject_id, class_id, academic_year_id, is_principal, class:classes(name), subject:subjects(name)')
        .eq('school_id', schoolId),
    ]);

    const normalizedAssignments = (((assignmentRes.data as unknown[]) || []) as Array<Record<string, any>>).map(assignment => ({
      ...assignment,
      class: Array.isArray(assignment.class) ? assignment.class[0] ?? null : assignment.class ?? null,
      subject: Array.isArray(assignment.subject) ? assignment.subject[0] ?? null : assignment.subject ?? null,
    })) as TeacherAssignment[];

    const scopedAssignments = normalizedAssignments.filter(
      assignment => !academicYear?.id || !assignment.academic_year_id || assignment.academic_year_id === academicYear.id,
    );

    setTeachers((teacherRes.data as Teacher[]) || []);
    setClasses((classRes.data as Class[]) || []);
    setSubjects((subjectRes.data as Subject[]) || []);
    setAssignments(scopedAssignments);
    setLoading(false);
    setAssignmentLoading(false);
  }

  function resetTeacherForm() {
    setForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      sex: 'M',
      phone: '',
      email: '',
      address: '',
      specialty: '',
      contract_type: 'cdi',
      hire_date: '',
      status: 'active',
    });
  }

  function resetAssignmentForm() {
    setAssignmentForm({ class_id: '', subject_id: '', is_principal: false });
  }

  function openCreate() {
    setEditMode(false);
    setSelectedTeacher(null);
    resetTeacherForm();
    setModalOpen(true);
  }

  function openEdit(teacher: Teacher) {
    setEditMode(true);
    setSelectedTeacher(teacher);
    setForm({
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      date_of_birth: teacher.date_of_birth,
      sex: teacher.sex,
      phone: teacher.phone,
      email: teacher.email,
      address: teacher.address,
      specialty: teacher.specialty,
      contract_type: teacher.contract_type,
      hire_date: teacher.hire_date,
      status: teacher.status,
    });
    setModalOpen(true);
  }

  function openAssignmentModal(teacher: Teacher) {
    setSelectedTeacher(teacher);
    resetAssignmentForm();
    setAssignmentOpen(true);
  }

  async function handleSaveTeacher() {
    if (!school) return;
    setSaving(true);

    if (editMode && selectedTeacher) {
      await supabase.from('teachers').update(form).eq('id', selectedTeacher.id);
    } else {
      const matricule = generateMatricule('ENS', teachers.length + 1);
      await supabase.from('teachers').insert({ ...form, school_id: school.id, matricule });
    }

    setSaving(false);
    setModalOpen(false);
    resetTeacherForm();
    await fetchData();
  }

  async function handleDeleteTeacher(id: string) {
    if (!confirm('Suspendre cet enseignant ?')) return;
    await supabase.from('teachers').update({ status: 'suspended' }).eq('id', id);
    await fetchData();
  }

  async function handleSaveAssignment() {
    if (!school || !selectedTeacher || !assignmentForm.class_id || !assignmentForm.subject_id) return;

    setAssignmentSaving(true);

    if (assignmentForm.is_principal) {
      await supabase
        .from('teacher_subjects')
        .update({ is_principal: false })
        .eq('school_id', school.id)
        .eq('class_id', assignmentForm.class_id)
        .eq('is_principal', true);
    }

    const existingAssignment = assignments.find(
      assignment =>
        assignment.teacher_id === selectedTeacher.id &&
        assignment.class_id === assignmentForm.class_id &&
        assignment.subject_id === assignmentForm.subject_id,
    );

    if (existingAssignment) {
      await supabase
        .from('teacher_subjects')
        .update({
          is_principal: assignmentForm.is_principal,
          academic_year_id: academicYear?.id || null,
        })
        .eq('id', existingAssignment.id);
    } else {
      await supabase.from('teacher_subjects').insert({
        school_id: school.id,
        teacher_id: selectedTeacher.id,
        subject_id: assignmentForm.subject_id,
        class_id: assignmentForm.class_id,
        academic_year_id: academicYear?.id || null,
        is_principal: assignmentForm.is_principal,
      });
    }

    setAssignmentSaving(false);
    resetAssignmentForm();
    await fetchData();
  }

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm('Retirer cette affectation ?')) return;
    await supabase.from('teacher_subjects').delete().eq('id', assignmentId);
    await fetchData();
  }

  function getTeacherAssignments(teacherId: string) {
    return assignments.filter(assignment => assignment.teacher_id === teacherId);
  }

  function getPrincipalClasses(teacherId: string) {
    return getTeacherAssignments(teacherId).filter(assignment => assignment.is_principal);
  }

  const teacherColumns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'specialty', label: 'Cycle / spécialité' },
    {
      key: 'titulariat',
      label: 'Titulaire de',
      render: (teacher: Teacher) => {
        const principalClasses = getPrincipalClasses(teacher.id);
        if (principalClasses.length === 0) return <span className="text-sm text-slate-400">Aucune classe</span>;

        return (
          <div className="flex flex-wrap gap-1.5">
            {principalClasses.map(assignment => (
              <span key={assignment.id} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {assignment.class?.name || 'Classe'}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'contract_type',
      label: 'Contrat',
      render: (teacher: Teacher) => CONTRACT_TYPES.find(contract => contract.value === teacher.contract_type)?.label || teacher.contract_type,
    },
    { key: 'status', label: 'Statut', render: (teacher: Teacher) => <Badge status={teacher.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (teacher: Teacher) => (
        <div className="flex gap-1">
          <button onClick={() => { setSelectedTeacher(teacher); setDetailOpen(true); }} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <Eye size={16} />
          </button>
          <button onClick={() => openAssignmentModal(teacher)} className="rounded-full p-2 text-emerald-600 transition hover:bg-emerald-50">
            <School size={16} />
          </button>
          <button onClick={() => openEdit(teacher)} className="rounded-full p-2 text-amber-600 transition hover:bg-amber-50">
            <Edit size={16} />
          </button>
          <button onClick={() => void handleDeleteTeacher(teacher.id)} className="rounded-full p-2 text-red-500 transition hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const selectedTeacherAssignments = useMemo(
    () => (selectedTeacher ? getTeacherAssignments(selectedTeacher.id) : []),
    [selectedTeacher, assignments],
  );

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles size={14} /> Pilotage pédagogique
            </span>
            <h1 className="mt-4 display-font text-3xl font-semibold text-slate-900">Enseignants & titulaires de classe</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Attribue des classes, des matières et des responsabilités de titulaire pour suivre la vie d'une classe au quotidien.
            </p>
          </div>
          <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Vue rapide</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xl font-bold text-slate-900">{teachers.filter(teacher => teacher.status === 'active').length}</p>
                <p className="text-xs text-slate-500">Actifs</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xl font-bold text-slate-900">{assignments.filter(assignment => assignment.is_principal).length}</p>
                <p className="text-xs text-slate-500">Titulariats</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xl font-bold text-slate-900">{classes.length}</p>
                <p className="text-xs text-slate-500">Classes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="display-font text-xl font-semibold text-slate-900">Corps enseignant</h2>
            <p className="mt-1 text-sm text-slate-500">{teachers.filter(teacher => teacher.status === 'active').length} enseignant(s) actif(s)</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700">
            <Plus size={18} /> Nouvel enseignant
          </button>
        </div>

        {teachers.length === 0 && !loading ? (
          <EmptyState
            icon={<BookOpen size={40} />}
            title="Aucun enseignant enregistré"
            description="Ajoute ton équipe pédagogique puis affecte les titulaires de classe."
            action={
              <button onClick={openCreate} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">
                Ajouter un enseignant
              </button>
            }
          />
        ) : (
          <DataTable
            columns={teacherColumns}
            data={teachers as any[]}
            searchKeys={['matricule', 'first_name', 'last_name', 'specialty']}
            searchPlaceholder="Rechercher un enseignant..."
            loading={loading}
          />
        )}
      </section>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Modifier l\'enseignant' : 'Nouvel enseignant'}
        size="lg"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveTeacher()} disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Prénom" required>
            <input type="text" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Nom" required>
            <input type="text" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Date de naissance">
            <input type="date" value={form.date_of_birth} onChange={event => setForm({ ...form, date_of_birth: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Sexe">
            <select value={form.sex} onChange={event => setForm({ ...form, sex: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
              {SEX_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Téléphone">
            <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Email">
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Cycle / spécialité">
            <input
              type="text"
              value={form.specialty}
              onChange={event => setForm({ ...form, specialty: event.target.value })}
              placeholder="Ex: Maternelle, Français, Mathématiques, CM1"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Type de contrat">
            <select value={form.contract_type} onChange={event => setForm({ ...form, contract_type: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
              {CONTRACT_TYPES.map(contract => (
                <option key={contract.value} value={contract.value}>
                  {contract.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Date d'embauche">
            <input type="date" value={form.hire_date} onChange={event => setForm({ ...form, hire_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche enseignant" size="md">
        {selectedTeacher && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 text-lg font-bold text-sky-700">
                {getInitials(selectedTeacher.first_name, selectedTeacher.last_name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedTeacher.first_name} {selectedTeacher.last_name}</h3>
                <p className="text-sm text-slate-500">Matricule : {selectedTeacher.matricule}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Spécialité :</span> <span className="font-medium text-slate-900">{selectedTeacher.specialty || '-'}</span></div>
              <div><span className="text-slate-500">Contrat :</span> <span className="font-medium text-slate-900">{CONTRACT_TYPES.find(contract => contract.value === selectedTeacher.contract_type)?.label || '-'}</span></div>
              <div><span className="text-slate-500">Téléphone :</span> <span className="font-medium text-slate-900">{selectedTeacher.phone || '-'}</span></div>
              <div><span className="text-slate-500">Email :</span> <span className="font-medium text-slate-900">{selectedTeacher.email || '-'}</span></div>
              <div><span className="text-slate-500">Date d'embauche :</span> <span className="font-medium text-slate-900">{selectedTeacher.hire_date ? formatDate(selectedTeacher.hire_date) : '-'}</span></div>
              <div><span className="text-slate-500">Statut :</span> <Badge status={selectedTeacher.status} /></div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Responsabilités de classe</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {getPrincipalClasses(selectedTeacher.id).length > 0 ? (
                  getPrincipalClasses(selectedTeacher.id).map(assignment => (
                    <span key={assignment.id} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                      Titulaire {assignment.class?.name || 'Classe'}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Aucun titulariat attribué.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        title={selectedTeacher ? `Affectations de ${selectedTeacher.first_name} ${selectedTeacher.last_name}` : 'Affectations'}
        size="lg"
        actions={
          <>
            <button onClick={() => setAssignmentOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Fermer
            </button>
            <button onClick={() => void handleSaveAssignment()} disabled={assignmentSaving || assignmentLoading} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Ajouter l'affectation
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Classe" required>
              <select value={assignmentForm.class_id} onChange={event => setAssignmentForm({ ...assignmentForm, class_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="">Sélectionner</option>
                {classes.map(currentClass => (
                  <option key={currentClass.id} value={currentClass.id}>
                    {currentClass.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Matière principale" required>
              <select value={assignmentForm.subject_id} onChange={event => setAssignmentForm({ ...assignmentForm, subject_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="">Sélectionner</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={assignmentForm.is_principal}
              onChange={event => setAssignmentForm({ ...assignmentForm, is_principal: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Marquer cet enseignant comme titulaire de la classe sélectionnée
          </label>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Affectations déjà enregistrées</p>
            <div className="mt-3 space-y-2">
              {selectedTeacherAssignments.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune affectation pour le moment.</p>
              ) : (
                selectedTeacherAssignments.map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {assignment.class?.name || 'Classe'} · {assignment.subject?.name || 'Matière'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {assignment.is_principal ? 'Titulaire de classe' : 'Intervenant pédagogique'}
                      </p>
                    </div>
                    <button onClick={() => void handleDeleteAssignment(assignment.id)} className="rounded-full p-2 text-red-500 transition hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
