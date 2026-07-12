import { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import {
  buildStudentCardHtml,
  downloadTextDocument,
  openPrintPreview,
  sanitizeDocumentName,
} from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { recordAuditLog } from '../../lib/audit';
import type { Class, Student } from '../../types';
import {
  Download,
  Edit,
  Eye,
  GraduationCap,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { useStudents, useStudentFamilyLinks } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useParents } from '../../hooks/useParents';
import StudentFormModal from './components/StudentFormModal';
import StudentDetailModal from './components/StudentDetailModal';
import FamilyModal from './components/FamilyModal';

type StudentListItem = Student & { class?: Pick<Class, 'id' | 'name'>; family_count: number };

export default function StudentsPage() {
  const { school, academicYear } = useApp();
  const { isAdmin, isSuperAdmin, isDirector, isSupervisor, profile } = useAuth();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const canManageStudents = isSuperAdmin || isAdmin || isDirector || isSupervisor;

  // Custom Hooks with TanStack Query
  const {
    studentsQuery,
    saveStudent,
    isSaving,
    archiveStudent,
  } = useStudents(school?.id);

  const { data: classes = [] } = useClasses(school?.id);
  const { data: parents = [] } = useParents(school?.id);

  const {
    familyLinksQuery,
    saveFamilyLinks,
    isSavingLinks,
    removeFamilyLink,
  } = useStudentFamilyLinks(selectedStudent?.id, school?.id);

  const students = (studentsQuery.data || []) as StudentListItem[];
  const familyLinks = familyLinksQuery.data || [];
  const loading = studentsQuery.isLoading;

  function openCreate() {
    setEditMode(false);
    setSelectedStudent(null);
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditMode(true);
    setSelectedStudent(student);
    setModalOpen(true);
  }

  function openDetail(student: Student) {
    setSelectedStudent(student);
    setDetailOpen(true);
  }

  async function handleSaveStudent(form: any) {
    if (!school) return;
    try {
      await saveStudent({
        form,
        studentId: editMode && selectedStudent ? selectedStudent.id : undefined,
        profile,
        studentCount: students.length,
      });
      setModalOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Failed to save student', error);
      throw error;
    }
  }

  async function handleDeleteStudent(id: string) {
    if (!school || !confirm('Archiver cet élève ?')) return;
    try {
      await archiveStudent({ id, profile });
    } catch (error) {
      console.error('Failed to archive student', error);
    }
  }

  async function handleSaveFamilyLinks(updatedLinks: any[], linkForm: any) {
    if (!school || !selectedStudent) return;
    try {
      await saveFamilyLinks({
        familyLinks: updatedLinks,
        linkForm,
        profile,
      });
      setFamilyModalOpen(false);
    } catch (error) {
      console.error('Failed to save family links', error);
    }
  }

  async function handleRemoveFamilyLink(linkId: string) {
    if (!school || !selectedStudent || !confirm('Détacher ce parent de l\'élève ?')) return;
    try {
      await removeFamilyLink({ linkId, profile });
    } catch (error) {
      console.error('Failed to remove family link', error);
    }
  }

  async function handleStudentCardAction(mode: 'print' | 'download') {
    if (!school || !selectedStudent) return;

    const primaryGuardian =
      familyLinks.find(link => link.is_billing_contact)?.parent ||
      familyLinks.find(link => link.is_primary)?.parent ||
      familyLinks[0]?.parent;

    const html = buildStudentCardHtml({
      school,
      student: selectedStudent,
      academicYearName: academicYear?.name,
      className: (selectedStudent as any).class?.name,
      primaryGuardian: primaryGuardian
        ? `${primaryGuardian.first_name} ${primaryGuardian.last_name}`
        : undefined,
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
    [parents, familyLinks]
  );

  const columns: Column<StudentListItem>[] = [
    {
      key: 'identity',
      label: 'Élève',
      render: (student: StudentListItem) => (
        <div className="flex items-center gap-3">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={`${student.first_name} ${student.last_name}`}
              className="h-11 w-11 rounded-2xl object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
              {student.first_name[0]}
              {student.last_name[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900">
              {student.first_name} {student.last_name}
            </p>
            <p className="text-xs text-slate-500">{student.matricule}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      label: 'Classe',
      render: (student: StudentListItem) => student.class?.name || '-',
    },
    {
      key: 'sex',
      label: 'Sexe',
      render: (student: StudentListItem) => (student.sex === 'M' ? 'Masculin' : 'Féminin'),
    },
    {
      key: 'family_count',
      label: 'Famille',
      render: (student: StudentListItem) => (
        <span className="font-medium">{student.family_count} lien(s)</span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (student: StudentListItem) => <Badge status={student.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (student: StudentListItem) => (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => openDetail(student)}
            className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50"
          >
            <Eye size={16} />
          </button>
          {canManageStudents && (
            <button
              onClick={() => openEdit(student)}
              className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50"
            >
              <Edit size={16} />
            </button>
          )}
          {canManageStudents && (
            <button
              onClick={() => void handleDeleteStudent(student.id)}
              className="rounded-xl p-2 text-red-600 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">
              Dossiers élèves & identités
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Chaque élève dispose maintenant d'un dossier plus riche avec photo, famille rattachée,
              carte scolaire imprimable et informations prêtes pour les documents officiels.
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Vision dossier complet</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                <p className="text-xs text-slate-500">Élèves suivis</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {students.filter(student => Boolean(student.photo_url)).length}
                </p>
                <p className="text-xs text-slate-500">Photos chargées</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {students.reduce((sum, student) => sum + student.family_count, 0)}
                </p>
                <p className="text-xs text-slate-500">Liens famille</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Population scolaire</h2>
          <p className="mt-1 text-sm text-slate-500">{students.length} élève(s) inscrit(s)</p>
        </div>
        {canManageStudents && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={16} /> Nouvel élève
          </button>
        )}
      </div>

      {students.length === 0 && !loading ? (
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Aucun élève"
          description="Commence par inscrire les élèves, ajouter leur photo et relier leur famille pour obtenir des dossiers complets."
          action={
            canManageStudents ? (
              <button
                onClick={openCreate}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Inscrire un élève
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchPlaceholder="Rechercher un élève..."
          searchKeys={['matricule', 'first_name', 'last_name']}
          loading={loading}
        />
      )}

      {/* Componentized Modals */}
      {school && (
        <StudentFormModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          schoolId={school.id}
          classes={classes}
          onSave={handleSaveStudent}
          saving={isSaving}
        />
      )}

      {selectedStudent && (
        <StudentDetailModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          familyLinks={familyLinks}
          loading={familyLinksQuery.isLoading}
          canManageStudents={canManageStudents}
          onManageFamilyClick={() => {
            setDetailOpen(false);
            setFamilyModalOpen(true);
          }}
          onStudentCardAction={handleStudentCardAction}
          academicYear={academicYear}
          school={school}
        />
      )}

      {selectedStudent && (
        <FamilyModal
          isOpen={familyModalOpen}
          onClose={() => {
            setFamilyModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          familyLinks={familyLinks}
          availableParents={availableParents}
          onSaveLinks={handleSaveFamilyLinks}
          onRemoveLink={handleRemoveFamilyLink}
          saving={isSavingLinks}
        />
      )}
    </div>
  );
}
