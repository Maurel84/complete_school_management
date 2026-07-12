import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import { RELATIONSHIP_OPTIONS } from '../../lib/utils';
import type { Parent, Student, StudentParent } from '../../types';
import { Edit, Eye, Plus, Trash2, Users } from 'lucide-react';

type ParentRow = Parent & { children_count?: number };
type ParentChildLink = StudentParent & { student?: Student & { class?: { name: string } } };

export default function ParentsPage() {
  const { school } = useApp();
  const { isAdmin, isDirector } = useAuth();
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [selectedChildren, setSelectedChildren] = useState<ParentChildLink[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', profession: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!school) return;
    void fetchParents();
  }, [school]);

  const relationshipLabels = useMemo(
    () => RELATIONSHIP_OPTIONS.reduce<Record<string, string>>((accumulator, option) => {
      accumulator[option.value] = option.label;
      return accumulator;
    }, {}),
    [],
  );

  async function fetchParents() {
    if (!school) return;
    setLoading(true);

    const { data } = await supabase.from('parents').select('*').eq('school_id', school.id).order('last_name');
    if (data) {
      const enriched = await Promise.all((data as Parent[]).map(async parent => {
        const { count } = await supabase
          .from('student_parents')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', parent.id);
        return { ...parent, children_count: count || 0 };
      }));
      setParents(enriched);
    } else {
      setParents([]);
    }

    setLoading(false);
  }

  function openCreate() {
    setEditMode(false);
    setSelectedParent(null);
    setNotice(null);
    setForm({ first_name: '', last_name: '', phone: '', email: '', address: '', profession: '' });
    setModalOpen(true);
  }

  function openEdit(parent: Parent) {
    setEditMode(true);
    setSelectedParent(parent);
    setNotice(null);
    setForm({
      first_name: parent.first_name,
      last_name: parent.last_name,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      profession: parent.profession,
    });
    setModalOpen(true);
  }

  async function openDetail(parent: ParentRow) {
    const { data } = await supabase
      .from('student_parents')
      .select('*, student:students(id, first_name, last_name, matricule, photo_url, class:classes(name))')
      .eq('parent_id', parent.id)
      .order('emergency_priority', { ascending: true });

    setSelectedParent(parent);
    setSelectedChildren((data as ParentChildLink[]) || []);
    setDetailOpen(true);
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    const payload = {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      profession: form.profession || null,
    };

    try {
      if (editMode && selectedParent) {
        const { error } = await supabase.from('parents').update(payload).eq('id', selectedParent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parents').insert({ ...payload, school_id: school.id });
        if (error) throw error;
      }

      setModalOpen(false);
      await fetchParents();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce parent ?')) return;
    await supabase.from('parents').delete().eq('id', id);
    await fetchParents();
  }

  const columns: Column<ParentRow>[] = [
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prenom' },
    { key: 'phone', label: 'Telephone' },
    { key: 'email', label: 'Email' },
    { key: 'profession', label: 'Profession' },
    { key: 'children_count', label: 'Enfants', render: (parent: ParentRow) => <span className="font-medium">{parent.children_count || 0}</span> },
    {
      key: 'actions',
      label: 'Actions',
      render: (parent: ParentRow) => (
        <div className="flex gap-1">
          <button onClick={() => void openDetail(parent)} className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50">
            <Eye size={16} />
          </button>
          {(isAdmin || isDirector) && (
            <button onClick={() => openEdit(parent)} className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50">
              <Edit size={16} />
            </button>
          )}
          {(isAdmin || isDirector) && (
            <button onClick={() => void handleDelete(parent.id)} className="rounded-xl p-2 text-red-600 transition hover:bg-red-50">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">Familles & responsables</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Les fiches parent regroupent les responsables legaux, les contacts financiers et les enfants rattaches a chaque foyer.
            </p>
          </div>
          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Vue famille</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{parents.length}</p>
                <p className="text-xs text-slate-500">Parents enregistres</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{parents.reduce((sum, parent) => sum + (parent.children_count || 0), 0)}</p>
                <p className="text-xs text-slate-500">Liens eleves</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Repertoire des parents</h2>
          <p className="mt-1 text-sm text-slate-500">{parents.length} parent(s) enregistre(s)</p>
        </div>
        {(isAdmin || isDirector) && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
            <Plus size={16} /> Nouveau parent
          </button>
        )}
      </div>

      {parents.length === 0 && !loading ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Aucun parent"
          description="Ajoute les familles pour les rattacher ensuite aux dossiers eleves."
        />
      ) : (
        <DataTable columns={columns} data={parents} searchPlaceholder="Rechercher un parent..." searchKeys={['first_name', 'last_name', 'phone', 'email']} loading={loading} />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Modifier le parent' : 'Nouveau parent'}
        size="lg"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSave()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Prenom" required>
            <input type="text" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Nom" required>
            <input type="text" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Telephone">
            <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Email">
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Adresse">
              <input type="text" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Profession">
              <input type="text" value={form.profession} onChange={event => setForm({ ...form, profession: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
          </div>
        </div>
      </div>
    </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche parent" size="lg">
        {selectedParent && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-100 text-lg font-bold text-emerald-700">
                {selectedParent.first_name[0]}{selectedParent.last_name[0]}
              </div>
              <div>
                <h3 className="display-font text-xl font-semibold text-slate-900">{selectedParent.first_name} {selectedParent.last_name}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedParent.profession || 'Profession non renseignee'}</p>
              </div>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div><span className="text-slate-500">Telephone :</span> <span className="font-medium text-slate-800">{selectedParent.phone || '-'}</span></div>
              <div><span className="text-slate-500">Email :</span> <span className="font-medium text-slate-800">{selectedParent.email || '-'}</span></div>
              <div className="md:col-span-2"><span className="text-slate-500">Adresse :</span> <span className="font-medium text-slate-800">{selectedParent.address || '-'}</span></div>
            </div>

            <div>
              <h4 className="display-font text-lg font-semibold text-slate-900">Enfants rattaches</h4>
              {selectedChildren.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedChildren.map(link => (
                    <div key={link.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        {link.student?.photo_url ? (
                          <img src={link.student.photo_url} alt={link.student.first_name} className="h-12 w-12 rounded-2xl border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-blue-700">
                            {link.student?.first_name?.[0] || '?'}{link.student?.last_name?.[0] || ''}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{link.student ? `${link.student.first_name} ${link.student.last_name}` : 'Eleve'}</p>
                          <p className="text-xs text-slate-500">{link.student?.matricule || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{relationshipLabels[link.relationship] || link.relationship}</span>
                        {link.is_primary && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Principal</span>}
                        {link.is_billing_contact && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Paiement</span>}
                        {link.is_pickup_authorized && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Sortie</span>}
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-slate-500">
                        <p>Classe : <strong className="text-slate-700">{link.student?.class?.name || '-'}</strong></p>
                        <p>Priorite urgence : <strong className="text-slate-700">{link.emergency_priority || 1}</strong></p>
                        {link.notes && <p className="rounded-2xl bg-white px-3 py-2">{link.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Aucun enfant rattache pour le moment.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
