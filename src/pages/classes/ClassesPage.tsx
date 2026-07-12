import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import type { Class, Level } from '../../types';
import { Edit, Plus, School, Trash2 } from 'lucide-react';

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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!school) return;
    void fetchClasses();
    void fetchLevels();
  }, [school]);

  async function fetchLevels() {
    if (!school) return;
    const { data } = await supabase.from('levels').select('*').eq('school_id', school.id).order('order_index');
    setLevels((data as Level[]) || []);
  }

  async function fetchClasses() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from('classes').select('*').eq('school_id', school.id).order('name');

    if (data) {
      const enriched = await Promise.all((data as Class[]).map(async currentClass => {
        const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', currentClass.id).eq('status', 'active');
        return { ...currentClass, student_count: count || 0 };
      }));
      setClasses(enriched);
    }

    setLoading(false);
  }

  function openCreate() {
    setEditMode(false);
    setSelectedClass(null);
    setNotice(null);
    setForm({ name: '', level_id: '', capacity: 40, room: '' });
    setModalOpen(true);
  }

  function openEdit(currentClass: Class) {
    setEditMode(true);
    setSelectedClass(currentClass);
    setNotice(null);
    setForm({
      name: currentClass.name,
      level_id: currentClass.level_id,
      capacity: currentClass.capacity,
      room: currentClass.room,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    const payload = {
      name: form.name,
      level_id: form.level_id || null,
      capacity: form.capacity,
      room: form.room || null,
      school_id: school.id,
      academic_year_id: academicYear?.id || null,
    };

    try {
      if (editMode && selectedClass) {
        const { error } = await supabase.from('classes').update(payload).eq('id', selectedClass.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
      }

      setModalOpen(false);
      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de l'enregistrement de la classe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(classId: string) {
    if (!confirm('Supprimer cette classe ?')) return;
    await supabase.from('classes').delete().eq('id', classId);
    await fetchClasses();
  }

  const columns = [
    { key: 'name', label: 'Classe' },
    { key: 'level_id', label: 'Niveau', render: (currentClass: any) => levels.find(level => level.id === currentClass.level_id)?.name || '-' },
    { key: 'room', label: 'Salle', render: (currentClass: any) => currentClass.room || '-' },
    { key: 'capacity', label: 'Capacité' },
    {
      key: 'student_count',
      label: 'Effectif',
      render: (currentClass: any) => (
        <div className="flex items-center gap-2">
          <span>{currentClass.student_count}</span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (currentClass.student_count / currentClass.capacity) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (currentClass: any) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(currentClass)} className="rounded-full p-2 text-amber-600 transition hover:bg-amber-50">
            <Edit size={16} />
          </button>
          <button onClick={() => void handleDelete(currentClass.id)} className="rounded-full p-2 text-red-600 transition hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des classes</h1>
          <p className="mt-1 text-gray-500">{classes.length} classe(s) de la Petite Section au CM2</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={18} /> Nouvelle classe
        </button>
      </div>

      {classes.length === 0 && !loading ? (
        <EmptyState icon={<School size={40} />} title="Aucune classe" description="Crée d’abord les niveaux PS à CM2 puis les classes correspondantes." />
      ) : (
        <DataTable columns={columns} data={classes as any[]} searchPlaceholder="Rechercher une classe..." searchKeys={['name', 'room']} loading={loading} />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Modifier la classe' : 'Nouvelle classe'}
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              Annuler
            </button>
            <button onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {notice && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800 font-medium animate-in">
              {notice}
            </div>
          )}
          <FormField label="Nom de la classe" required>
            <input type="text" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex: CP A" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
          <FormField label="Niveau" required>
            <select value={form.level_id} onChange={event => setForm({ ...form, level_id: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Sélectionner un niveau</option>
              {levels.map(level => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Capacité maximale">
            <input type="number" value={form.capacity} onChange={event => setForm({ ...form, capacity: parseInt(event.target.value, 10) || 40 })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
          <FormField label="Salle">
            <input type="text" value={form.room} onChange={event => setForm({ ...form, room: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
