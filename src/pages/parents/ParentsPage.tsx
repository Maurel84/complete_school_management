import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import { RELATIONSHIP_OPTIONS } from '../../lib/utils';
import type { Parent, Student } from '../../types';
import { Plus, Users, Edit, Eye, Trash2 } from 'lucide-react';

export default function ParentsPage() {
  const { school } = useApp();
  const { isAdmin, isDirector } = useAuth();
  const [parents, setParents] = useState<(Parent & { children_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<(Parent & { children?: Student[] }) | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', profession: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (school) fetchParents(); }, [school]);

  async function fetchParents() {
    setLoading(true);
    const { data } = await supabase.from('parents').select('*').eq('school_id', school!.id).order('last_name');
    if (data) {
      const enriched = await Promise.all((data as Parent[]).map(async (p) => {
        const { count } = await supabase.from('student_parents').select('*', { count: 'exact', head: true }).eq('parent_id', p.id);
        return { ...p, children_count: count || 0 };
      }));
      setParents(enriched);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditMode(false); setSelectedParent(null);
    setForm({ first_name: '', last_name: '', phone: '', email: '', address: '', profession: '' });
    setModalOpen(true);
  }

  function openEdit(parent: Parent) {
    setEditMode(true); setSelectedParent(parent as any);
    setForm({ first_name: parent.first_name, last_name: parent.last_name, phone: parent.phone, email: parent.email, address: parent.address, profession: parent.profession });
    setModalOpen(true);
  }

  async function openDetail(parent: Parent & { children_count?: number }) {
    const { data } = await supabase.from('student_parents').select('*, students(id, first_name, last_name, matricule)').eq('parent_id', parent.id);
    setSelectedParent({ ...parent, children: (data || []).map((sp: any) => sp.students).filter(Boolean) } as any);
    setDetailOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editMode && selectedParent) {
      await supabase.from('parents').update(form).eq('id', selectedParent.id);
    } else {
      await supabase.from('parents').insert({ ...form, school_id: school!.id });
    }
    setSaving(false); setModalOpen(false); fetchParents();
  }

  async function handleDelete(id: string) {
    if (confirm('Supprimer ce parent ?')) {
      await supabase.from('parents').delete().eq('id', id);
      fetchParents();
    }
  }

  const columns = [
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    { key: 'profession', label: 'Profession' },
    { key: 'children_count', label: 'Enfants', render: (p: any) => <span className="font-medium">{p.children_count}</span> },
    { key: 'actions', label: 'Actions', render: (p: any) => (
      <div className="flex gap-1">
        <button onClick={() => openDetail(p)} className="p-1 hover:bg-gray-100 rounded"><Eye size={16} className="text-blue-600" /></button>
        {(isAdmin || isDirector) && <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-100 rounded"><Edit size={16} className="text-amber-600" /></button>}
        {(isAdmin || isDirector) && <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 size={16} className="text-red-600" /></button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des parents</h1>
          <p className="text-gray-500 mt-1">{parents.length} parent(s) enregistré(s)</p>
        </div>
        {(isAdmin || isDirector) && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={18} /> Nouveau parent
          </button>
        )}
      </div>
      {parents.length === 0 && !loading ? (
        <EmptyState icon={<Users size={40} />} title="Aucun parent" description="Ajoutez des parents pour les associer aux élèves" />
      ) : (
        <DataTable columns={columns} data={parents as any[]} searchPlaceholder="Rechercher un parent..." searchKeys={['first_name', 'last_name', 'phone', 'email']} loading={loading} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? 'Modifier le parent' : 'Nouveau parent'} size="lg"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Prénom" required><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Nom" required><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Adresse"><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Profession"><input type="text" value={form.profession} onChange={e => setForm({...form, profession: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche parent" size="md">
        {selectedParent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-lg font-bold">
                {selectedParent.first_name[0]}{selectedParent.last_name[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedParent.first_name} {selectedParent.last_name}</h3>
                <p className="text-sm text-gray-500">{selectedParent.profession || 'Non renseigné'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Téléphone :</span> <span className="font-medium">{selectedParent.phone || '-'}</span></div>
              <div><span className="text-gray-500">Email :</span> <span className="font-medium">{selectedParent.email || '-'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Adresse :</span> <span className="font-medium">{selectedParent.address || '-'}</span></div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Enfants rattachés</h4>
              {(selectedParent as any).children?.length > 0 ? (
                <div className="space-y-2">
                  {(selectedParent as any).children.map((c: Student) => (
                    <div key={c.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">{c.first_name[0]}{c.last_name[0]}</div>
                      <div><p className="text-sm font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-500">{c.matricule}</p></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">Aucun enfant rattaché</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
