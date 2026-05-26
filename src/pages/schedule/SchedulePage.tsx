import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { DAYS_OF_WEEK } from '../../lib/utils';
import type { Schedule, Subject, Teacher, Class } from '../../types';
import { Clock, Plus } from 'lucide-react';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

export default function SchedulePage() {
  const { school, academicYear } = useApp();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ class_id: '', teacher_id: '', subject_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '' });

  useEffect(() => { if (school) fetchData(); }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [schRes, subRes, teaRes, clsRes] = await Promise.all([
      supabase.from('schedules').select('*').eq('school_id', sid),
      supabase.from('subjects').select('*').eq('school_id', sid),
      supabase.from('teachers').select('*').eq('school_id', sid).eq('status', 'active'),
      supabase.from('classes').select('*').eq('school_id', sid),
    ]);
    setSchedules((schRes.data as Schedule[]) || []);
    setSubjects((subRes.data as Subject[]) || []);
    setTeachers((teaRes.data as Teacher[]) || []);
    setClasses((clsRes.data as Class[]) || []);
    if (clsRes.data && clsRes.data.length > 0 && !selectedClass) setSelectedClass(clsRes.data[0].id);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('schedules').insert({ ...form, school_id: school!.id, academic_year_id: academicYear?.id });
    setSaving(false); setModalOpen(false); fetchData();
  }

  const classSchedules = selectedClass
    ? schedules.filter(s => s.class_id === selectedClass)
    : schedules;

  const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  function getScheduleForSlot(day: number, time: string) {
    return classSchedules.find(s =>
      s.day_of_week === day && s.start_time === time
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emploi du temps</h1>
          <p className="text-gray-500 mt-1">Planification hebdomadaire des cours</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} /> Ajouter un créneau
        </button>
      </div>

      <div className="flex gap-3">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option value="">Sélectionner une classe</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedClass ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-xs font-semibold text-gray-600 text-left w-20">Heure</th>
                {DAYS_OF_WEEK.map(d => (
                  <th key={d.value} className="px-3 py-3 text-xs font-semibold text-gray-600 text-center">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timeSlots.map(time => (
                <tr key={time}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-700 border-r border-gray-100">{time}</td>
                  {DAYS_OF_WEEK.map(day => {
                    const slot = getScheduleForSlot(day.value, time);
                    return (
                      <td key={day.value} className="px-2 py-2 text-center">
                        {slot ? (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                            <p className="font-medium text-blue-800">{subjects.find(s => s.id === slot.subject_id)?.name || '-'}</p>
                            <p className="text-blue-600 mt-0.5">{teachers.find(t => t.id === slot.teacher_id)?.last_name || '-'}</p>
                            <p className="text-blue-400">{slot.room || ''}</p>
                          </div>
                        ) : (
                          <div className="p-2 min-h-[48px]" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Clock size={40} className="mx-auto mb-3" />
          <p>Sélectionnez une classe pour afficher l'emploi du temps</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un créneau" size="md"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Classe" required>
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Matière" required>
            <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Enseignant">
            <select value={form.teacher_id} onChange={e => setForm({...form, teacher_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>)}
            </select>
          </FormField>
          <FormField label="Jour">
            <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Début"><input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <FormField label="Fin"><input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          </div>
          <FormField label="Salle"><input type="text" value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
