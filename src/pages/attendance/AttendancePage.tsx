import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import { formatDate } from '../../lib/utils';
import { resolveTeacherClass, resolveParentChildren } from '../../lib/roleDataResolver';
import type { Attendance, DisciplineRecord, Student, Class } from '../../types';
import {
  CalendarCheck,
  Plus,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileSpreadsheet,
  ShieldAlert,
  Send,
  Printer,
  Search,
  MessageSquare,
  Copy,
  ExternalLink,
  Sparkles,
  Check,
} from 'lucide-react';

interface AttendanceRowState {
  student_id: string;
  status: 'present' | 'absent' | 'late';
  reason: string;
  justified: boolean;
  attendance_id?: string;
}

export default function AttendancePage() {
  const { school } = useApp();
  const { isSuperAdmin, isAdmin, isDirector, isSupervisor, isTeacher, isParent, role, profile } = useAuth();
  const isGeneralAdmin = isSuperAdmin || isAdmin;
  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const isParentUser = isParent || role === 'parent' || (profile?.role as any)?.name === 'parent' || profile?.account_type === 'parent';
  const canManage = (isSuperAdmin || isAdmin || isDirector || isSupervisor || isTeacherUser) && !isParentUser;

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sheet' | 'history' | 'discipline'>(isParentUser ? 'history' : 'sheet');
  const [parentChildIds, setParentChildIds] = useState<string[]>([]);

  // Sheet Controls
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sheetSession, setSheetSession] = useState<'journee' | 'matin' | 'apres_midi'>('journee');
  const [sheetRows, setSheetRows] = useState<Record<string, AttendanceRowState>>({});
  const [savingSheet, setSavingSheet] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // WhatsApp Alert Modal state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [absentStudentsList, setAbsentStudentsList] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // History Filters
  const [historyClassFilter, setHistoryClassFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  // Discipline Modal state
  const [disciplineModal, setDisciplineModal] = useState(false);
  const [savingDiscipline, setSavingDiscipline] = useState(false);
  const [discForm, setDiscForm] = useState({
    student_id: '',
    type: 'observation',
    description: '',
    sanction: '',
    parent_notified: false,
  });

  useEffect(() => {
    if (school) fetchData();
  }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    try {
      const [attRes, discRes, stuRes, clsRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('*, student:students(id, first_name, last_name, matricule, class_id, class:classes(name))')
          .eq('school_id', sid)
          .order('date', { ascending: false })
          .limit(1000),
        supabase
          .from('discipline_records')
          .select('*, student:students(id, first_name, last_name, matricule, class_id, class:classes(name))')
          .eq('school_id', sid)
          .order('date', { ascending: false })
          .limit(500),
        supabase
          .from('students')
          .select('id, first_name, last_name, matricule, class_id, photo_url, phone, student_parents(parent:parents(*))')
          .eq('school_id', sid)
          .order('last_name'),
        supabase.from('classes').select('*').eq('school_id', sid).order('name'),
      ]);

      setAttendance((attRes.data as Attendance[]) || []);
      setDiscipline((discRes.data as DisciplineRecord[]) || []);
      setStudents((stuRes.data as unknown as Student[]) || []);
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
    } catch (e) {
      console.error('Error fetching attendance data', e);
    } finally {
      setLoading(false);
    }
  }

  // Filter students for the selected class in the sheet
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.class_id === selectedClass);
  }, [students, selectedClass]);

  // Synchronize sheetRows whenever selectedClass, selectedDate or attendance changes
  useEffect(() => {
    if (!selectedClass) return;

    // Existing attendance records for this class on this date
    const existingMap = new Map<string, Attendance>();
    attendance.forEach(a => {
      if (a.date === selectedDate) {
        existingMap.set(a.student_id, a);
      }
    });

    const newRows: Record<string, AttendanceRowState> = {};
    classStudents.forEach(st => {
      const existing = existingMap.get(st.id);
      if (existing) {
        newRows[st.id] = {
          student_id: st.id,
          status: (existing.status as any) || 'present',
          reason: existing.reason || '',
          justified: Boolean(existing.justified),
          attendance_id: existing.id,
        };
      } else {
        newRows[st.id] = {
          student_id: st.id,
          status: 'present', // Default to present
          reason: '',
          justified: false,
        };
      }
    });

    setSheetRows(newRows);
    setSaveSuccessNotice(null);
  }, [selectedClass, selectedDate, classStudents, attendance]);

  // Bulk actions on sheet
  function markAllStatus(status: 'present' | 'absent' | 'late') {
    setSheetRows(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(sId => {
        updated[sId] = {
          ...updated[sId],
          status,
          reason: status === 'present' ? '' : updated[sId].reason,
          justified: status === 'present' ? false : updated[sId].justified,
        };
      });
      return updated;
    });
  }

  function updateStudentRow(studentId: string, updates: Partial<AttendanceRowState>) {
    setSheetRows(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { student_id: studentId, status: 'present', reason: '', justified: false }),
        ...updates,
      },
    }));
  }

  async function handleSaveSheet() {
    if (!selectedClass || !school?.id) return;
    setSavingSheet(true);
    setSaveSuccessNotice(null);

    try {
      const upsertList = Object.values(sheetRows).map(row => ({
        ...(row.attendance_id ? { id: row.attendance_id } : {}),
        student_id: row.student_id,
        school_id: school.id,
        class_id: selectedClass,
        date: selectedDate,
        status: row.status,
        reason: row.status === 'present' ? null : row.reason.trim() || null,
        justified: row.status === 'present' ? false : row.justified,
      }));

      // Upsert records
      const { error } = await supabase.from('attendance').upsert(upsertList);
      if (error) throw error;

      // Prepare absents and lates for WhatsApp alerts
      const absentsAndLates = classStudents
        .filter(st => {
          const r = sheetRows[st.id];
          return r && (r.status === 'absent' || r.status === 'late');
        })
        .map(st => {
          const r = sheetRows[st.id];
          const sp = (st as any).student_parents || [];
          const parentObj = sp[0]?.parent;
          const phone = parentObj?.phone || st.phone || '';
          const parentName = parentObj ? `${parentObj.first_name || ''} ${parentObj.last_name || ''}`.trim() : 'Parent';
          const className = classes.find(c => c.id === selectedClass)?.name || '';
          return {
            student: st,
            status: r.status,
            reason: r.reason,
            parentName,
            phone,
            className,
          };
        });

      if (absentsAndLates.length > 0) {
        setAbsentStudentsList(absentsAndLates);
        setWhatsappModalOpen(true);
        setSaveSuccessNotice(`✅ Appel enregistré ! ${absentsAndLates.length} notification(s) d'absence/retard prêtes à être envoyées par WhatsApp.`);
      } else {
        setSaveSuccessNotice(`✅ Feuille d'appel enregistrée avec succès pour le ${formatDate(selectedDate)} (100% de présence) !`);
      }
      void fetchData();
    } catch (err: any) {
      alert(`Erreur d'enregistrement : ${err.message}`);
    } finally {
      setSavingSheet(false);
    }
  }

  function openWhatsappModal() {
    const list = classStudents
      .filter(st => {
        const r = sheetRows[st.id];
        return r && (r.status === 'absent' || r.status === 'late');
      })
      .map(st => {
        const r = sheetRows[st.id];
        const sp = (st as any).student_parents || [];
        const parentObj = sp[0]?.parent;
        const phone = parentObj?.phone || st.phone || '';
        const parentName = parentObj ? `${parentObj.first_name || ''} ${parentObj.last_name || ''}`.trim() : 'Parent';
        const className = classes.find(c => c.id === selectedClass)?.name || '';
        return {
          student: st,
          status: r?.status || 'absent',
          reason: r?.reason || '',
          parentName,
          phone,
          className,
        };
      });
    setAbsentStudentsList(list);
    setWhatsappModalOpen(true);
  }

  function getWhatsappUrl(item: any) {
    let cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10 && (cleanPhone.startsWith('07') || cleanPhone.startsWith('05') || cleanPhone.startsWith('01'))) {
      cleanPhone = '225' + cleanPhone;
    }
    const schoolName = school?.name || "l'école";
    const statusLabel = item.status === 'absent' ? 'absent(e)' : 'en retard';
    const text = `Bonjour M./Mme ${item.parentName}, nous vous informons que votre enfant ${item.student.first_name} ${item.student.last_name} a été noté(e) ${statusLabel} ce jour (${formatDate(selectedDate)}) en classe de ${item.className} à ${schoolName}.${item.reason ? ` Motif : ${item.reason}.` : ''} En cas de justification, merci de contacter la vie scolaire au ${school?.phone || 'la direction'}. Cordialement.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }

  function copyMessage(item: any) {
    const schoolName = school?.name || "l'école";
    const statusLabel = item.status === 'absent' ? 'absent(e)' : 'en retard';
    const text = `Bonjour M./Mme ${item.parentName}, nous vous informons que votre enfant ${item.student.first_name} ${item.student.last_name} a été noté(e) ${statusLabel} ce jour (${formatDate(selectedDate)}) en classe de ${item.className} à ${schoolName}.${item.reason ? ` Motif : ${item.reason}.` : ''} En cas de justification, merci de contacter la vie scolaire au ${school?.phone || 'la direction'}. Cordialement.`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.student.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Statistics for current sheet
  const sheetStats = useMemo(() => {
    const rows = Object.values(sheetRows);
    const total = rows.length;
    const present = rows.filter(r => r.status === 'present').length;
    const absent = rows.filter(r => r.status === 'absent').length;
    const late = rows.filter(r => r.status === 'late').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;
    return { total, present, absent, late, rate };
  }, [sheetRows]);

  // Discipline Handlers
  async function handleSaveDiscipline() {
    if (!discForm.student_id || !discForm.description) {
      alert('Veuillez sélectionner un élève et renseigner la description.');
      return;
    }
    setSavingDiscipline(true);
    try {
      const { error } = await supabase.from('discipline_records').insert({
        ...discForm,
        school_id: school!.id,
        date: selectedDate,
      });
      if (error) throw error;

      setDisciplineModal(false);
      setDiscForm({
        student_id: '',
        type: 'observation',
        description: '',
        sanction: '',
        parent_notified: false,
      });
      void fetchData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setSavingDiscipline(false);
    }
  }

  async function handleDeleteAttendance(id: string) {
    if (!isGeneralAdmin) {
      alert("Seul l'administrateur général a le droit de supprimer une fiche d'absence.");
      return;
    }
    if (!confirm('⚠️ Supprimer définitivement cet enregistrement de présence ?')) return;
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) {
      alert(`Erreur : ${error.message}`);
    } else {
      void fetchData();
    }
  }

  async function handleDeleteDiscipline(id: string) {
    if (!isGeneralAdmin) {
      alert("Seul l'administrateur général a le droit de supprimer un incident disciplinaire.");
      return;
    }
    if (!confirm('⚠️ Supprimer cet enregistrement disciplinaire ?')) return;
    const { error } = await supabase.from('discipline_records').delete().eq('id', id);
    if (error) {
      alert(`Erreur : ${error.message}`);
    } else {
      void fetchData();
    }
  }

  // Filtered History
  const filteredHistory = useMemo(() => {
    return attendance.filter(a => {
      if (isParentUser && parentChildIds.length > 0 && !parentChildIds.includes(a.student_id)) {
        return false;
      }
      const student = (a as any).student || students.find(s => s.id === a.student_id);
      const matchClass = !historyClassFilter || student?.class_id === historyClassFilter;
      const matchStatus = historyStatusFilter === 'all' || a.status === historyStatusFilter;
      const name = `${student?.first_name || ''} ${student?.last_name || ''} ${student?.matricule || ''}`.toLowerCase();
      const matchSearch = !historySearch || name.includes(historySearch.toLowerCase());
      return matchClass && matchStatus && matchSearch;
    });
  }, [attendance, students, historyClassFilter, historyStatusFilter, historySearch, isParentUser, parentChildIds]);

  const statusLabels: Record<string, string> = { present: 'Présent', absent: 'Absent', late: 'En retard' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="display-font text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="text-emerald-600" size={26} />
            Présences & Vie Scolaire
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Feuille d'appel collective par classe, registre d'assiduité et suivi disciplinaire
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDisciplineModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold border border-rose-200 shadow-2xs transition"
            >
              <AlertTriangle size={15} /> Signaler un incident
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'sheet', label: "Feuille d'Appel par Classe", icon: <CalendarCheck size={16} /> },
          { key: 'history', label: 'Registre & Historique', icon: <FileSpreadsheet size={16} /> },
          { key: 'discipline', label: 'Discipline & Sanctions', icon: <ShieldAlert size={16} /> },
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

      {/* TAB 1: FEUILLE D'APPEL PAR CLASSE */}
      {tab === 'sheet' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="surface-card p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  1. Sélectionner la Classe :
                </label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                >
                  <option value="">-- Choisir une classe --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  2. Date de l'appel :
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  3. Séance :
                </label>
                <select
                  value={sheetSession}
                  onChange={e => setSheetSession(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                >
                  <option value="journee">Journée entière</option>
                  <option value="matin">Matinée (08h - 12h)</option>
                  <option value="apres_midi">Après-midi (14h - 17h)</option>
                </select>
              </div>

              <div>
                <button
                  onClick={() => markAllStatus('present')}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <UserCheck size={16} className="text-emerald-600" />
                  <span>Tous Présents</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats Banner */}
          {selectedClass && classStudents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="surface-card p-4 text-center">
                <p className="text-xs text-slate-500 font-semibold uppercase">Effectif</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{sheetStats.total}</p>
              </div>
              <div className="surface-card p-4 text-center bg-emerald-50/40 border border-emerald-100">
                <p className="text-xs text-emerald-700 font-semibold uppercase">Présents</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">{sheetStats.present}</p>
              </div>
              <div className="surface-card p-4 text-center bg-rose-50/40 border border-rose-100">
                <p className="text-xs text-rose-700 font-semibold uppercase">Absents</p>
                <p className="text-2xl font-bold text-rose-800 mt-1">{sheetStats.absent}</p>
              </div>
              <div className="surface-card p-4 text-center bg-amber-50/40 border border-amber-100">
                <p className="text-xs text-amber-700 font-semibold uppercase">En Retard</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">{sheetStats.late}</p>
              </div>
              <div className="surface-card p-4 text-center bg-blue-50/40 border border-blue-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-blue-700 font-semibold uppercase">Assiduité</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">{sheetStats.rate}%</p>
              </div>
            </div>
          )}

          {/* WhatsApp Alert Action Banner */}
          {selectedClass && classStudents.length > 0 && sheetStats.absent + sheetStats.late > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                  <MessageSquare size={18} />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {sheetStats.absent + sheetStats.late} élève(s) non présent(s) sur cette séance
                  </p>
                  <p className="text-xs text-slate-600">
                    Alertez instantanément les parents sur WhatsApp en 1 clic pour un suivi proactif
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openWhatsappModal}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <MessageSquare size={15} />
                <span>Envoyer alertes WhatsApp ({sheetStats.absent + sheetStats.late})</span>
              </button>
            </div>
          )}

          {saveSuccessNotice && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center justify-between">
              <span>{saveSuccessNotice}</span>
              <button onClick={() => setSaveSuccessNotice(null)} className="text-xs text-emerald-700 underline">
                Fermer
              </button>
            </div>
          )}

          {/* Student Roll Call Table */}
          {selectedClass ? (
            classStudents.length > 0 ? (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3.5 w-12 text-center">N°</th>
                        <th className="px-4 py-3.5">Élève</th>
                        <th className="px-4 py-3.5 text-center">Statut d'assiduité</th>
                        <th className="px-4 py-3.5">Motif / Commentaire</th>
                        <th className="px-4 py-3.5 text-center w-28">Justifié</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {classStudents.map((st, idx) => {
                        const row = sheetRows[st.id] || {
                          student_id: st.id,
                          status: 'present',
                          reason: '',
                          justified: false,
                        };

                        return (
                          <tr
                            key={st.id}
                            className={`transition ${
                              row.status === 'absent'
                                ? 'bg-rose-50/30'
                                : row.status === 'late'
                                ? 'bg-amber-50/30'
                                : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="px-4 py-3.5 text-center font-medium text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                {st.photo_url ? (
                                  <img
                                    src={st.photo_url}
                                    alt={st.first_name}
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                                    {st.first_name?.charAt(0)}
                                    {st.last_name?.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">
                                    {st.last_name} {st.first_name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {st.matricule}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Status Buttons */}
                            <td className="px-4 py-3.5 text-center">
                              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateStudentRow(st.id, { status: 'present' })}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    row.status === 'present'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-emerald-700'
                                  }`}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Présent</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStudentRow(st.id, { status: 'absent' })}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    row.status === 'absent'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-rose-700'
                                  }`}
                                >
                                  <XCircle size={13} />
                                  <span>Absent</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStudentRow(st.id, { status: 'late' })}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    row.status === 'late'
                                      ? 'bg-amber-600 text-white shadow-xs'
                                      : 'text-slate-600 hover:text-amber-700'
                                  }`}
                                >
                                  <Clock size={13} />
                                  <span>Retard</span>
                                </button>
                              </div>
                            </td>

                            {/* Reason Input */}
                            <td className="px-4 py-3.5">
                              {row.status !== 'present' ? (
                                <input
                                  type="text"
                                  placeholder={row.status === 'absent' ? "Motif de l'absence..." : 'Arrivé à quelle heure ?'}
                                  value={row.reason}
                                  onChange={e => updateStudentRow(st.id, { reason: e.target.value })}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                              ) : (
                                <span className="text-slate-400 italic text-xs">Aucun motif nécessaire</span>
                              )}
                            </td>

                            {/* Justified Checkbox */}
                            <td className="px-4 py-3.5 text-center">
                              {row.status !== 'present' ? (
                                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={row.justified}
                                    onChange={e => updateStudentRow(st.id, { justified: e.target.checked })}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                  />
                                  <span className="text-xs font-medium text-slate-700">Justifié</span>
                                </label>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
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
                    Modifications apportées à la feuille d'appel du <strong>{formatDate(selectedDate)}</strong>.
                  </div>
                  <button
                    onClick={() => void handleSaveSheet()}
                    disabled={savingSheet}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    <span>{savingSheet ? 'Enregistrement...' : "Enregistrer l'appel de la classe"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card p-12 text-center text-slate-400">
                <Users size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-700">Aucun élève trouvé dans cette classe.</p>
                <p className="text-xs mt-1">Veuillez d'abord inscrire des élèves dans cette classe.</p>
              </div>
            )
          ) : (
            <div className="surface-card p-12 text-center text-slate-400">
              <CalendarCheck size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">Sélectionnez une classe ci-dessus</p>
              <p className="text-xs mt-1">La liste complète des élèves apparaîtra instantanément pour faire l'appel.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORIQUE & REGISTRE GLOBAL */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={historyClassFilter}
                onChange={e => setHistoryClassFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:outline-none"
              >
                <option value="">Toutes les classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={historyStatusFilter}
                onChange={e => setHistoryStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="absent">Absents uniquement</option>
                <option value="late">Retards uniquement</option>
                <option value="present">Présents</option>
              </select>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par élève ou matricule..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs w-64 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Élève',
                render: (a: Attendance) => {
                  const s = (a as any).student || students.find(st => st.id === a.student_id);
                  return s ? (
                    <div>
                      <p className="font-semibold text-slate-900">
                        {s.last_name} {s.first_name}
                      </p>
                      <p className="text-[11px] text-slate-400">{s.matricule}</p>
                    </div>
                  ) : (
                    '-'
                  );
                },
              },
              {
                key: 'class',
                label: 'Classe',
                render: (a: Attendance) => {
                  const s = (a as any).student || students.find(st => st.id === a.student_id);
                  const c = classes.find(cl => cl.id === s?.class_id);
                  return c?.name || '-';
                },
              },
              {
                key: 'date',
                label: 'Date',
                render: (a: Attendance) => formatDate(a.date),
              },
              {
                key: 'status',
                label: 'Statut',
                render: (a: Attendance) => (
                  <Badge status={a.status} label={statusLabels[a.status] || a.status} />
                ),
              },
              {
                key: 'justified',
                label: 'Justifié',
                render: (a: Attendance) =>
                  a.justified ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                      Oui
                    </span>
                  ) : a.status !== 'present' ? (
                    <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                      Non
                    </span>
                  ) : (
                    '-'
                  ),
              },
              {
                key: 'reason',
                label: 'Motif',
                render: (a: Attendance) => a.reason || <span className="text-slate-400 italic">-</span>,
              },
              ...(isGeneralAdmin
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (a: Attendance) => (
                        <button
                          onClick={() => void handleDeleteAttendance(a.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition"
                          title="Supprimer la présence (Admin)"
                        >
                          <Trash2 size={15} />
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={filteredHistory}
            loading={loading}
          />
        </div>
      )}

      {/* TAB 3: DISCIPLINE & SANCTIONS */}
      {tab === 'discipline' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Élève',
                render: (d: DisciplineRecord) => {
                  const s = (d as any).student || students.find(st => st.id === d.student_id);
                  return s ? `${s.last_name} ${s.first_name}` : '-';
                },
              },
              {
                key: 'type',
                label: 'Type d’incident',
                render: (d: DisciplineRecord) => (
                  <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 capitalize">
                    {d.type}
                  </span>
                ),
              },
              {
                key: 'description',
                label: 'Description des faits',
                render: (d: DisciplineRecord) => (
                  <span className="text-slate-800 font-medium">{d.description}</span>
                ),
              },
              {
                key: 'sanction',
                label: 'Sanction décidée',
                render: (d: DisciplineRecord) => d.sanction || '-',
              },
              {
                key: 'date',
                label: 'Date',
                render: (d: DisciplineRecord) => formatDate(d.date),
              },
              {
                key: 'parent_notified',
                label: 'Parent notifié',
                render: (d: DisciplineRecord) =>
                  d.parent_notified ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold">
                      Oui
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      Non
                    </span>
                  ),
              },
              ...(isGeneralAdmin
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (d: DisciplineRecord) => (
                        <button
                          onClick={() => void handleDeleteDiscipline(d.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition"
                          title="Supprimer (Admin)"
                        >
                          <Trash2 size={15} />
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={discipline}
            loading={loading}
          />
        </div>
      )}

      {/* Discipline Incident Modal */}
      <Modal
        isOpen={disciplineModal}
        onClose={() => setDisciplineModal(false)}
        title="Enregistrer un incident disciplinaire"
        size="md"
        actions={
          <>
            <button
              onClick={() => setDisciplineModal(false)}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={() => void handleSaveDiscipline()}
              disabled={savingDiscipline}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {savingDiscipline ? 'Enregistrement...' : "Enregistrer l'incident"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Élève concerné" required>
            <select
              value={discForm.student_id}
              onChange={e => setDiscForm({ ...discForm, student_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            >
              <option value="">-- Sélectionner un élève --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.last_name} {s.first_name} ({s.matricule})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Type d'incident" required>
            <select
              value={discForm.type}
              onChange={e => setDiscForm({ ...discForm, type: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            >
              <option value="observation">Observation</option>
              <option value="retard_repete">Retards répétés</option>
              <option value="bavardage">Bavardage / Indiscipline</option>
              <option value="avertissement">Avertissement</option>
              <option value="blame">Blâme</option>
              <option value="exclusion_temporaire">Exclusion temporaire</option>
              <option value="autre">Autre manquement</option>
            </select>
          </FormField>

          <FormField label="Description des faits" required>
            <textarea
              rows={3}
              value={discForm.description}
              onChange={e => setDiscForm({ ...discForm, description: e.target.value })}
              placeholder="Expliciter précisément les faits constatés..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </FormField>

          <FormField label="Sanction appliquée">
            <input
              type="text"
              value={discForm.sanction}
              onChange={e => setDiscForm({ ...discForm, sanction: e.target.value })}
              placeholder="Ex: Devoir supplémentaire, 2h de colle, convocation..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={discForm.parent_notified}
              onChange={e => setDiscForm({ ...discForm, parent_notified: e.target.checked })}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
            />
            <span className="text-xs font-semibold text-slate-700">
              Informer le parent / tuteur légal
            </span>
          </label>
        </div>
      </Modal>

      {/* WhatsApp Absence Notification Modal */}
      <Modal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title="📲 Notification des Absences & Retards aux Parents"
        size="lg"
        actions={
          <button
            onClick={() => setWhatsappModalOpen(false)}
            className="btn-premium-primary"
          >
            Fermer
          </button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-bold text-emerald-900 flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
              <span>Alerte instantanée des familles via WhatsApp</span>
            </p>
            <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
              Pour chaque élève non présent, vous pouvez ouvrir directement une discussion WhatsApp avec le parent ou copier le message personnalisé d'information.
            </p>
          </div>

          {absentStudentsList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Aucun élève absent ou en retard n'a été sélectionné.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {absentStudentsList.map(item => {
                const isCopied = copiedId === item.student.id;
                const whatsappUrl = getWhatsappUrl(item);
                const hasPhone = Boolean(item.phone);

                return (
                  <div
                    key={item.student.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {item.student.first_name} {item.student.last_name}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.status === 'absent'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.status === 'absent' ? 'Absent(e)' : 'En retard'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Parent référent : <strong className="text-slate-700">{item.parentName}</strong>
                          {item.phone ? ` • 📞 ${item.phone}` : ' • ⚠️ Aucun numéro enregistré'}
                        </p>
                        {item.reason && (
                          <p className="mt-1 text-xs italic text-slate-600">
                            Motif : {item.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => copyMessage(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition"
                          title="Copier le message d'absence"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                        </button>

                        {hasPhone ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
                          >
                            <MessageSquare size={14} />
                            <span>WhatsApp</span>
                            <ExternalLink size={12} className="opacity-70" />
                          </a>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400 cursor-not-allowed"
                          >
                            Pas de numéro
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
