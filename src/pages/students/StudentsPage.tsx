import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import {
  formatDate,
  generateMatricule,
  RELATIONSHIP_OPTIONS,
  SEX_OPTIONS,
  STATUS_OPTIONS,
} from '../../lib/utils';
import { buildStudentCardHtml, downloadTextDocument, openPrintPreview, sanitizeDocumentName } from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { recordAuditLog } from '../../lib/audit';
import type { Class, Parent, Student, StudentParent } from '../../types';
import {
  Camera,
  Download,
  Edit,
  Eye,
  GraduationCap,
  ImageOff,
  Link2,
  Phone,
  Plus,
  Printer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';

type StudentListItem = Student & { class?: Pick<Class, 'id' | 'name'>; family_count: number };
type FamilyLink = StudentParent & { parent?: Parent };

const EMPTY_STUDENT_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  sex: 'M',
  birth_place: '',
  nationality: '',
  photo_url: '',
  address: '',
  phone: '',
  email: '',
  class_id: '',
  status: 'active',
  medical_info: '',
  previous_school: '',
};

const EMPTY_LINK_FORM = {
  parent_id: '',
  relationship: 'pere',
  is_primary: false,
  is_billing_contact: false,
  is_pickup_authorized: true,
  emergency_priority: 1,
  notes: '',
};

export default function StudentsPage() {
  const { school, academicYear } = useApp();
  const { isAdmin, isDirector, isSupervisor, profile } = useAuth();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(EMPTY_STUDENT_FORM);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK_FORM);
  const [saving, setSaving] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageStudents = isAdmin || isDirector || isSupervisor;

  useEffect(() => {
    if (!school) return;
    void Promise.all([fetchStudents(), fetchClasses(), fetchParents()]);
  }, [school]);

  async function fetchStudents() {
    if (!school) return;
    setLoading(true);

    const [studentRes, linksRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, class:classes(id, name)')
        .eq('school_id', school.id)
        .order('last_name'),
      supabase.from('student_parents').select('student_id').in(
        'student_id',
        (
          await supabase.from('students').select('id').eq('school_id', school.id)
        ).data?.map(item => item.id) || ['00000000-0000-0000-0000-000000000000'],
      ),
    ]);

    const linkCountMap = ((linksRes.data as Array<{ student_id: string }>) || []).reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.student_id] = (accumulator[item.student_id] || 0) + 1;
      return accumulator;
    }, {});

    const rows = ((studentRes.data as Student[]) || []).map(student => ({
      ...(student as StudentListItem),
      family_count: linkCountMap[student.id] || 0,
    }));

    setStudents(rows);
    setLoading(false);
  }

  async function fetchClasses() {
    if (!school) return;
    const { data } = await supabase.from('classes').select('*').eq('school_id', school.id).order('name');
    setClasses((data as Class[]) || []);
  }

  async function fetchParents() {
    if (!school) return;
    const { data } = await supabase.from('parents').select('*').eq('school_id', school.id).order('last_name');
    setParents((data as Parent[]) || []);
  }

  async function fetchStudentDetail(studentId: string) {
    const { data } = await supabase
      .from('students')
      .select('*, class:classes(id, name)')
      .eq('id', studentId)
      .maybeSingle();

    return data as Student | null;
  }

  async function fetchFamilyLinks(studentId: string) {
    const { data } = await supabase
      .from('student_parents')
      .select('*, parent:parents(*)')
      .eq('student_id', studentId)
      .order('emergency_priority', { ascending: true });

    setFamilyLinks((data as FamilyLink[]) || []);
  }

  function openCreate() {
    setNotice(null);
    setEditMode(false);
    setSelectedStudent(null);
    setForm(EMPTY_STUDENT_FORM);
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setNotice(null);
    setEditMode(true);
    setSelectedStudent(student);
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      date_of_birth: student.date_of_birth,
      sex: student.sex,
      birth_place: student.birth_place,
      nationality: student.nationality,
      photo_url: student.photo_url,
      address: student.address,
      phone: student.phone,
      email: student.email,
      class_id: student.class_id,
      status: student.status,
      medical_info: student.medical_info,
      previous_school: student.previous_school,
    });
    setModalOpen(true);
  }

  async function openDetail(student: Student) {
    setDetailOpen(true);
    setDetailLoading(true);
    const detail = await fetchStudentDetail(student.id);
    setSelectedStudent(detail);
    if (detail) {
      await fetchFamilyLinks(detail.id);
    } else {
      setFamilyLinks([]);
    }
    setDetailLoading(false);
  }

  async function refreshSelectedStudent(studentId: string) {
    const detail = await fetchStudentDetail(studentId);
    setSelectedStudent(detail);
    if (detail) {
      await fetchFamilyLinks(studentId);
    }
    await fetchStudents();
  }

  async function handleSaveStudent() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    if (editMode && selectedStudent) {
      await supabase.from('students').update(form).eq('id', selectedStudent.id);
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        action: 'student_updated',
        entityType: 'student',
        entityId: selectedStudent.id,
        details: { matricule: selectedStudent.matricule },
      });
    } else {
      const count = students.length + 1;
      const matricule = generateMatricule('ELV', count);
      await supabase.from('students').insert({ ...form, school_id: school.id, matricule });
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        action: 'student_created',
        entityType: 'student',
        details: { matricule },
      });
    }

    setSaving(false);
    setModalOpen(false);
    setForm(EMPTY_STUDENT_FORM);
    await fetchStudents();
  }

  async function handleDeleteStudent(id: string) {
    if (!school || !confirm('Archiver cet eleve ?')) return;
    await supabase.from('students').update({ status: 'transferred' }).eq('id', id);
    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: 'student_archived',
      entityType: 'student',
      entityId: id,
    });
    await fetchStudents();
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const baseName = sanitizeDocumentName(file.name.replace(/\.[^.]+$/, '')) || 'photo-eleve';
      const path = `${school.id}/students/photos/${baseName}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('student-media').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (error) throw error;

      const { data } = supabase.storage.from('student-media').getPublicUrl(path);
      setForm(current => ({ ...current, photo_url: data.publicUrl }));
      setNotice("Photo enregistree. Elle sera visible dans le dossier et sur la carte scolaire.");
    } catch (error) {
      console.error(error);
      setNotice("La photo n'a pas pu etre envoyee. Verifie la migration du bucket student-media.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  }

  async function handleSaveFamilyLinks() {
    if (!school || !selectedStudent) return;
    setLinkSaving(true);

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
      ...(draftWillBeInserted ? [{
        id: `draft-${linkForm.parent_id}`,
        parent_id: linkForm.parent_id,
        relationship: linkForm.relationship,
        is_primary: linkForm.is_primary,
        is_billing_contact: linkForm.is_billing_contact,
        is_pickup_authorized: linkForm.is_pickup_authorized,
        emergency_priority: linkForm.emergency_priority,
        notes: linkForm.notes,
      }] : []),
    ];

    const primaryParentId = effectiveLinks.find(link => link.is_primary)?.parent_id || null;
    const billingParentId = effectiveLinks.find(link => link.is_billing_contact)?.parent_id || primaryParentId;

    for (const link of familyLinks) {
      await supabase
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
    }

    if (draftWillBeInserted) {
      await supabase.from('student_parents').insert({
        student_id: selectedStudent.id,
        parent_id: linkForm.parent_id,
        relationship: linkForm.relationship,
        is_primary: primaryParentId === linkForm.parent_id,
        is_billing_contact: billingParentId === linkForm.parent_id,
        is_pickup_authorized: linkForm.is_pickup_authorized,
        emergency_priority: Number(linkForm.emergency_priority) || 1,
        notes: linkForm.notes,
      });
    }

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: 'student_family_links_saved',
      entityType: 'student',
      entityId: selectedStudent.id,
      details: { linkedParents: effectiveLinks.length },
    });

    setLinkSaving(false);
    setLinkForm(EMPTY_LINK_FORM);
    await refreshSelectedStudent(selectedStudent.id);
    await fetchParents();
    setFamilyModalOpen(false);
  }

  async function removeFamilyLink(linkId: string) {
    if (!school || !selectedStudent || !confirm('Detacher ce parent de l eleve ?')) return;
    await supabase.from('student_parents').delete().eq('id', linkId);
    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: 'student_parent_detached',
      entityType: 'student',
      entityId: selectedStudent.id,
    });
    await refreshSelectedStudent(selectedStudent.id);
  }

  async function handleStudentCardAction(mode: 'print' | 'download') {
    if (!school || !selectedStudent) return;

    const primaryGuardian = familyLinks.find(link => link.is_billing_contact)?.parent
      || familyLinks.find(link => link.is_primary)?.parent
      || familyLinks[0]?.parent;

    const html = buildStudentCardHtml({
      school,
      student: selectedStudent,
      academicYearName: academicYear?.name,
      className: (selectedStudent as Student & { class?: Pick<Class, 'name'> }).class?.name,
      primaryGuardian: primaryGuardian ? `${primaryGuardian.first_name} ${primaryGuardian.last_name}` : undefined,
    });

    try {
      await saveGeneratedDocument({
        schoolId: school.id,
        entityType: 'student',
        entityId: selectedStudent.id,
        documentType: 'student_card',
        title: `Carte scolaire - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
        baseFileName: `carte-scolaire-${selectedStudent.matricule}`,
        html,
        uploadedBy: profile?.id,
      });
    } catch (error) {
      console.error('Unable to persist student card', error);
    }

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: mode === 'print' ? 'student_card_printed' : 'student_card_downloaded',
      entityType: 'student',
      entityId: selectedStudent.id,
      details: { matricule: selectedStudent.matricule },
    });

    if (mode === 'print') {
      openPrintPreview(html);
      return;
    }

    downloadTextDocument(html, `carte-scolaire-${selectedStudent.matricule}.html`);
  }

  const availableParents = useMemo(
    () => parents.filter(parent => !familyLinks.some(link => link.parent_id === parent.id)),
    [parents, familyLinks],
  );

  const relationshipLabels = useMemo(
    () => RELATIONSHIP_OPTIONS.reduce<Record<string, string>>((accumulator, option) => {
      accumulator[option.value] = option.label;
      return accumulator;
    }, {}),
    [],
  );

  const columns: Column<StudentListItem>[] = [
    {
      key: 'identity',
      label: 'Eleve',
      render: (student: StudentListItem) => (
        <div className="flex items-center gap-3">
          {student.photo_url ? (
            <img src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} className="h-11 w-11 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
              {student.first_name[0]}{student.last_name[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
            <p className="text-xs text-slate-500">{student.matricule}</p>
          </div>
        </div>
      ),
    },
    { key: 'class', label: 'Classe', render: (student: StudentListItem) => student.class?.name || '-' },
    { key: 'sex', label: 'Sexe', render: (student: StudentListItem) => student.sex === 'M' ? 'Masculin' : 'Feminin' },
    { key: 'family_count', label: 'Famille', render: (student: StudentListItem) => <span className="font-medium">{student.family_count} lien(s)</span> },
    { key: 'status', label: 'Statut', render: (student: StudentListItem) => <Badge status={student.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (student: StudentListItem) => (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => void openDetail(student)} className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50">
            <Eye size={16} />
          </button>
          {canManageStudents && (
            <button onClick={() => openEdit(student)} className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50">
              <Edit size={16} />
            </button>
          )}
          {canManageStudents && (
            <button onClick={() => void handleDeleteStudent(student.id)} className="rounded-xl p-2 text-red-600 transition hover:bg-red-50">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const statusLabels: Record<string, string> = {
    active: 'Actif',
    suspended: 'Suspendu',
    transferred: 'Transfere',
    graduated: 'Diplome',
  };

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">Dossiers eleves & identites</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Chaque eleve dispose maintenant d'un dossier plus riche avec photo, famille rattachee,
              carte scolaire imprimable et informations prêtes pour les documents officiels.
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Vision dossier complet</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                <p className="text-xs text-slate-500">Eleves suivis</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{students.filter(student => Boolean(student.photo_url)).length}</p>
                <p className="text-xs text-slate-500">Photos chargees</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{students.reduce((sum, student) => sum + student.family_count, 0)}</p>
                <p className="text-xs text-slate-500">Liens famille</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Population scolaire</h2>
          <p className="mt-1 text-sm text-slate-500">{students.length} eleve(s) inscrit(s)</p>
        </div>
        {canManageStudents && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
            <Plus size={16} /> Nouvel eleve
          </button>
        )}
      </div>

      {students.length === 0 && !loading ? (
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Aucun eleve"
          description="Commence par inscrire les eleves, ajouter leur photo et relier leur famille pour obtenir des dossiers complets."
          action={
            canManageStudents ? (
              <button onClick={openCreate} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                Inscrire un eleve
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchPlaceholder="Rechercher un eleve..."
          searchKeys={['matricule', 'first_name', 'last_name']}
          loading={loading}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? "Modifier l'eleve" : 'Nouvel eleve'}
        size="xl"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveStudent()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Prenom" required>
              <input type="text" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Nom" required>
              <input type="text" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Date de naissance" required>
              <input type="date" value={form.date_of_birth} onChange={event => setForm({ ...form, date_of_birth: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Sexe" required>
              <select value={form.sex} onChange={event => setForm({ ...form, sex: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                {SEX_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <FormField label="Lieu de naissance">
              <input type="text" value={form.birth_place} onChange={event => setForm({ ...form, birth_place: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Nationalite">
              <input type="text" value={form.nationality} onChange={event => setForm({ ...form, nationality: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Classe">
              <select value={form.class_id} onChange={event => setForm({ ...form, class_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                <option value="">Selectionner une classe</option>
                {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </FormField>
            <FormField label="Statut">
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <FormField label="Telephone">
              <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Adresse">
                <input type="text" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Ecole precedente">
                <input type="text" value={form.previous_school} onChange={event => setForm({ ...form, previous_school: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Infos medicales">
                <textarea value={form.medical_info} onChange={event => setForm({ ...form, medical_info: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
            </div>
          </div>

          <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Photo eleve</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Utilisee dans le dossier, les impressions et la carte scolaire.</p>

            <div className="mt-4 flex justify-center">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Photo eleve" className="h-44 w-44 rounded-[28px] border border-slate-200 object-cover shadow-sm" />
              ) : (
                <div className="flex h-44 w-44 flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white text-slate-400">
                  <Camera size={28} />
                  <p className="mt-3 text-sm">Aucune photo</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700">
                <Upload size={16} />
                {uploadingPhoto ? 'Envoi...' : 'Charger une photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              {form.photo_url && (
                <button onClick={() => setForm(current => ({ ...current, photo_url: '' }))} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  <ImageOff size={16} /> Retirer la photo
                </button>
              )}
            </div>

            {notice && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            )}
          </aside>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche eleve" size="xl">
        {detailLoading || !selectedStudent ? (
          <div className="py-14 text-center text-sm text-slate-500">Chargement du dossier eleve...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4">
                    {selectedStudent.photo_url ? (
                      <img src={selectedStudent.photo_url} alt={`${selectedStudent.first_name} ${selectedStudent.last_name}`} className="h-24 w-24 rounded-[28px] border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-100 text-2xl font-bold text-emerald-700">
                        {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="display-font text-2xl font-semibold text-slate-900">{selectedStudent.first_name} {selectedStudent.last_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">Matricule: {selectedStudent.matricule}</p>
                      <div className="mt-3">
                        <Badge status={selectedStudent.status} label={statusLabels[selectedStudent.status] || selectedStudent.status} />
                      </div>
                    </div>
                  </div>

                  {canManageStudents && (
                    <button onClick={() => setFamilyModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                      <Link2 size={16} /> Gerer la famille
                    </button>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                  <div><span className="text-slate-500">Sexe :</span> <span className="font-medium text-slate-800">{selectedStudent.sex === 'M' ? 'Masculin' : 'Feminin'}</span></div>
                  <div><span className="text-slate-500">Date de naissance :</span> <span className="font-medium text-slate-800">{selectedStudent.date_of_birth ? formatDate(selectedStudent.date_of_birth) : '-'}</span></div>
                  <div><span className="text-slate-500">Classe :</span> <span className="font-medium text-slate-800">{(selectedStudent as Student & { class?: Pick<Class, 'name'> }).class?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Lieu :</span> <span className="font-medium text-slate-800">{selectedStudent.birth_place || '-'}</span></div>
                  <div><span className="text-slate-500">Nationalite :</span> <span className="font-medium text-slate-800">{selectedStudent.nationality || '-'}</span></div>
                  <div><span className="text-slate-500">Telephone :</span> <span className="font-medium text-slate-800">{selectedStudent.phone || '-'}</span></div>
                  <div><span className="text-slate-500">Email :</span> <span className="font-medium text-slate-800">{selectedStudent.email || '-'}</span></div>
                  <div><span className="text-slate-500">Adresse :</span> <span className="font-medium text-slate-800">{selectedStudent.address || '-'}</span></div>
                  <div><span className="text-slate-500">Ecole precedente :</span> <span className="font-medium text-slate-800">{selectedStudent.previous_school || '-'}</span></div>
                </div>

                {selectedStudent.medical_info && (
                  <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Informations medicales</p>
                    <p className="mt-2 text-sm leading-6 text-amber-700">{selectedStudent.medical_info}</p>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-800 p-5 text-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70">Carte scolaire</p>
                    <h3 className="display-font mt-2 text-xl font-semibold">Edition premium</h3>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Annee</p>
                    <p className="text-sm font-semibold">{academicYear?.name || 'En cours'}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] bg-white p-4 text-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Identite</p>
                      <h4 className="display-font mt-2 line-clamp-1 text-lg font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</h4>
                      <p className="mt-1 text-xs text-slate-500">{selectedStudent.matricule}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{(selectedStudent as Student & { class?: Pick<Class, 'name'> }).class?.name || 'Classe'}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{academicYear?.name || 'Annee active'}</span>
                      </div>
                    </div>
                    {selectedStudent.photo_url ? (
                      <img src={selectedStudent.photo_url} alt={selectedStudent.first_name} className="h-20 w-20 rounded-[22px] border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-slate-100 text-xs font-bold text-slate-400">
                        PHOTO
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Responsable principal</p>
                    <p className="mt-2 text-sm font-semibold">
                      {familyLinks.find(link => link.is_billing_contact)?.parent
                        ? `${familyLinks.find(link => link.is_billing_contact)?.parent?.first_name} ${familyLinks.find(link => link.is_billing_contact)?.parent?.last_name}`
                        : familyLinks.find(link => link.is_primary)?.parent
                          ? `${familyLinks.find(link => link.is_primary)?.parent?.first_name} ${familyLinks.find(link => link.is_primary)?.parent?.last_name}`
                          : 'Non defini'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button onClick={() => void handleStudentCardAction('print')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
                    <Printer size={16} /> Imprimer
                  </button>
                  <button onClick={() => void handleStudentCardAction('download')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15">
                    <Download size={16} /> Telecharger
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="display-font text-xl font-semibold text-slate-900">Famille rattachee</h3>
                  <p className="mt-1 text-sm text-slate-500">Responsables legaux, contact principal, contact financier et autorisations.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {familyLinks.length} lien(s)
                </div>
              </div>

              {familyLinks.length === 0 ? (
                <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  Aucun parent n'est encore rattache a cet eleve.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {familyLinks.map(link => (
                    <div key={link.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{link.parent ? `${link.parent.first_name} ${link.parent.last_name}` : 'Parent'}</p>
                          <p className="mt-1 text-sm text-slate-500">{relationshipLabels[link.relationship] || link.relationship}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {link.is_primary && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Principal</span>}
                          {link.is_billing_contact && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Paiement</span>}
                          {link.is_pickup_authorized && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Sortie</span>}
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><Phone size={14} /> {link.parent?.phone || 'Telephone non renseigne'}</p>
                        <p>Priorite urgence : <strong>{link.emergency_priority || 1}</strong></p>
                        {link.notes && <p className="rounded-2xl bg-white px-3 py-2 text-slate-500">{link.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={familyModalOpen}
        onClose={() => setFamilyModalOpen(false)}
        title="Gerer les liens famille"
        size="xl"
        actions={
          <>
            <button onClick={() => setFamilyModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveFamilyLinks()} disabled={linkSaving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {linkSaving ? 'Enregistrement...' : 'Enregistrer les liens'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Lie les responsables legaux, definit le contact principal, le contact financier et l'autorisation de recuperation.
          </div>

          <div className="space-y-4">
            {familyLinks.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Aucun parent rattache pour le moment.
              </div>
            ) : (
              familyLinks.map(link => (
                <div key={link.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{link.parent ? `${link.parent.first_name} ${link.parent.last_name}` : 'Parent'}</p>
                      <p className="mt-1 text-sm text-slate-500">{link.parent?.phone || link.parent?.email || 'Contact non renseigne'}</p>
                    </div>
                    <button onClick={() => void removeFamilyLink(link.id)} className="inline-flex items-center gap-2 self-start rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100">
                      <Trash2 size={15} /> Detacher
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormField label="Lien de parenté">
                      <select value={link.relationship} onChange={event => setFamilyLinks(current => current.map(item => item.id === link.id ? { ...item, relationship: event.target.value } : item))} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                        {RELATIONSHIP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Priorite urgence">
                      <input type="number" min={1} max={10} value={link.emergency_priority || 1} onChange={event => setFamilyLinks(current => current.map(item => item.id === link.id ? { ...item, emergency_priority: parseInt(event.target.value, 10) || 1 } : item))} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
                    </FormField>
                    <FormField label="Notes internes">
                      <input type="text" value={link.notes || ''} onChange={event => setFamilyLinks(current => current.map(item => item.id === link.id ? { ...item, notes: event.target.value } : item))} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
                    </FormField>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={link.is_primary} onChange={event => setFamilyLinks(current => current.map(item => ({ ...item, is_primary: item.id === link.id ? event.target.checked : false })))} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      Responsable principal
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={link.is_billing_contact} onChange={event => setFamilyLinks(current => current.map(item => ({ ...item, is_billing_contact: item.id === link.id ? event.target.checked : false })))} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      Contact financier
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={link.is_pickup_authorized} onChange={event => setFamilyLinks(current => current.map(item => item.id === link.id ? { ...item, is_pickup_authorized: event.target.checked } : item))} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      Autorise a recuperer l'enfant
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                <Users size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Ajouter un parent existant</h3>
                <p className="text-sm text-slate-500">Les parents sont crees dans le module Parents, puis rattaches ici.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Parent">
                <select value={linkForm.parent_id} onChange={event => setLinkForm({ ...linkForm, parent_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                  <option value="">Selectionner un parent</option>
                  {availableParents.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.last_name} {parent.first_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Lien de parenté">
                <select value={linkForm.relationship} onChange={event => setLinkForm({ ...linkForm, relationship: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                  {RELATIONSHIP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>
              <FormField label="Priorite urgence">
                <input type="number" min={1} max={10} value={linkForm.emergency_priority} onChange={event => setLinkForm({ ...linkForm, emergency_priority: parseInt(event.target.value, 10) || 1 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
              <div className="md:col-span-2 xl:col-span-3">
                <FormField label="Notes internes">
                  <input type="text" value={linkForm.notes} onChange={event => setLinkForm({ ...linkForm, notes: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
                </FormField>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={linkForm.is_primary} onChange={event => setLinkForm({ ...linkForm, is_primary: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Responsable principal
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={linkForm.is_billing_contact} onChange={event => setLinkForm({ ...linkForm, is_billing_contact: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Contact financier
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={linkForm.is_pickup_authorized} onChange={event => setLinkForm({ ...linkForm, is_pickup_authorized: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Autorise a recuperer l'enfant
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
