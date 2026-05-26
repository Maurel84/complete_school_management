import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import { formatDate, SEX_OPTIONS, CONTRACT_TYPES, generateMatricule } from '../../lib/utils';
import type { Teacher } from '../../types';
import { Plus, BookOpen, Edit, Trash2, Eye } from 'lucide-react';

export default function TeachersPage() {
  const { school } = useApp();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', sex: 'M',
    phone: '', email: '', address: '', specialty: '',
    contract_type: 'cdi', hire_date: '', status: 'active',
  });

  useEffect(() => { if (school) fetchTeachers(); }, [school]);

  async function fetchTeachers() {
    setLoading(true);
    const { data } = await supabase.from('teachers').select('*').eq('school_id', school!.id).order('last_name');
    setTeachers((data as Teacher[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditMode(false); setSelectedTeacher(null);
    setForm({ first_name: '', last_name: '', date_of_birth: '', sex: 'M', phone: '', email: '', address: '', specialty: '', contract_type: 'cdi', hire_date: '', status: 'active' });
    setModalOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditMode(true); setSelectedTeacher(t);
    setForm({ first_name: t.first_name, last_name: t.last_name, date_of_birth: t.date_of_birth, sex: t.sex, phone: t.phone, email: t.email, address: t.address, specialty: t.specialty, contract_type: t.contract_type, hire_date: t.hire_date, status: t.status });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editMode && selectedTeacher) {
      await supabase.from('teachers').update(form).eq('id', selectedTeacher.id);
    } else {
      const matricule = generateMatricule('ENS', teachers.length + 1);
      await supabase.from('teachers').insert({ ...form, school_id: school!.id, matricule });
    }
    setSaving(false); setModalOpen(false); fetchTeachers();
  }

  async function handleDelete(id: string) {
    if (confirm('Supprimer cet enseignant ?')) {
      await supabase.from('teachers').update({ status: 'suspended' }).eq('id', id);
      fetchTeachers();
    }
  }

  const columns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'specialty', label: 'Spécialité' },
    { key: 'contract_type', label: 'Contrat', render: (t: Teacher) => CONTRACT_TYPES.find(c => c.value === t.contract_type)?.label || t.contract_type },
    { key: 'status', label: 'Statut', render: (t: Teacher) => <Badge status={t.status} /> },
    { key: 'actions', label: 'Actions', render: (t: Teacher) => (
      <div className="flex gap-1">
        <button onClick={() => { setSelectedTeacher(t); setDetailOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Eye size={16} className="text-blue-600" /></button>
        <button onClick={() => openEdit(t)} className="p-1 hover:bg-gray-100 rounded"><Edit size={16} className="text-amber-600" /></button>
        <button onClick={() => handleDelete(t.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 size={16} className="text-red-600" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des enseignants</h1>
          <p className="text-gray-500 mt-1">{teachers.filter(t => t.status === 'active').length} enseignant(s) actif(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} /> Nouvel enseignant
        </button>
      </div>

      <DataTable columns={columns} data={teachers as any[]} searchKeys={['matricule', 'first_name', 'last_name', 'specialty']} searchPlaceholder="Rechercher un enseignant..." loading={loading} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? 'Modifier l\'enseignant' : 'Nouvel enseignant'} size="lg"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Prénom" required><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Nom" required><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Date de naissance"><input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Sexe"><select value={form.sex} onChange={e => setForm({...form, sex: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">{SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          <FormField label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Spécialité"><input type="text" value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Type de contrat"><select value={form.contract_type} onChange={e => setForm({...form, contract_type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">{CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
          <FormField label="Date d'embauche"><input type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche enseignant" size="md">
        {selectedTeacher && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-lg font-bold">{selectedTeacher.first_name[0]}{selectedTeacher.last_name[0]}</div>
              <div>
                <h3 className="text-lg font-semibold">{selectedTeacher.first_name} {selectedTeacher.last_name}</h3>
                <p className="text-sm text-gray-500">Matricule : {selectedTeacher.matricule}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Spécialité :</span> <span className="font-medium">{selectedTeacher.specialty || '-'}</span></div>
              <div><span className="text-gray-500">Contrat :</span> <span className="font-medium">{CONTRACT_TYPES.find(c => c.value === selectedTeacher.contract_type)?.label || '-'}</span></div>
              <div><span className="text-gray-500">Téléphone :</span> <span className="font-medium">{selectedTeacher.phone || '-'}</span></div>
              <div><span className="text-gray-500">Email :</span> <span className="font-medium">{selectedTeacher.email || '-'}</span></div>
              <div><span className="text-gray-500">Date d'embauche :</span> <span className="font-medium">{selectedTeacher.hire_date ? formatDate(selectedTeacher.hire_date) : '-'}</span></div>
              <div><span className="text-gray-500">Statut :</span> <Badge status={selectedTeacher.status} /></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
