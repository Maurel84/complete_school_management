import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DAYS_OF_WEEK } from '../../lib/utils';
import type { Schedule, Subject, Teacher, Class } from '../../types';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  List,
  LayoutGrid,
  Printer,
  BookOpen,
  User,
  MapPin,
  CheckCircle2,
  School,
} from 'lucide-react';
import { resolveTeacherClass } from '../../lib/roleDataResolver';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

// Normalizes time strings from database (e.g., '08:20:00' -> '08:20')
function normalizeTime(timeStr?: string): string {
  if (!timeStr) return '08:00';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return timeStr;
}

// Converts 'HH:mm' to minutes from midnight
function timeToMinutes(timeStr?: string): number {
  const norm = normalizeTime(timeStr);
  const [hh, mm] = norm.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

// Computes human-friendly duration
function getDurationLabel(start?: string, end?: string): string {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return '';
  if (diff < 60) return `${diff} min`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export default function SchedulePage() {
  const { school, academicYear } = useApp();
  const { isSuperAdmin, isAdmin, isDirector, isSupervisor, isTeacher, role, profile } = useAuth();
  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const canManageSchedule = (isSuperAdmin || isAdmin || isDirector || isSupervisor) && !isTeacherUser;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherClass, setTeacherClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal and form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    class_id: '',
    teacher_id: '',
    subject_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
    room: '',
  });

  useEffect(() => {
    if (school) fetchData();
  }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    try {
      const [schRes, subRes, teaRes, clsRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('school_id', sid).order('start_time'),
        supabase.from('subjects').select('*').eq('school_id', sid).order('name'),
        supabase.from('teachers').select('*').eq('school_id', sid).eq('status', 'active').order('last_name'),
        supabase.from('classes').select('*').eq('school_id', sid).order('name'),
      ]);

      setSchedules((schRes.data as Schedule[]) || []);
      setSubjects((subRes.data as Subject[]) || []);
      setTeachers((teaRes.data as Teacher[]) || []);
      setClasses((clsRes.data as Class[]) || []);

      let initialClassId = '';
      if (isTeacherUser && profile && clsRes.data) {
        const { assignedClass } = await resolveTeacherClass(sid, profile, clsRes.data as Class[]);
        setTeacherClass(assignedClass);
        if (assignedClass) {
          initialClassId = assignedClass.id;
        }
      }

      if (initialClassId) {
        setSelectedClass(initialClassId);
      } else if (clsRes.data && clsRes.data.length > 0 && !selectedClass) {
        setSelectedClass(clsRes.data[0].id);
      }
    } catch (e) {
      console.error('Failed to load schedule data', e);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal(defaultDay = 1, defaultStartTime = '08:00') {
    setEditingSchedule(null);
    setNotice(null);
    setForm({
      class_id: selectedClass || (classes[0]?.id || ''),
      teacher_id: teachers[0]?.id || '',
      subject_id: subjects[0]?.id || '',
      day_of_week: defaultDay,
      start_time: defaultStartTime,
      end_time: calculateDefaultEndTime(defaultStartTime, 60),
      room: '',
    });
    setModalOpen(true);
  }

  function openEditModal(sch: Schedule) {
    setEditingSchedule(sch);
    setNotice(null);
    setForm({
      class_id: sch.class_id,
      teacher_id: sch.teacher_id || '',
      subject_id: sch.subject_id || '',
      day_of_week: sch.day_of_week,
      start_time: normalizeTime(sch.start_time),
      end_time: normalizeTime(sch.end_time),
      room: sch.room || '',
    });
    setModalOpen(true);
  }

  function calculateDefaultEndTime(start: string, durationMinutes: number): string {
    const mins = timeToMinutes(start) + durationMinutes;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function handleSetDuration(minutes: number) {
    setForm(curr => ({
      ...curr,
      end_time: calculateDefaultEndTime(curr.start_time, minutes),
    }));
  }

  async function handleSave() {
    if (!form.class_id) {
      setNotice('Veuillez sélectionner une classe.');
      return;
    }
    if (!form.subject_id) {
      setNotice('Veuillez sélectionner une matière.');
      return;
    }
    if (timeToMinutes(form.end_time) <= timeToMinutes(form.start_time)) {
      setNotice("L'heure de fin doit être postérieure à l'heure de début.");
      return;
    }

    setSaving(true);
    setNotice(null);

    const payload = {
      class_id: form.class_id,
      teacher_id: form.teacher_id || null,
      subject_id: form.subject_id,
      day_of_week: form.day_of_week,
      start_time: normalizeTime(form.start_time),
      end_time: normalizeTime(form.end_time),
      room: form.room?.trim() || null,
      school_id: school!.id,
      academic_year_id: academicYear?.id || null,
    };

    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', editingSchedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schedules').insert(payload);
        if (error) throw error;
      }

      setModalOpen(false);
      setEditingSchedule(null);
      void fetchData();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de l'enregistrement de l'emploi du temps.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer ce créneau de cours ?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      void fetchData();
    } catch (err: any) {
      alert(`Erreur de suppression : ${err.message}`);
    }
  }

  // Filter schedules for the selected class
  const classSchedules = useMemo(() => {
    return schedules
      .filter(s => !selectedClass || s.class_id === selectedClass)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }, [schedules, selectedClass]);

  // Hourly grid rows from 07:00 to 18:00
  const timeHours = [
    { label: '07:00', startMin: 420, endMin: 480 },
    { label: '08:00', startMin: 480, endMin: 540 },
    { label: '09:00', startMin: 540, endMin: 600 },
    { label: '10:00', startMin: 600, endMin: 660 },
    { label: '11:00', startMin: 660, endMin: 720 },
    { label: '12:00', startMin: 720, endMin: 780 },
    { label: '13:00', startMin: 780, endMin: 840 },
    { label: '14:00', startMin: 840, endMin: 900 },
    { label: '15:00', startMin: 900, endMin: 960 },
    { label: '16:00', startMin: 960, endMin: 1020 },
    { label: '17:00', startMin: 1020, endMin: 1080 },
  ];

  // Robust matching: fetches all courses starting within this hour window
  function getSchedulesForHour(day: number, startMin: number, endMin: number): Schedule[] {
    return classSchedules.filter(s => {
      if (s.day_of_week !== day) return false;
      const slotStart = timeToMinutes(s.start_time);
      return slotStart >= startMin && slotStart < endMin;
    });
  }

  const currentClassName = classes.find(c => c.id === selectedClass)?.name || 'Classe';

  function handlePrintTimetable() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="display-font text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="text-blue-600" size={26} />
            {isTeacherUser ? `Emploi du temps • ${teacherClass?.name || 'CP1'}` : 'Emploi du temps'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isTeacherUser
              ? `Planning hebdomadaire des cours de votre classe (${teacherClass?.name || 'CP1'})`
              : "Planification hebdomadaire des cours, pauses et séances d'apprentissage"}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Grille</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List size={14} />
              <span>Liste</span>
            </button>
          </div>

          <button
            onClick={handlePrintTimetable}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition"
            title="Imprimer l'emploi du temps"
          >
            <Printer size={15} />
            <span>Imprimer</span>
          </button>

          {canManageSchedule && (
            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-xs transition"
            >
              <Plus size={16} /> Ajouter un créneau
            </button>
          )}
        </div>
      </div>

      {/* Class Selector Bar */}
      <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Classe concernée :
          </label>
          {isTeacherUser && teacherClass ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
              <School size={15} className="text-emerald-600" />
              <span>Votre classe : {teacherClass.name}</span>
            </div>
          ) : (
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xs"
            >
              <option value="">Toutes les classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {classSchedules.length} séance(s) programmée(s) pour {currentClassName}
        </div>
      </div>

      {/* Mode 1: Weekly Grid */}
      {viewMode === 'grid' && (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="px-3 py-3.5 text-xs font-bold text-left w-24 border-r border-slate-200">
                    Tranche
                  </th>
                  {DAYS_OF_WEEK.map(d => (
                    <th
                      key={d.value}
                      className="px-3 py-3.5 text-xs font-bold text-center border-r border-slate-100 last:border-r-0"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {timeHours.map(hour => (
                  <tr key={hour.label} className="hover:bg-slate-50/50 transition">
                    <td className="px-3 py-3 font-semibold text-slate-700 bg-slate-50/70 border-r border-slate-200 align-top">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock size={13} className="text-slate-400" />
                        <span>{hour.label}</span>
                      </div>
                    </td>
                    {DAYS_OF_WEEK.map(day => {
                      const slots = getSchedulesForHour(day.value, hour.startMin, hour.endMin);

                      return (
                        <td
                          key={day.value}
                          className="px-2 py-2 border-r border-slate-100 last:border-r-0 align-top min-w-[140px] max-w-[180px]"
                        >
                          {slots.length > 0 ? (
                            <div className="space-y-2">
                              {slots.map(slot => {
                                const subject = subjects.find(s => s.id === slot.subject_id);
                                const teacher = teachers.find(t => t.id === slot.teacher_id);
                                const start = normalizeTime(slot.start_time);
                                const end = normalizeTime(slot.end_time);
                                const duration = getDurationLabel(start, end);

                                return (
                                  <div
                                    key={slot.id}
                                    className="group relative rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 p-2.5 shadow-2xs hover:shadow-xs transition hover:border-blue-400"
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="inline-flex items-center rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-tight">
                                        {start} - {end}
                                      </span>
                                      {duration && (
                                        <span className="text-[10px] text-blue-600 font-semibold">
                                          {duration}
                                        </span>
                                      )}
                                    </div>

                                    <p className="font-bold text-slate-900 leading-snug truncate" title={subject?.name}>
                                      {subject?.name || 'Matière'}
                                    </p>

                                    {teacher && (
                                      <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 truncate">
                                        <User size={11} className="text-slate-400 shrink-0" />
                                        <span>{teacher.last_name} {teacher.first_name?.charAt(0)}.</span>
                                      </p>
                                    )}

                                    {slot.room && (
                                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                        <MapPin size={10} className="text-slate-400 shrink-0" />
                                        <span>Salle: {slot.room}</span>
                                      </p>
                                    )}

                                    {/* Action buttons */}
                                    {canManageSchedule && (
                                      <div className="mt-2 pt-1.5 border-t border-blue-100/80 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                                        <button
                                          onClick={() => openEditModal(slot)}
                                          title="Modifier ce cours"
                                          className="p-1 rounded-md text-blue-600 hover:bg-blue-100 transition"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDelete(slot.id)}
                                          title="Supprimer ce créneau"
                                          className="p-1 rounded-md text-rose-600 hover:bg-rose-100 transition"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              onClick={() => canManageSchedule && openCreateModal(day.value, hour.label)}
                              className="h-10 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50/30 transition cursor-pointer group"
                              title="Cliquer pour ajouter un créneau à cette heure"
                            >
                              <Plus size={14} className="opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Detailed Chronological List */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DAYS_OF_WEEK.map(d => {
            const daySlots = classSchedules.filter(s => s.day_of_week === d.value);

            return (
              <div key={d.value} className="surface-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      {d.label}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {daySlots.length} cours
                    </span>
                  </div>

                  {daySlots.length > 0 ? (
                    <div className="space-y-3">
                      {daySlots.map(slot => {
                        const subject = subjects.find(s => s.id === slot.subject_id);
                        const teacher = teachers.find(t => t.id === slot.teacher_id);
                        const start = normalizeTime(slot.start_time);
                        const end = normalizeTime(slot.end_time);
                        const duration = getDurationLabel(start, end);

                        return (
                          <div
                            key={slot.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 hover:bg-white hover:border-blue-300 hover:shadow-xs transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                                {start} - {end}
                              </span>
                              {duration && (
                                <span className="text-xs font-semibold text-slate-500">
                                  {duration}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 font-bold text-slate-900 text-sm">
                              {subject?.name || 'Matière'}
                            </p>

                            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                              <span>
                                {teacher ? `${teacher.last_name} ${teacher.first_name}` : 'Enseignant non assigné'}
                              </span>
                              {slot.room && (
                                <span className="font-medium text-slate-500">
                                  Salle {slot.room}
                                </span>
                              )}
                            </div>

                            {canManageSchedule && (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(slot)}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <Edit2 size={12} /> Modifier
                                </button>
                                <button
                                  onClick={() => handleDelete(slot.id)}
                                  className="text-xs font-medium text-rose-600 hover:text-rose-800 flex items-center gap-1"
                                >
                                  <Trash2 size={12} /> Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Aucun cours planifié
                    </div>
                  )}
                </div>

                {canManageSchedule && (
                  <button
                    onClick={() => openCreateModal(d.value)}
                    className="mt-4 w-full py-2 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Ajouter un créneau ce jour
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating and Editing Slots */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSchedule ? 'Modifier le créneau de cours' : 'Ajouter un créneau de cours'}
        size="md"
        actions={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-xs"
            >
              {saving ? 'Enregistrement...' : editingSchedule ? 'Mettre à jour' : 'Enregistrer le créneau'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {notice && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
              {notice}
            </div>
          )}

          <FormField label="Classe" required>
            <select
              value={form.class_id}
              onChange={e => setForm({ ...form, class_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Matière" required>
            <select
              value={form.subject_id}
              onChange={e => setForm({ ...form, subject_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Sélectionner une matière</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || '-'})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Enseignant responsable">
            <select
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Sélectionner un enseignant (optionnel)</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.last_name} {t.first_name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Jour de la semaine" required>
            <select
              value={form.day_of_week}
              onChange={e => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              {DAYS_OF_WEEK.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Quick Duration Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Durées rapides suggérées :
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '20 min', mins: 20 },
                { label: '30 min', mins: 30 },
                { label: '45 min', mins: 45 },
                { label: '1 heure', mins: 60 },
                { label: '1h 30min', mins: 90 },
                { label: '2 heures', mins: 120 },
              ].map(d => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => handleSetDuration(d.mins)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition"
                >
                  +{d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Heure de début" required>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </FormField>
            <FormField label="Heure de fin" required>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </FormField>
          </div>

          <FormField label="Salle de classe ou Local">
            <input
              type="text"
              placeholder="Ex: Salle 102, Terrain, Salle Informatique..."
              value={form.room}
              onChange={e => setForm({ ...form, room: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
