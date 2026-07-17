import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { GRADE_TYPES } from '../../lib/utils';
import type { Grade, Subject, Student, Class } from '../../types';
import { Plus, ClipboardList, Printer } from 'lucide-react';
import { buildReportCardHtml, openPrintPreview } from '../../lib/printableDocuments';

export default function GradesPage() {
  const { school, academicYear } = useApp();
  const { isAdmin, isDirector, isTeacher } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [tab, setTab] = useState<'grades' | 'reports'>('grades');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [form, setForm] = useState({
    student_id: '', subject_id: '', class_id: '', score: 0, max_score: 20,
    coefficient: 1, grade_type: 'devoir', title: '', term: '1', comments: '',
  });

  useEffect(() => { if (school) fetchData(); }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [gRes, subRes, stuRes, clsRes] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id', sid).order('date', { ascending: false }),
      supabase.from('subjects').select('*').eq('school_id', sid),
      supabase.from('students').select('id, first_name, last_name, matricule, class_id').eq('school_id', sid).eq('status', 'active'),
      supabase.from('classes').select('*').eq('school_id', sid),
    ]);
    setGrades((gRes.data as Grade[]) || []);
    setSubjects((subRes.data as Subject[]) || []);
    setStudents((stuRes.data as Student[]) || []);
    setClasses((clsRes.data as Class[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('grades').insert({
      ...form,
      school_id: school!.id,
      academic_year_id: academicYear?.id,
      date: new Date().toISOString().split('T')[0],
    });
    setSaving(false); setModalOpen(false); fetchData();
  }

  const filteredGrades = selectedClass
    ? grades.filter(g => g.class_id === selectedClass)
    : grades;

  const columns = [
    { key: 'student_id', label: 'Élève', render: (g: Grade) => {
      const s = students.find(s => s.id === g.student_id);
      return s ? `${s.last_name} ${s.first_name}` : '-';
    }},
    { key: 'subject_id', label: 'Matière', render: (g: Grade) => subjects.find(s => s.id === g.subject_id)?.name || '-' },
    { key: 'title', label: 'Intitulé' },
    { key: 'grade_type', label: 'Type', render: (g: Grade) => GRADE_TYPES.find(t => t.value === g.grade_type)?.label || g.grade_type },
    { key: 'score', label: 'Note', render: (g: Grade) => <span className="font-medium">{g.score}/{g.max_score}</span> },
    { key: 'coefficient', label: 'Coeff.' },
    { key: 'term', label: 'Trimestre' },
  ];

  const calculatedReportCards = useMemo(() => {
    if (!selectedClass || !selectedTerm) return [];

    const classStudents = students.filter(s => s.class_id === selectedClass);
    const classGrades = grades.filter(g => g.class_id === selectedClass && g.term === selectedTerm);

    const reportCardsList = classStudents.map(student => {
      const studentGrades = classGrades.filter(g => g.student_id === student.id);
      
      const subjectGradesMap: Record<string, Grade[]> = {};
      studentGrades.forEach(g => {
        if (!subjectGradesMap[g.subject_id]) {
          subjectGradesMap[g.subject_id] = [];
        }
        subjectGradesMap[g.subject_id].push(g);
      });

      const subjectsDetails = Object.keys(subjectGradesMap).map(subjectId => {
        const subject = subjects.find(sub => sub.id === subjectId);
        const gradesList = subjectGradesMap[subjectId];
        
        const devoirs = gradesList.filter(g => g.grade_type !== 'composition');
        const composition = gradesList.find(g => g.grade_type === 'composition');

        const devoirsAvg = devoirs.length > 0
          ? devoirs.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / devoirs.length
          : 10;
        
        const compScore = composition ? (composition.score / composition.max_score) * 20 : null;

        let subjectAvg = devoirsAvg;
        if (compScore !== null) {
          if (devoirs.length > 0) {
            subjectAvg = (devoirsAvg * 2 + compScore) / 3;
          } else {
            subjectAvg = compScore;
          }
        }

        const coefficient = gradesList[0]?.coefficient || 1;
        const weightedScore = subjectAvg * coefficient;

        return {
          name: subject?.name || 'Matière',
          devoirsAvg,
          compScore,
          subjectAvg,
          coefficient,
          weightedScore,
        };
      });

      const totalCoeff = subjectsDetails.reduce((sum, s) => sum + s.coefficient, 0);
      const totalWeighted = subjectsDetails.reduce((sum, s) => sum + s.weightedScore, 0);
      const overallAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

      return {
        student,
        subjects: subjectsDetails,
        overallAverage,
      };
    });

    const sorted = [...reportCardsList].sort((a, b) => b.overallAverage - a.overallAverage);
    
    const averages = sorted.map(rc => rc.overallAverage);
    const maxAverage = averages.length > 0 ? Math.max(...averages) : 0;
    const minAverage = averages.length > 0 ? Math.min(...averages) : 0;
    const classAverage = averages.length > 0 ? averages.reduce((sum, a) => sum + a, 0) / averages.length : 0;

    return sorted.map((rc, idx) => ({
      ...rc,
      rank: idx + 1,
      totalStudents: sorted.length,
      classAverage,
      maxAverage,
      minAverage,
    }));
  }, [selectedClass, selectedTerm, students, grades, subjects]);

  function handlePrintReportCard(rc: any) {
    if (!school) return;
    const cls = classes.find(c => c.id === selectedClass);
    const html = buildReportCardHtml({
      school,
      student: rc.student,
      className: cls?.name || 'Classe',
      academicYearName: academicYear?.name || 'En cours',
      term: selectedTerm,
      subjects: rc.subjects,
      overallAverage: rc.overallAverage,
      rank: rc.rank,
      totalStudents: rc.totalStudents,
      classAverage: rc.classAverage,
      maxAverage: rc.maxAverage,
      minAverage: rc.minAverage,
    });
    openPrintPreview(html);
  }

  const reportColumns = [
    { key: 'rank', label: 'Rang', render: (rc: any) => <span className="font-bold text-slate-800">{rc.rank}<sup>{rc.rank === 1 ? 'er' : 'ème'}</sup></span> },
    { key: 'student', label: 'Élève', render: (rc: any) => `${rc.student.last_name} ${rc.student.first_name}` },
    { key: 'overallAverage', label: 'Moyenne générale', render: (rc: any) => <span className="font-semibold text-slate-900">{rc.overallAverage.toFixed(2)} / 20</span> },
    { key: 'honor', label: 'Mention / Décision', render: (rc: any) => {
      const avg = rc.overallAverage;
      if (avg >= 16) return <span className="text-emerald-600 font-bold">Félicitations</span>;
      if (avg >= 14) return <span className="text-emerald-500 font-semibold">Encouragements</span>;
      if (avg >= 12) return <span className="text-blue-500 font-semibold">Tableau d'honneur</span>;
      if (avg >= 10) return <span className="text-slate-600">Moyen</span>;
      return <span className="text-red-500 font-medium">Insuffisant</span>;
    }},
    {
      key: 'actions',
      label: 'Actions',
      render: (rc: any) => (
        <button
          onClick={() => handlePrintReportCard(rc)}
          className="rounded-full p-2 text-blue-600 transition hover:bg-blue-50"
          title="Imprimer le Bulletin"
        >
          <Printer size={15} />
        </button>
      ),
    },
  ];

  const classStudents = selectedClass
    ? students.filter(s => s.class_id === selectedClass)
    : students;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes & Bulletins</h1>
          <p className="text-gray-500 mt-1">Gestion des évaluations et des bulletins scolaires</p>
        </div>
        {tab === 'grades' && (isAdmin || isDirector || isTeacher) && (
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={18} /> Nouvelle note
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        <button
          onClick={() => setTab('grades')}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === 'grades'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
              : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          Saisie des notes
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === 'reports'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
              : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          Bulletins Trimestriels
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Classe</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
            <option value="">Sélectionner une classe</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {tab === 'reports' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Trimestre</label>
            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
              <option value="1">1er Trimestre</option>
              <option value="2">2ème Trimestre</option>
              <option value="3">3ème Trimestre</option>
            </select>
          </div>
        )}
      </div>

      {tab === 'grades' ? (
        <DataTable columns={columns} data={filteredGrades as any[]} searchKeys={['title']} searchPlaceholder="Rechercher une note..." loading={loading} />
      ) : selectedClass ? (
        <DataTable columns={reportColumns} data={calculatedReportCards} searchKeys={['student.last_name']} searchPlaceholder="Rechercher un élève..." loading={loading} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
          Veuillez sélectionner une classe pour calculer les bulletins scolaires.
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle note" size="lg"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Classe" required>
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Élève" required>
            <select value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {classStudents.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>)}
            </select>
          </FormField>
          <FormField label="Matière" required>
            <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Type d'évaluation">
            <select value={form.grade_type} onChange={e => setForm({...form, grade_type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {GRADE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Intitulé"><input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex: Devoir 1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Trimestre">
            <select value={form.term} onChange={e => setForm({...form, term: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="1">1er Trimestre</option>
              <option value="2">2ème Trimestre</option>
              <option value="3">3ème Trimestre</option>
            </select>
          </FormField>
          <FormField label="Note" required><input type="number" step="0.5" value={form.score} onChange={e => setForm({...form, score: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Note maximum"><input type="number" value={form.max_score} onChange={e => setForm({...form, max_score: parseFloat(e.target.value) || 20})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Coefficient"><input type="number" value={form.coefficient} onChange={e => setForm({...form, coefficient: parseFloat(e.target.value) || 1})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Commentaire"><textarea value={form.comments} onChange={e => setForm({...form, comments: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
