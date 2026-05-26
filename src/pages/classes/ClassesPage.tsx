import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import type { Class, Level } from '../../types';
import { Plus, School, Edit, Trash2, Users } from 'lucide-react';

export default function ClassesPage() {
  const { school, academicYear } = useApp();
  const [classes, setClasses] = useState<(Class & { student_count?: number })[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [form, setForm] = useState({ name: '', level_id: '', capacity: 40, room: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (school) { fetchClasses(); fetchLevels(); } }, [school]);

  async function fetchLevels() {
    const { data } = await supabase.from('levels').select('*').eq('school_id', school!.id).order('order_index');
    setLevels((data as Level[]) || []);
  }

  async function fetchClasses() {
    setLoading(true);
    const { data } = await supabase.from('classes').select('*').eq('school_id', school!.id).order('name');
    if (data) {
      const enriched = await Promise.all((data as Class[]).map(async (c) => {
        const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', c.id).eq('status', 'active');
        return { ...c, student_count: count || 0 };
      }));
      setClasses(enriched);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditMode(false); setSelectedClass(null);
    setForm({ name: '', level_id: '', capacity: 40, room: '' });
    setModalOpen(true);
  }

  function openEdit(cls: Class) {
    setEditMode(true); setSelectedClass(cls);
    setForm({ name: cls.name, level_id: cls.level_id, capacity: cls.capacity, room: cls.room });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, school_id: school!.id, academic_year_id: academicYear?.id };
    if (editMode && selectedClass) {
      await supabase.from('classes').update(payload).eq('id', selectedClass.id);
    } else {
      await supabase.from('classes').insert(payload);
    }
    setSaving(false); setModalOpen(false); fetchClasses();
  }

  async function handleDelete(id: string) {
    if (confirm('Supprimer cette classe ?')) {
      await supabase.from('classes').delete().eq('id', id);
      fetchClasses();
    }
  }

  const columns = [
    { key: 'name', label: 'Classe' },
    { key: 'level_id', label: 'Niveau', render: (c: any) => levels.find(l => l.id === c.level_id)?.name || '-' },
    { key: 'room', label: 'Salle', render: (c: any) => c.room || '-' },
    { key: 'capacity', label: 'Capacité' },
    { key: 'student_count', label: 'Effectif', render: (c: any) => (
      <div className="flex items-center gap-2">
        <span>{c.student_count}</span>
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, (c.student_count / c.capacity) * 100)}%` }} />
        </div>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (c: any) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(c)} className="p-1 hover:bg-gray-100 rounded"><Edit size={16} className="text-amber-600" /></button>
        <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 size={16} className="text-red-600" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des classes</h1>
          <p className="text-gray-500 mt-1">{classes.length} classe(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={18} /> Nouvelle classe
        </button>
      </div>
      {classes.length === 0 && !loading ? (
        <EmptyState icon={<School size={40} />} title="Aucune classe" description="Créez vos niveaux et classes pour commencer" />
      ) : (
        <DataTable columns={columns} data={classes as any[]} searchPlaceholder="Rechercher une classe..." searchKeys={['name', 'room']} loading={loading} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? 'Modifier la classe' : 'Nouvelle classe'}
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Nom de la classe" required><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: 6ème A" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Niveau" required>
            <select value={form.level_id} onChange={e => setForm({...form, level_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner un niveau</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormField>
          <FormField label="Capacité maximale"><input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 40})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Salle"><input type="text" value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
