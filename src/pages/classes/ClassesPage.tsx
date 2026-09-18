import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import type { Class, Level } from '../../types';
import { Edit, Plus, School, Trash2, Printer, ClipboardList, FileText, Eye, Search, Users } from 'lucide-react';
import {
  buildClassRosterHtml,
  buildClassAttendanceSheetHtml,
  buildClassGradeSheetHtml,
  openPrintPreview
} from '../../lib/printableDocuments';

export default function ClassesPage() {
  const { school, academicYear } = useApp();
  const [classes, setClasses] = useState<(Class & { student_count?: number })[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [form, setForm] = useState({ name: '', level_id: '', capacity: 40, room: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Class Detail & Preview Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingClass, setViewingClass] = useState<Class | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (!school) return;
    void fetchClasses();
    void fetchLevels();
  }, [school]);

  async function fetchLevels() {
    if (!school) return;
    const { data } = await supabase.from('levels').select('*').eq('school_id', school.id).order('order_index');
    setLevels((data as Level[]) || []);
  }

  async function fetchClasses() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from('classes').select('*').eq('school_id', school.id).order('name');

    if (data) {
      const enriched = await Promise.all((data as Class[]).map(async currentClass => {
        const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', currentClass.id).eq('status', 'active');
        return { ...currentClass, student_count: count || 0 };
      }));
      setClasses(enriched);
    }

    setLoading(false);
  }

  async function fetchClassStudents(classId: string) {
    if (!school) return [];
    try {
      // Step 1: Always fetch active students for this class directly with select('*')
      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('last_name');

      if (studErr) {
        console.error("Error fetching students for class", studErr);
        return [];
      }

      if (!students || students.length === 0) {
        return [];
      }

      // Filter to keep active or unarchived students
      const activeStudents = students.filter(s => !s.status || s.status.toLowerCase() === 'active' || s.status.toLowerCase() === 'inscrit');
      const targetList = activeStudents.length > 0 ? activeStudents : students;

      // Step 2: Safely enrich with parent contact info
      const studentIds = targetList.map(s => s.id);
      const parentMap: Record<string, { name: string; phone: string }> = {};

      try {
        const { data: spData } = await supabase
          .from('student_parents')
          .select('student_id, parent:parents(first_name, last_name, phone)')
          .in('student_id', studentIds);

        (spData || []).forEach((sp: any) => {
          if (sp.parent && !parentMap[sp.student_id]) {
            const p = Array.isArray(sp.parent) ? sp.parent[0] : sp.parent;
            if (p) {
              parentMap[sp.student_id] = {
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                phone: p.phone || '',
              };
            }
          }
        });
      } catch (parentErr) {
        console.warn("Could not load parent info, continuing with student list", parentErr);
      }

      return targetList.map(s => {
        const dob = s.date_of_birth || s.birth_date || '';
        return {
          id: s.id,
          matricule: s.matricule || '-',
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          sex: s.sex || 'M',
          date_of_birth: dob,
          birth_date: dob,
          parent_name: parentMap[s.id]?.name || '',
          parent_phone: parentMap[s.id]?.phone || '',
        };
      });
    } catch (e) {
      console.error("Critical error in fetchClassStudents", e);
      return [];
    }
  }

  async function openClassDetails(currentClass: Class) {
    setViewingClass(currentClass);
    setDetailModalOpen(true);
    setLoadingStudents(true);
    setStudentSearch('');
    const students = await fetchClassStudents(currentClass.id);
    setClassStudents(students);
    setLoadingStudents(false);
  }

  async function handlePrintRoster(currentClass: Class, overrideStudents?: any[]) {
    if (!school) return;
    const students = overrideStudents || (await fetchClassStudents(currentClass.id));
    const html = buildClassRosterHtml({
      school,
      className: currentClass.name,
      academicYearName: academicYear?.name || '2026-2027',
      students,
    });
    openPrintPreview(html);
  }

  async function handlePrintAttendance(currentClass: Class, overrideStudents?: any[]) {
    if (!school) return;
    const students = overrideStudents || (await fetchClassStudents(currentClass.id));
    const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const html = buildClassAttendanceSheetHtml({
      school,
      className: currentClass.name,
      monthName: currentMonth,
      academicYearName: academicYear?.name || '2026-2027',
      students,
    });
    openPrintPreview(html);
  }

  async function handlePrintGradeSheet(currentClass: Class, overrideStudents?: any[]) {
    if (!school) return;
    const students = overrideStudents || (await fetchClassStudents(currentClass.id));
    const html = buildClassGradeSheetHtml({
      school,
      className: currentClass.name,
      academicYearName: academicYear?.name || '2026-2027',
      students,
    });
    openPrintPreview(html);
  }

  function openCreate() {
    setEditMode(false);
    setSelectedClass(null);
    setNotice(null);
    setForm({ name: '', level_id: '', capacity: 40, room: '' });
    setModalOpen(true);
  }

  function openEdit(currentClass: Class) {
    setEditMode(true);
    setSelectedClass(currentClass);
    setNotice(null);
    setForm({
      name: currentClass.name,
      level_id: currentClass.level_id,
      capacity: currentClass.capacity,
      room: currentClass.room,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    const payload = {
      name: form.name,
      level_id: form.level_id || null,
      capacity: form.capacity,
      room: form.room || null,
      school_id: school.id,
      academic_year_id: academicYear?.id || null,
    };

    try {
      if (editMode && selectedClass) {
        const { error } = await supabase.from('classes').update(payload).eq('id', selectedClass.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
      }

      setModalOpen(false);
      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de l'enregistrement de la classe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(classId: string) {
    if (!confirm('Supprimer cette classe ?')) return;
    await supabase.from('classes').delete().eq('id', classId);
    await fetchClasses();
  }

  const columns = [
    {
      key: 'name',
      label: 'Classe',
      render: (currentClass: any) => (
        <button
          onClick={() => void openClassDetails(currentClass)}
          className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-left flex items-center gap-1.5"
        >
          <School size={16} className="text-blue-500" />
          {currentClass.name}
        </button>
      ),
    },
    { key: 'level_id', label: 'Niveau', render: (currentClass: any) => levels.find(level => level.id === currentClass.level_id)?.name || '-' },
    { key: 'room', label: 'Salle', render: (currentClass: any) => currentClass.room || '-' },
    { key: 'capacity', label: 'Capacité' },
    {
      key: 'student_count',
      label: 'Effectif',
      render: (currentClass: any) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{currentClass.student_count}</span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (currentClass.student_count / currentClass.capacity) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Liste & Impressions',
      render: (currentClass: any) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => void openClassDetails(currentClass)}
            title="Consulter la liste des élèves"
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
          >
            <Eye size={14} /> Aperçu Liste
          </button>
          <button
            onClick={() => void handlePrintRoster(currentClass)}
            title="Imprimer la Liste Officielle"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
          >
            <Printer size={14} /> Liste
          </button>
          <button
            onClick={() => void handlePrintAttendance(currentClass)}
            title="Imprimer la Fiche d'Appel Mensuelle"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
          >
            <ClipboardList size={14} /> Appel
          </button>
          <button onClick={() => openEdit(currentClass)} className="rounded-full p-2 text-amber-600 transition hover:bg-amber-50" title="Modifier">
            <Edit size={16} />
          </button>
          <button onClick={() => void handleDelete(currentClass.id)} className="rounded-full p-2 text-red-600 transition hover:bg-red-50" title="Supprimer">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const filteredClassStudents = classStudents.filter(s =>
    `${s.first_name} ${s.last_name} ${s.matricule}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const boysCount = classStudents.filter(s => s.sex === 'M').length;
  const girlsCount = classStudents.filter(s => s.sex === 'F').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des classes</h1>
          <p className="mt-1 text-gray-500">{classes.length} classe(s) de la Petite Section au CM2</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={18} /> Nouvelle classe
        </button>
      </div>

      {classes.length === 0 && !loading ? (
        <EmptyState icon={<School size={40} />} title="Aucune classe" description="Crée d’abord les niveaux PS à CM2 puis les classes correspondantes." />
      ) : (
        <DataTable columns={columns} data={classes as any[]} searchPlaceholder="Rechercher une classe..." searchKeys={['name', 'room']} loading={loading} />
      )}

      {/* CLASS DETAILS AND LIST PREVIEW MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Liste des élèves - Classe de ${viewingClass?.name || ''}`}
        size="lg"
      >
        <div className="space-y-5">
          {/* Header Summary Cards & Print Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 uppercase">
                  {levels.find(l => l.id === viewingClass?.level_id)?.name || 'Niveau'}
                </span>
                {viewingClass?.room && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                    Salle {viewingClass.room}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Effectif total : <strong className="text-slate-900 font-bold">{classStudents.length} élèves</strong> ({boysCount} Garçons, {girlsCount} Filles)
              </p>
            </div>

            {/* Quick Print Actions inside Modal */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => viewingClass && void handlePrintRoster(viewingClass, classStudents)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-xs"
              >
                <Printer size={14} /> Imprimer Liste
              </button>
              <button
                onClick={() => viewingClass && void handlePrintAttendance(viewingClass, classStudents)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
              >
                <ClipboardList size={14} /> Fiche d'Appel
              </button>
              <button
                onClick={() => viewingClass && void handlePrintGradeSheet(viewingClass, classStudents)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition shadow-xs"
              >
                <FileText size={14} /> Grille de Notes
              </button>
            </div>
          </div>

          {/* Search bar inside modal */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Filtrer un élève par nom, prénom ou matricule..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Student Table Preview */}
          {loadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredClassStudents.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <Users size={32} className="mx-auto mb-2 text-slate-300" />
              {studentSearch ? 'Aucun élève ne correspond à la recherche' : 'Aucun élève inscrit dans cette classe'}
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 border-b border-slate-200 text-center w-10">N°</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Matricule</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Nom & Prénoms</th>
                    <th className="py-2.5 px-3 border-b border-slate-200 text-center">Sexe</th>
                    <th className="py-2.5 px-3 border-b border-slate-200 text-center">Né(e) le</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Parent / Tuteur</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClassStudents.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-2 px-3 font-mono text-xs font-semibold text-slate-600">{s.matricule}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{s.last_name.toUpperCase()} {s.first_name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.sex === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.sex}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-xs text-slate-600">
                        {s.birth_date ? new Date(s.birth_date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-700">{s.parent_name || '-'}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-600">{s.parent_phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* CREATE / EDIT CLASS MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Modifier la classe' : 'Nouvelle classe'}
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              Annuler
            </button>
            <button onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {notice && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800 font-medium animate-in">
              {notice}
            </div>
          )}
          <FormField label="Nom de la classe" required>
            <input type="text" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex: CP A" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
          <FormField label="Niveau" required>
            <select value={form.level_id} onChange={event => setForm({ ...form, level_id: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Sélectionner un niveau</option>
              {levels.map(level => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Capacité maximale">
            <input type="number" value={form.capacity} onChange={event => setForm({ ...form, capacity: parseInt(event.target.value, 10) || 40 })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
          <FormField label="Salle">
            <input type="text" value={form.room} onChange={event => setForm({ ...form, room: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
