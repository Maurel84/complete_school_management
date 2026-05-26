import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import { formatDate, SEX_OPTIONS, STATUS_OPTIONS, generateMatricule } from '../../lib/utils';
import type { Student, Class } from '../../types';
import { Plus, GraduationCap, Edit, Trash2, Eye, Search } from 'lucide-react';

export default function StudentsPage() {
  const { school } = useApp();
  const { isAdmin, isDirector, isSupervisor } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', sex: 'M',
    birth_place: '', nationality: '', address: '', phone: '', email: '',
    class_id: '', status: 'active', medical_info: '', previous_school: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (school) {
      fetchStudents();
      fetchClasses();
    }
  }, [school]);

  async function fetchStudents() {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('*, class:classes(id, name)')
      .eq('school_id', school!.id)
      .order('last_name');
    setStudents((data as Student[]) || []);
    setLoading(false);
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', school!.id);
    setClasses((data as Class[]) || []);
  }

  function openCreate() {
    setEditMode(false);
    setSelectedStudent(null);
    setForm({ first_name: '', last_name: '', date_of_birth: '', sex: 'M', birth_place: '', nationality: '', address: '', phone: '', email: '', class_id: '', status: 'active', medical_info: '', previous_school: '' });
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditMode(true);
    setSelectedStudent(student);
    setForm({
      first_name: student.first_name, last_name: student.last_name,
      date_of_birth: student.date_of_birth, sex: student.sex,
      birth_place: student.birth_place, nationality: student.nationality,
      address: student.address, phone: student.phone, email: student.email,
      class_id: student.class_id, status: student.status,
      medical_info: student.medical_info, previous_school: student.previous_school,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editMode && selectedStudent) {
      await supabase.from('students').update(form).eq('id', selectedStudent.id);
    } else {
      const count = students.length + 1;
      const matricule = generateMatricule('ELV', count);
      await supabase.from('students').insert({ ...form, school_id: school!.id, matricule });
    }
    setSaving(false);
    setModalOpen(false);
    fetchStudents();
  }

  async function handleDelete(id: string) {
    if (confirm('Supprimer cet élève ?')) {
      await supabase.from('students').update({ status: 'transferred' }).eq('id', id);
      fetchStudents();
    }
  }

  const columns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'sex', label: 'Sexe', render: (s: Student) => s.sex === 'M' ? 'Masculin' : 'Féminin' },
    { key: 'class', label: 'Classe', render: (s: Student) => (s as any).class?.name || '-' },
    { key: 'status', label: 'Statut', render: (s: Student) => <Badge status={s.status} /> },
    { key: 'actions', label: 'Actions', render: (s: Student) => (
      <div className="flex gap-1">
        <button onClick={() => { setSelectedStudent(s); setDetailOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Eye size={16} className="text-blue-600" /></button>
        <button onClick={() => openEdit(s)} className="p-1 hover:bg-gray-100 rounded"><Edit size={16} className="text-amber-600" /></button>
        <button onClick={() => handleDelete(s.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 size={16} className="text-red-600" /></button>
      </div>
    )},
  ];

  const statusLabels: Record<string, string> = { active: 'Actif', suspended: 'Suspendu', transferred: 'Transféré', graduated: 'Diplômé' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des élèves</h1>
          <p className="text-gray-500 mt-1">{students.length} élève(s) inscrit(s)</p>
        </div>
        {(isAdmin || isDirector || isSupervisor) && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nouvel élève
          </button>
        )}
      </div>

      {students.length === 0 && !loading ? (
        <EmptyState icon={<GraduationCap size={40} />} title="Aucun élève" description="Commencez par inscrire votre premier élève" action={<button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Inscrire un élève</button>} />
      ) : (
        <DataTable columns={columns} data={students as any[]} searchPlaceholder="Rechercher un élève..." searchKeys={['matricule', 'first_name', 'last_name']} loading={loading} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? 'Modifier l\'élève' : 'Nouvel élève'} size="lg"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Prénom" required><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Nom" required><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Date de naissance" required><input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Sexe" required>
            <select value={form.sex} onChange={e => setForm({...form, sex: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Lieu de naissance"><input type="text" value={form.birth_place} onChange={e => setForm({...form, birth_place: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Nationalité"><input type="text" value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Classe">
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner une classe</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Statut">
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <div className="md:col-span-2">
            <FormField label="Adresse"><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Infos médicales"><textarea value={form.medical_info} onChange={e => setForm({...form, medical_info: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          </div>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche élève" size="lg">
        {selectedStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</h3>
                <p className="text-sm text-gray-500">Matricule : {selectedStudent.matricule}</p>
              </div>
              <Badge status={selectedStudent.status} label={statusLabels[selectedStudent.status] || selectedStudent.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Sexe :</span> <span className="font-medium">{selectedStudent.sex === 'M' ? 'Masculin' : 'Féminin'}</span></div>
              <div><span className="text-gray-500">Date de naissance :</span> <span className="font-medium">{formatDate(selectedStudent.date_of_birth)}</span></div>
              <div><span className="text-gray-500">Lieu :</span> <span className="font-medium">{selectedStudent.birth_place || '-'}</span></div>
              <div><span className="text-gray-500">Nationalité :</span> <span className="font-medium">{selectedStudent.nationality || '-'}</span></div>
              <div><span className="text-gray-500">Classe :</span> <span className="font-medium">{(selectedStudent as any).class?.name || '-'}</span></div>
              <div><span className="text-gray-500">Téléphone :</span> <span className="font-medium">{selectedStudent.phone || '-'}</span></div>
              <div><span className="text-gray-500">Email :</span> <span className="font-medium">{selectedStudent.email || '-'}</span></div>
              <div><span className="text-gray-500">Adresse :</span> <span className="font-medium">{selectedStudent.address || '-'}</span></div>
              <div><span className="text-gray-500">École précédente :</span> <span className="font-medium">{selectedStudent.previous_school || '-'}</span></div>
            </div>
            {selectedStudent.medical_info && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">Infos médicales</p>
                <p className="text-sm text-amber-700 mt-1">{selectedStudent.medical_info}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
