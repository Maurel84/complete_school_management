import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Badge from '../../components/common/Badge';
import { GRADE_TYPES, formatDate } from '../../lib/utils';
import { resolveTeacherClass, resolveParentChildren } from '../../lib/roleDataResolver';
import type { Grade, Subject, Student, Class } from '../../types';
import {
  Plus,
  Printer,
  Edit,
  Trash2,
  Table,
  FileText,
  CheckCircle2,
  Award,
  TrendingUp,
  Search,
  BookOpen,
  Users,
} from 'lucide-react';
import { buildReportCardHtml, openPrintPreview } from '../../lib/printableDocuments';

interface StudentGradeInput {
  student_id: string;
  score: number | '';
  max_score: number;
  comments: string;
  grade_id?: string;
}

export default function GradesPage() {
  const { school, academicYear } = useApp();
  const { isSuperAdmin, isAdmin, isDirector, isTeacher, isParent, role, profile } = useAuth();
  const isGeneralAdmin = isSuperAdmin || isAdmin;
  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const isParentUser = isParent || role === 'parent' || (profile?.role as any)?.name === 'parent' || profile?.account_type === 'parent';
  const canManage = (isSuperAdmin || isAdmin || isDirector || isTeacherUser) && !isParentUser;

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentChildIds, setParentChildIds] = useState<string[]>([]);

  // Tabs: 'grid' (Saisie collective par classe/matière), 'reports' (Bulletins), 'history' (Registre)
  const [tab, setTab] = useState<'grid' | 'reports' | 'history'>(isParentUser ? 'reports' : 'grid');

  // Collective Grid Selectors
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedGradeType, setSelectedGradeType] = useState('devoir');
  const [evalTitle, setEvalTitle] = useState('Devoir 1');
  const [defaultMaxScore, setDefaultMaxScore] = useState<number>(20);
  const [evalCoefficient, setEvalCoefficient] = useState<number>(1);
  const [evalDate, setEvalDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Collective Grid Row State: student_id -> { score, max_score, comments, grade_id }
  const [gridRows, setGridRows] = useState<Record<string, StudentGradeInput>>({});
  const [savingGrid, setSavingGrid] = useState(false);
  const [gridNotice, setGridNotice] = useState<string | null>(null);

  // Single Grade Modal (History tab)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [singleForm, setSingleForm] = useState({
    student_id: '',
    subject_id: '',
    class_id: '',
    score: 0,
    max_score: 20,
    coefficient: 1,
    grade_type: 'devoir',
    title: '',
    term: '1',
    comments: '',
  });

  useEffect(() => {
    if (school) fetchData();
  }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    try {
      const [gRes, subRes, stuRes, clsRes] = await Promise.all([
        supabase
          .from('grades')
          .select('*, student:students(id, first_name, last_name, matricule, class_id), subject:subjects(id, name, code)')
          .eq('school_id', sid)
          .order('date', { ascending: false }),
        supabase.from('subjects').select('*').eq('school_id', sid).order('name'),
        supabase.from('students').select('id, first_name, last_name, matricule, class_id, photo_url').eq('school_id', sid).order('last_name'),
        supabase.from('classes').select('*').eq('school_id', sid).order('name'),
      ]);

      setGrades((gRes.data as Grade[]) || []);
      setSubjects((subRes.data as Subject[]) || []);
      setStudents((stuRes.data as Student[]) || []);
      setClasses((clsRes.data as Class[]) || []);

      let autoSelectedClassId = '';
      if (isTeacherUser && profile && clsRes.data) {
        const { assignedClass } = await resolveTeacherClass(sid, profile, clsRes.data as Class[]);
        if (assignedClass) {
          autoSelectedClassId = assignedClass.id;
        }
      } else if (isParentUser && profile) {
        const { childrenIds } = await resolveParentChildren(sid, profile);
        setParentChildIds(childrenIds);
      }

      if (autoSelectedClassId) {
        setSelectedClass(autoSelectedClassId);
      } else if (clsRes.data && clsRes.data.length > 0 && !selectedClass) {
        setSelectedClass(clsRes.data[0].id);
      }
      if (subRes.data && subRes.data.length > 0 && !selectedSubject) {
        setSelectedSubject(subRes.data[0].id);
      }
    } catch (e) {
      console.error('Error fetching grades', e);
    } finally {
      setLoading(false);
    }
  }

  // Filter students for the currently selected class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.class_id === selectedClass);
  }, [students, selectedClass]);

  // Synchronize collective grid rows whenever selectors change
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;

    // Find existing grades matching: class, subject, term, grade_type and title
    const existingGrades = grades.filter(
      g =>
        g.class_id === selectedClass &&
        g.subject_id === selectedSubject &&
        g.term === selectedTerm &&
        g.grade_type === selectedGradeType &&
        (evalTitle ? g.title?.toLowerCase() === evalTitle.toLowerCase() : true)
    );

    const existingMap = new Map<string, Grade>();
    existingGrades.forEach(g => existingMap.set(g.student_id, g));

    const newRows: Record<string, StudentGradeInput> = {};
    classStudents.forEach(st => {
      const match = existingMap.get(st.id);
      if (match) {
        newRows[st.id] = {
          student_id: st.id,
          score: match.score,
          max_score: match.max_score || defaultMaxScore,
          comments: match.comments || '',
          grade_id: match.id,
        };
      } else {
        newRows[st.id] = {
          student_id: st.id,
          score: '',
          max_score: defaultMaxScore,
          comments: '',
        };
      }
    });

    setGridRows(newRows);
    setGridNotice(null);
  }, [selectedClass, selectedSubject, selectedTerm, selectedGradeType, evalTitle, defaultMaxScore, classStudents, grades]);

  function handleScoreChange(studentId: string, val: string) {
    const num = val === '' ? '' : parseFloat(val);
    setGridRows(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { student_id: studentId, score: '', max_score: defaultMaxScore, comments: '' }),
        score: num === '' ? '' : Math.max(0, num),
      },
    }));
  }

  function handleCommentChange(studentId: string, comments: string) {
    setGridRows(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { student_id: studentId, score: '', max_score: defaultMaxScore, comments: '' }),
        comments,
      },
    }));
  }

  async function handleSaveGrid() {
    if (!selectedClass || !selectedSubject || !school?.id) return;
    setSavingGrid(true);
    setGridNotice(null);

    try {
      const rowsToSave: any[] = [];
      Object.values(gridRows).forEach(row => {
        if (row.score !== '') {
          rowsToSave.push({
            ...(row.grade_id ? { id: row.grade_id } : {}),
            school_id: school.id,
            academic_year_id: academicYear?.id,
            class_id: selectedClass,
            student_id: row.student_id,
            subject_id: selectedSubject,
            term: selectedTerm,
            grade_type: selectedGradeType,
            title: evalTitle || 'Évaluation',
            score: Number(row.score),
            max_score: Number(row.max_score || defaultMaxScore),
            coefficient: Number(evalCoefficient || 1),
            comments: row.comments.trim() || null,
            date: evalDate,
          });
        }
      });

      if (rowsToSave.length === 0) {
        alert('Veuillez saisir au moins une note avant d’enregistrer.');
        setSavingGrid(false);
        return;
      }

      const { error } = await supabase.from('grades').upsert(rowsToSave);
      if (error) throw error;

      setGridNotice(`✅ ${rowsToSave.length} note(s) enregistrée(s) avec succès pour la classe !`);
      void fetchData();
    } catch (err: any) {
      alert(`Erreur d'enregistrement : ${err.message}`);
    } finally {
      setSavingGrid(false);
    }
  }

  // Statistics for the current grid
  const gridStats = useMemo(() => {
    const scores = Object.values(gridRows)
      .filter(r => r.score !== '')
      .map(r => (Number(r.score) / Number(r.max_score || 20)) * 20);

    const count = scores.length;
    if (count === 0) return { count: 0, average: 0, min: 0, max: 0, passRate: 0 };

    const sum = scores.reduce((a, b) => a + b, 0);
    const average = parseFloat((sum / count).toFixed(2));
    const min = parseFloat(Math.min(...scores).toFixed(2));
    const max = parseFloat(Math.max(...scores).toFixed(2));
    const passCount = scores.filter(s => s >= 10).length;
    const passRate = Math.round((passCount / count) * 100);

    return { count, average, min, max, passRate };
  }, [gridRows]);

  // Report Cards Calculation (Bulletins)
  const calculatedReportCards = useMemo(() => {
    if (!selectedClass) return [];

    const classGrades = grades.filter(
      g => g.class_id === selectedClass && (!selectedTerm || g.term === selectedTerm)
    );

    const list = classStudents.map(student => {
      const studentGrades = classGrades.filter(g => g.student_id === student.id);
      const subjectGradesMap: Record<string, Grade[]> = {};

      studentGrades.forEach(g => {
        if (!subjectGradesMap[g.subject_id]) subjectGradesMap[g.subject_id] = [];
        subjectGradesMap[g.subject_id].push(g);
      });

      const subjectsDetails = Object.keys(subjectGradesMap).map(subjectId => {
        const subject = subjects.find(sub => sub.id === subjectId);
        const gradesList = subjectGradesMap[subjectId];

        const devoirs = gradesList.filter(g => g.grade_type !== 'composition');
        const composition = gradesList.find(g => g.grade_type === 'composition');

        const devoirsAvg =
          devoirs.length > 0
            ? devoirs.reduce((sum, g) => sum + (g.score / (g.max_score || 20)) * 20, 0) / devoirs.length
            : 10;

        const compScore = composition ? (composition.score / (composition.max_score || 20)) * 20 : null;

        let subjectAvg = devoirsAvg;
        if (compScore !== null) {
          subjectAvg = devoirs.length > 0 ? (devoirsAvg * 2 + compScore) / 3 : compScore;
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
        overallAverage: parseFloat(overallAverage.toFixed(2)),
      };
    });

    const sorted = [...list].sort((a, b) => b.overallAverage - a.overallAverage);
    let finalCards = sorted.map((rc, idx) => ({ ...rc, rank: idx + 1 }));
    if (isParentUser && parentChildIds.length > 0) {
      finalCards = finalCards.filter(rc => parentChildIds.includes(rc.student.id));
    }
    return finalCards;
  }, [selectedClass, selectedTerm, classStudents, grades, subjects, isParentUser, parentChildIds]);

  function handlePrintReportCard(row: any) {
    if (!school) return;
    const currentClass = classes.find(c => c.id === selectedClass);
    const allAverages = calculatedReportCards.map(rc => rc.overallAverage);
    const classAvg = allAverages.length > 0 ? allAverages.reduce((a, b) => a + b, 0) / allAverages.length : 0;

    const html = buildReportCardHtml({
      school,
      student: row.student,
      academicYearName: academicYear?.name || '2026-2027',
      className: currentClass?.name || 'Classe non assignée',
      term: selectedTerm,
      subjects: row.subjects,
      overallAverage: row.overallAverage,
      rank: row.rank,
      totalStudents: calculatedReportCards.length,
      classAverage: parseFloat(classAvg.toFixed(2)),
      maxAverage: allAverages.length > 0 ? Math.max(...allAverages) : 0,
      minAverage: allAverages.length > 0 ? Math.min(...allAverages) : 0,
    });

    openPrintPreview(html);
  }

  function handlePrintGridSheet() {
    window.print();
  }

  async function handleDeleteGrade(id: string) {
    if (!isGeneralAdmin) {
      alert("Seul l'administrateur général a le droit de supprimer une note.");
      return;
    }
    if (!confirm('⚠️ Voulez-vous vraiment supprimer cette note ?')) return;

    const { error } = await supabase.from('grades').delete().eq('id', id);
    if (error) {
      alert(`Erreur : ${error.message}`);
    } else {
      void fetchData();
    }
  }

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || 'Classe';
  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Matière';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="display-font text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={26} />
            Évaluations & Notes Scolaires
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Grille de saisie collective par classe et matière, calcul de moyennes et bulletins
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'grid' && (
            <button
              onClick={handlePrintGridSheet}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-2xs transition"
            >
              <Printer size={15} /> Imprimer le relevé
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          ...(!isParentUser ? [{ key: 'grid', label: 'Grille de Saisie par Classe & Matière', icon: <Table size={16} /> }] : []),
          { key: 'reports', label: isParentUser ? 'Bulletins de mes Enfants' : 'Bulletins Trimestriels & Classement', icon: <Award size={16} /> },
          { key: 'history', label: isParentUser ? 'Registre des Notes de mes Enfants' : 'Registre Individuel des Notes', icon: <FileText size={16} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: GRILLE DE SAISIE PAR CLASSE & MATIERE */}
      {tab === 'grid' && (
        <div className="space-y-6">
          {/* Selectors Bar */}
          <div className="surface-card p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  1. Classe :
                </label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xs"
                >
                  <option value="">-- Choisir une classe --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  2. Matière :
                </label>
                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xs"
                >
                  <option value="">-- Choisir une matière --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || '-'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Trimestre :
                </label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="1">1er Trimestre</option>
                  <option value="2">2ème Trimestre</option>
                  <option value="3">3ème Trimestre</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Type d'évaluation :
                </label>
                <select
                  value={selectedGradeType}
                  onChange={e => {
                    setSelectedGradeType(e.target.value);
                    if (e.target.value === 'composition') setEvalTitle('Composition');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none"
                >
                  {GRADE_TYPES.map(gt => (
                    <option key={gt.value} value={gt.value}>
                      {gt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <label className="font-medium text-slate-600 block mb-1">Intitulé précis :</label>
                <input
                  type="text"
                  value={evalTitle}
                  onChange={e => setEvalTitle(e.target.value)}
                  placeholder="Ex: Devoir 1, Interro surprise..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="font-medium text-slate-600 block mb-1">Barème (Note sur) :</label>
                <input
                  type="number"
                  value={defaultMaxScore}
                  onChange={e => setDefaultMaxScore(parseFloat(e.target.value) || 20)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="font-medium text-slate-600 block mb-1">Coefficient :</label>
                <input
                  type="number"
                  value={evalCoefficient}
                  onChange={e => setEvalCoefficient(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="font-medium text-slate-600 block mb-1">Date d'évaluation :</label>
                <input
                  type="date"
                  value={evalDate}
                  onChange={e => setEvalDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Real-time Class Performance Banner */}
          {selectedClass && selectedSubject && classStudents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="surface-card p-4 text-center">
                <p className="text-xs text-slate-500 font-semibold uppercase">Élèves notés</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {gridStats.count} / {classStudents.length}
                </p>
              </div>
              <div className="surface-card p-4 text-center bg-blue-50/40 border border-blue-100">
                <p className="text-xs text-blue-700 font-semibold uppercase">Moyenne Classe</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">
                  {gridStats.count > 0 ? `${gridStats.average} / 20` : '-'}
                </p>
              </div>
              <div className="surface-card p-4 text-center bg-emerald-50/40 border border-emerald-100">
                <p className="text-xs text-emerald-700 font-semibold uppercase">Note Max</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">
                  {gridStats.count > 0 ? `${gridStats.max} / 20` : '-'}
                </p>
              </div>
              <div className="surface-card p-4 text-center bg-rose-50/40 border border-rose-100">
                <p className="text-xs text-rose-700 font-semibold uppercase">Note Min</p>
                <p className="text-2xl font-bold text-rose-800 mt-1">
                  {gridStats.count > 0 ? `${gridStats.min} / 20` : '-'}
                </p>
              </div>
              <div className="surface-card p-4 text-center bg-purple-50/40 border border-purple-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-purple-700 font-semibold uppercase">Taux Réussite</p>
                <p className="text-2xl font-bold text-purple-800 mt-1">
                  {gridStats.count > 0 ? `${gridStats.passRate}%` : '-'}
                </p>
              </div>
            </div>
          )}

          {gridNotice && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center justify-between">
              <span>{gridNotice}</span>
              <button onClick={() => setGridNotice(null)} className="text-xs text-emerald-700 underline">
                Fermer
              </button>
            </div>
          )}

          {/* Collective Spreadsheet Table */}
          {selectedClass && selectedSubject ? (
            classStudents.length > 0 ? (
              <div className="surface-card overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div>
                    Saisie pour la classe de <strong>{selectedClassName}</strong> en <strong>{selectedSubjectName}</strong> ({evalTitle} - Trimestre {selectedTerm})
                  </div>
                  <span className="text-slate-500">
                    💡 Tapez directement la note dans la case. La moyenne s'actualise en temps réel.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3.5 w-12 text-center">N°</th>
                        <th className="px-4 py-3.5">Élève</th>
                        <th className="px-4 py-3.5 text-center w-36">Note sur {defaultMaxScore}</th>
                        <th className="px-4 py-3.5 text-center w-32">Mention</th>
                        <th className="px-4 py-3.5">Appréciation pédagogique</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {classStudents.map((st, idx) => {
                        const row = gridRows[st.id] || {
                          student_id: st.id,
                          score: '',
                          max_score: defaultMaxScore,
                          comments: '',
                        };

                        const numScore = row.score !== '' ? Number(row.score) : null;
                        const scoreOn20 = numScore !== null ? (numScore / defaultMaxScore) * 20 : null;

                        let mentionLabel = 'Non noté';
                        let mentionClass = 'text-slate-400 bg-slate-100';

                        if (scoreOn20 !== null) {
                          if (scoreOn20 >= 16) {
                            mentionLabel = 'Très Bien';
                            mentionClass = 'text-emerald-700 bg-emerald-100 font-bold';
                          } else if (scoreOn20 >= 14) {
                            mentionLabel = 'Bien';
                            mentionClass = 'text-teal-700 bg-teal-100 font-bold';
                          } else if (scoreOn20 >= 12) {
                            mentionLabel = 'Assez Bien';
                            mentionClass = 'text-blue-700 bg-blue-100 font-semibold';
                          } else if (scoreOn20 >= 10) {
                            mentionLabel = 'Passable';
                            mentionClass = 'text-amber-700 bg-amber-100 font-semibold';
                          } else {
                            mentionLabel = 'Insuffisant';
                            mentionClass = 'text-rose-700 bg-rose-100 font-bold';
                          }
                        }

                        return (
                          <tr key={st.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 text-center font-medium text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900 text-sm">
                                {st.last_name} {st.first_name}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {st.matricule}
                              </p>
                            </td>

                            {/* Score Input */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max={defaultMaxScore}
                                  placeholder="--"
                                  value={row.score}
                                  onChange={e => handleScoreChange(st.id, e.target.value)}
                                  className="w-20 text-center font-extrabold text-slate-900 text-sm py-1.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xs"
                                />
                                <span className="text-slate-400 font-semibold text-xs">
                                  /{defaultMaxScore}
                                </span>
                              </div>
                            </td>

                            {/* Mention Badge */}
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${mentionClass}`}>
                                {mentionLabel}
                              </span>
                            </td>

                            {/* Observation / Appreciation */}
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="Appréciation pour l'élève..."
                                value={row.comments}
                                onChange={e => handleCommentChange(st.id, e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Save Button */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {gridStats.count} note(s) prêtes à être sauvegardées pour <strong>{selectedClassName}</strong>.
                  </div>
                  <button
                    onClick={() => void handleSaveGrid()}
                    disabled={savingGrid}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    <span>{savingGrid ? 'Enregistrement en cours...' : 'Enregistrer toutes les notes de la classe'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card p-12 text-center text-slate-400">
                <Users size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-700">Aucun élève trouvé dans cette classe.</p>
              </div>
            )
          ) : (
            <div className="surface-card p-12 text-center text-slate-400">
              <Table size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">Sélectionnez la Classe et la Matière ci-dessus</p>
              <p className="text-xs mt-1">La grille collective des élèves s'affichera directement pour la saisie des notes.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BULLETINS TRIMESTRIELS */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="">Sélectionner une classe</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="1">1er Trimestre</option>
                <option value="2">2ème Trimestre</option>
                <option value="3">3ème Trimestre</option>
              </select>
            </div>

            <div className="text-xs font-medium text-slate-500">
              {calculatedReportCards.length} élève(s) classé(s)
            </div>
          </div>

          {selectedClass ? (
            <DataTable
              columns={[
                {
                  key: 'rank',
                  label: 'Rang',
                  render: row => (
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        row.rank === 1
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : row.rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : row.rank === 3
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.rank}e
                    </span>
                  ),
                },
                {
                  key: 'student',
                  label: 'Élève',
                  render: row => (
                    <div>
                      <p className="font-bold text-slate-900">
                        {row.student.last_name} {row.student.first_name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{row.student.matricule}</p>
                    </div>
                  ),
                },
                {
                  key: 'overallAverage',
                  label: 'Moyenne Trimestrielle',
                  render: row => (
                    <span
                      className={`font-extrabold text-sm ${
                        row.overallAverage >= 14
                          ? 'text-emerald-700'
                          : row.overallAverage >= 10
                          ? 'text-blue-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {row.overallAverage} / 20
                    </span>
                  ),
                },
                {
                  key: 'appreciation',
                  label: 'Appréciation Générale',
                  render: row => {
                    const avg = row.overallAverage;
                    if (avg >= 16) return <span className="text-emerald-700 font-semibold text-xs">Félicitations du Conseil</span>;
                    if (avg >= 14) return <span className="text-teal-700 font-semibold text-xs">Tableau d'Honneur</span>;
                    if (avg >= 12) return <span className="text-blue-700 font-medium text-xs">Encouragements</span>;
                    if (avg >= 10) return <span className="text-slate-700 text-xs">Passable</span>;
                    return <span className="text-rose-600 font-medium text-xs">Doit intensifier ses efforts</span>;
                  },
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: row => (
                    <button
                      onClick={() => handlePrintReportCard(row)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition border border-blue-200"
                    >
                      <Printer size={13} />
                      <span>Imprimer le Bulletin</span>
                    </button>
                  ),
                },
              ]}
              data={calculatedReportCards}
              loading={loading}
            />
          ) : (
            <div className="surface-card p-12 text-center text-slate-400">
              <Award size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">Sélectionnez une classe ci-dessus</p>
              <p className="text-xs mt-1">Le classement et les bulletins trimestriels seront calculés automatiquement.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REGISTRE INDIVIDUEL DES NOTES */}
      {tab === 'history' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Élève',
                render: (g: Grade) => {
                  const s = (g as any).student || students.find(st => st.id === g.student_id);
                  return s ? `${s.last_name} ${s.first_name}` : '-';
                },
              },
              {
                key: 'subject',
                label: 'Matière',
                render: (g: Grade) => {
                  const sub = (g as any).subject || subjects.find(sb => sb.id === g.subject_id);
                  return sub?.name || '-';
                },
              },
              { key: 'title', label: 'Évaluation' },
              { key: 'term', label: 'Trimestre', render: (g: Grade) => `Trimestre ${g.term}` },
              {
                key: 'score',
                label: 'Note',
                render: (g: Grade) => (
                  <span className="font-bold text-slate-900">
                    {g.score} / {g.max_score}
                  </span>
                ),
              },
              { key: 'coefficient', label: 'Coeff.' },
              { key: 'date', label: 'Date', render: (g: Grade) => formatDate(g.date) },
              ...(isGeneralAdmin
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (g: Grade) => (
                        <button
                          onClick={() => void handleDeleteGrade(g.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Supprimer la note (Admin)"
                        >
                          <Trash2 size={15} />
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={isParentUser && parentChildIds.length > 0 ? grades.filter(g => parentChildIds.includes(g.student_id)) : grades}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
