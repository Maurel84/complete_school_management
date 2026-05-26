import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import { formatDate, SEX_OPTIONS, CONTRACT_TYPES, generateMatricule, formatCurrency } from '../../lib/utils';
import type { Staff } from '../../types';
import { Plus, Briefcase, Edit, Eye } from 'lucide-react';

export default function HRPage() {
  const { school } = useApp();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'staff' | 'payroll'>('staff');
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', sex: 'M',
    phone: '', email: '', address: '', department: '', position: '',
    contract_type: 'cdi', hire_date: '', status: 'active',
  });

  useEffect(() => { if (school) fetchStaff(); }, [school]);

  async function fetchStaff() {
    setLoading(true);
    const { data } = await supabase.from('staff').select('*').eq('school_id', school!.id).order('last_name');
    setStaff((data as Staff[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditMode(false); setSelectedStaff(null);
    setForm({ first_name: '', last_name: '', date_of_birth: '', sex: 'M', phone: '', email: '', address: '', department: '', position: '', contract_type: 'cdi', hire_date: '', status: 'active' });
    setModalOpen(true);
  }

  function openEdit(s: Staff) {
    setEditMode(true); setSelectedStaff(s);
    setForm({ first_name: s.first_name, last_name: s.last_name, date_of_birth: s.date_of_birth, sex: s.sex, phone: s.phone, email: s.email, address: s.address, department: s.department, position: s.position, contract_type: s.contract_type, hire_date: s.hire_date, status: s.status });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editMode && selectedStaff) {
      await supabase.from('staff').update(form).eq('id', selectedStaff.id);
    } else {
      const matricule = generateMatricule('PER', staff.length + 1);
      await supabase.from('staff').insert({ ...form, school_id: school!.id, matricule });
    }
    setSaving(false); setModalOpen(false); fetchStaff();
  }

  const columns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'department', label: 'Département' },
    { key: 'position', label: 'Poste' },
    { key: 'contract_type', label: 'Contrat', render: (s: Staff) => CONTRACT_TYPES.find(c => c.value === s.contract_type)?.label || s.contract_type },
    { key: 'status', label: 'Statut', render: (s: Staff) => <Badge status={s.status} /> },
    { key: 'actions', label: 'Actions', render: (s: Staff) => (
      <div className="flex gap-1">
        <button onClick={() => { setSelectedStaff(s); setDetailOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Eye size={16} className="text-blue-600" /></button>
        <button onClick={() => openEdit(s)} className="p-1 hover:bg-gray-100 rounded"><Edit size={16} className="text-amber-600" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ressources Humaines</h1>
          <p className="text-gray-500 mt-1">{staff.filter(s => s.status === 'active').length} personnel(s) actif(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} /> Nouveau personnel
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab('staff')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'staff' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Personnel</button>
        <button onClick={() => setTab('payroll')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'payroll' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Paie</button>
      </div>

      {tab === 'staff' && (
        <DataTable columns={columns} data={staff as any[]} searchKeys={['matricule', 'first_name', 'last_name', 'department', 'position']} searchPlaceholder="Rechercher du personnel..." loading={loading} />
      )}
      {tab === 'payroll' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Module de paie - Gestion des salaires, primes et retenues
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? 'Modifier le personnel' : 'Nouveau personnel'} size="lg"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Prénom" required><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Nom" required><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Département"><input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Poste"><input type="text" value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Type de contrat"><select value={form.contract_type} onChange={e => setForm({...form, contract_type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">{CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
          <FormField label="Date d'embauche"><input type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche personnel" size="md">
        {selectedStaff && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-lg font-bold">{selectedStaff.first_name[0]}{selectedStaff.last_name[0]}</div>
              <div><h3 className="text-lg font-semibold">{selectedStaff.first_name} {selectedStaff.last_name}</h3><p className="text-sm text-gray-500">{selectedStaff.position || '-'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Département :</span> <span className="font-medium">{selectedStaff.department || '-'}</span></div>
              <div><span className="text-gray-500">Contrat :</span> <span className="font-medium">{CONTRACT_TYPES.find(c => c.value === selectedStaff.contract_type)?.label || '-'}</span></div>
              <div><span className="text-gray-500">Téléphone :</span> <span className="font-medium">{selectedStaff.phone || '-'}</span></div>
              <div><span className="text-gray-500">Statut :</span> <Badge status={selectedStaff.status} /></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
