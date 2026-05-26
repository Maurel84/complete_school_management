import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import { formatDate } from '../../lib/utils';
import type { Attendance, DisciplineRecord, Student, Class } from '../../types';
import { CalendarCheck, Plus, AlertTriangle, UserCheck, UserX, Clock } from 'lucide-react';

export default function AttendancePage() {
  const { school } = useApp();
  const { isAdmin, isDirector, isSupervisor, isTeacher } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'attendance' | 'discipline'>('attendance');
  const [modalOpen, setModalOpen] = useState(false);
  const [disciplineModal, setDisciplineModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [attForm, setAttForm] = useState({ student_id: '', status: 'present', reason: '', justified: false });
  const [discForm, setDiscForm] = useState({ student_id: '', type: 'observation', description: '', sanction: '', parent_notified: false });

  useEffect(() => { if (school) fetchData(); }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [attRes, discRes, stuRes, clsRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('school_id', sid).order('date', { ascending: false }).limit(100),
      supabase.from('discipline_records').select('*').eq('school_id', sid).order('date', { ascending: false }).limit(50),
      supabase.from('students').select('id, first_name, last_name, matricule, class_id').eq('school_id', sid).eq('status', 'active'),
      supabase.from('classes').select('*').eq('school_id', sid),
    ]);
    setAttendance((attRes.data as Attendance[]) || []);
    setDiscipline((discRes.data as DisciplineRecord[]) || []);
    setStudents((stuRes.data as Student[]) || []);
    setClasses((clsRes.data as Class[]) || []);
    setLoading(false);
  }

  async function handleSaveAttendance() {
    setSaving(true);
    await supabase.from('attendance').insert({
      ...attForm,
      school_id: school!.id,
      class_id: students.find(s => s.id === attForm.student_id)?.class_id,
      date: selectedDate,
    });
    setSaving(false); setModalOpen(false); fetchData();
  }

  async function handleSaveDiscipline() {
    setSaving(true);
    await supabase.from('discipline_records').insert({ ...discForm, school_id: school!.id, date: selectedDate });
    setSaving(false); setDisciplineModal(false); fetchData();
  }

  const statusLabels: Record<string, string> = { present: 'Présent', absent: 'Absent', late: 'En retard' };

  const attColumns = [
    { key: 'student_id', label: 'Élève', render: (a: Attendance) => {
      const s = students.find(s => s.id === a.student_id);
      return s ? `${s.last_name} ${s.first_name}` : '-';
    }},
    { key: 'date', label: 'Date', render: (a: Attendance) => formatDate(a.date) },
    { key: 'status', label: 'Statut', render: (a: Attendance) => <Badge status={a.status} label={statusLabels[a.status] || a.status} /> },
    { key: 'justified', label: 'Justifié', render: (a: Attendance) => a.justified ? <span className="text-emerald-600 text-xs font-medium">Oui</span> : <span className="text-red-600 text-xs font-medium">Non</span> },
    { key: 'reason', label: 'Motif' },
  ];

  const discColumns = [
    { key: 'student_id', label: 'Élève', render: (d: DisciplineRecord) => {
      const s = students.find(s => s.id === d.student_id);
      return s ? `${s.last_name} ${s.first_name}` : '-';
    }},
    { key: 'type', label: 'Type', render: (d: DisciplineRecord) => <span className="capitalize">{d.type}</span> },
    { key: 'description', label: 'Description' },
    { key: 'sanction', label: 'Sanction' },
    { key: 'date', label: 'Date', render: (d: DisciplineRecord) => formatDate(d.date) },
    { key: 'parent_notified', label: 'Parent notifié', render: (d: DisciplineRecord) => d.parent_notified ? 'Oui' : 'Non' },
  ];

  const totalPresent = attendance.filter(a => a.status === 'present').length;
  const totalAbsent = attendance.filter(a => a.status === 'absent').length;
  const totalLate = attendance.filter(a => a.status === 'late').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Absences & Discipline</h1>
          <p className="text-gray-500 mt-1">Suivi des présences et comportement</p>
        </div>
        {(isAdmin || isDirector || isSupervisor || isTeacher) && (
          <div className="flex gap-2">
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus size={18} /> Enregistrer présence
            </button>
            <button onClick={() => setDisciplineModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              <AlertTriangle size={18} /> Incident
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
          <UserCheck size={20} className="text-emerald-600" />
          <div><p className="text-2xl font-bold text-emerald-700">{totalPresent}</p><p className="text-sm text-emerald-600">Présences</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <UserX size={20} className="text-red-600" />
          <div><p className="text-2xl font-bold text-red-700">{totalAbsent}</p><p className="text-sm text-red-600">Absences</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <Clock size={20} className="text-amber-600" />
          <div><p className="text-2xl font-bold text-amber-700">{totalLate}</p><p className="text-sm text-amber-600">Retards</p></div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab('attendance')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'attendance' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Présences & Absences</button>
        <button onClick={() => setTab('discipline')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'discipline' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Discipline</button>
      </div>

      {tab === 'attendance' && <DataTable columns={attColumns} data={attendance as any[]} searchKeys={[]} searchPlaceholder="Rechercher..." loading={loading} />}
      {tab === 'discipline' && <DataTable columns={discColumns} data={discipline as any[]} searchKeys={['description', 'type']} searchPlaceholder="Rechercher un incident..." loading={loading} />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Enregistrer une présence" size="md"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveAttendance} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Date"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Élève" required>
            <select value={attForm.student_id} onChange={e => setAttForm({...attForm, student_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>)}
            </select>
          </FormField>
          <FormField label="Statut" required>
            <select value={attForm.status} onChange={e => setAttForm({...attForm, status: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="late">En retard</option>
            </select>
          </FormField>
          <FormField label="Motif"><input type="text" value={attForm.reason} onChange={e => setAttForm({...attForm, reason: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={attForm.justified} onChange={e => setAttForm({...attForm, justified: e.target.checked})} /> Absence justifiée</label>
        </div>
      </Modal>

      <Modal isOpen={disciplineModal} onClose={() => setDisciplineModal(false)} title="Signaler un incident" size="md"
        actions={<>
          <button onClick={() => setDisciplineModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveDiscipline} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Élève" required>
            <select value={discForm.student_id} onChange={e => setDiscForm({...discForm, student_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>)}
            </select>
          </FormField>
          <FormField label="Type">
            <select value={discForm.type} onChange={e => setDiscForm({...discForm, type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="observation">Observation</option>
              <option value="avertissement">Avertissement</option>
              <option value="blame">Blâme</option>
              <option value="exclusion">Exclusion</option>
            </select>
          </FormField>
          <FormField label="Description" required><textarea value={discForm.description} onChange={e => setDiscForm({...discForm, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Sanction"><input type="text" value={discForm.sanction} onChange={e => setDiscForm({...discForm, sanction: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={discForm.parent_notified} onChange={e => setDiscForm({...discForm, parent_notified: e.target.checked})} /> Parent notifié</label>
        </div>
      </Modal>
    </div>
  );
}
