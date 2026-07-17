import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useApp } from '../../../contexts/AppContext';
import DataTable from '../../../components/common/DataTable';
import FormField from '../../../components/common/FormField';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { buildContractHtml, openPrintPreview } from '../../../lib/printableDocuments';
import { Plus, Printer, Trash2, FileText } from 'lucide-react';
import type { Staff, Teacher } from '../../../types';

type Contract = {
  id: string;
  school_id: string;
  person_id: string;
  person_type: 'teacher' | 'staff';
  contract_type: 'stagiaire' | 'vacataire' | 'interim' | 'cdd' | 'cdi';
  start_date: string;
  end_date: string | null;
  base_salary: number;
  allowances: number;
  job_description: string | null;
  terms: string | null;
  status: 'draft' | 'active' | 'ended';
  created_at: string;
};

type ContractsModuleProps = {
  teachers: Teacher[];
  staff: Staff[];
};

export default function ContractsModule({ teachers, staff }: ContractsModuleProps) {
  const { school } = useApp();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_type: 'staff' as 'teacher' | 'staff',
    person_id: '',
    contract_type: 'cdi' as 'stagiaire' | 'vacataire' | 'interim' | 'cdd' | 'cdi',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    base_salary: 0,
    allowances: 0,
    job_description: '',
    terms: '',
    status: 'active' as 'draft' | 'active' | 'ended',
  });

  useEffect(() => {
    if (school) void fetchContracts();
  }, [school]);

  async function fetchContracts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('school_id', school!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts((data as Contract[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      person_type: 'staff',
      person_id: '',
      contract_type: 'cdi',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      base_salary: 0,
      allowances: 0,
      job_description: '',
      terms: '',
      status: 'active',
    });
    setNotice(null);
  }

  async function handleSaveContract() {
    if (!school) return;
    if (!form.person_id) {
      setNotice("Veuillez sélectionner un employé.");
      return;
    }
    setSaving(true);
    setNotice(null);

    const payload = {
      school_id: school.id,
      person_id: form.person_id,
      person_type: form.person_type,
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.end_date || null,
      base_salary: form.base_salary,
      allowances: form.allowances,
      job_description: form.job_description || null,
      terms: form.terms || null,
      status: form.status,
    };

    try {
      const { error } = await supabase.from('contracts').insert(payload);
      if (error) throw error;

      setModalOpen(false);
      resetForm();
      await fetchContracts();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de la création du contrat.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContract(id: string) {
    if (!confirm('Supprimer ce contrat ? cette action est irréversible.')) return;
    try {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
      await fetchContracts();
    } catch (err) {
      console.error(err);
    }
  }

  function handlePrintContract(contract: Contract) {
    if (!school) return;
    const source = contract.person_type === 'teacher' ? teachers : staff;
    const person = source.find(item => item.id === contract.person_id);
    if (!person) return;

    const html = buildContractHtml({
      school,
      contract,
      person,
    });
    openPrintPreview(html);
  }

  const selectedPersonOptions = form.person_type === 'teacher' ? teachers : staff;

  const contractTypeLabels: Record<string, string> = {
    stagiaire: 'Stage',
    vacataire: 'Vacataire',
    interim: 'Intérim',
    cdd: 'CDD',
    cdi: 'CDI',
  };

  const columns = [
    {
      key: 'person_id',
      label: 'Employé',
      render: (contract: Contract) => {
        const source = contract.person_type === 'teacher' ? teachers : staff;
        const person = source.find(item => item.id === contract.person_id);
        return person ? `${person.first_name} ${person.last_name}` : 'Inconnu';
      },
    },
    {
      key: 'contract_type',
      label: 'Type',
      render: (contract: Contract) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 capitalize">
          {contractTypeLabels[contract.contract_type] || contract.contract_type}
        </span>
      ),
    },
    {
      key: 'start_date',
      label: 'Début',
      render: (contract: Contract) => formatDate(contract.start_date),
    },
    {
      key: 'end_date',
      label: 'Fin',
      render: (contract: Contract) => contract.end_date ? formatDate(contract.end_date) : 'Indéterminé',
    },
    {
      key: 'base_salary',
      label: 'Salaire de Base',
      render: (contract: Contract) => formatCurrency(Number(contract.base_salary)),
    },
    {
      key: 'allowances',
      label: 'Primes / Ind.',
      render: (contract: Contract) => formatCurrency(Number(contract.allowances)),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (contract: Contract) => <Badge status={contract.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (contract: Contract) => (
        <div className="flex gap-1">
          <button
            onClick={() => handlePrintContract(contract)}
            className="rounded-full p-2 text-blue-600 transition hover:bg-blue-50"
            title="Imprimer le contrat"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={() => void handleDeleteContract(contract.id)}
            className="rounded-full p-2 text-red-500 transition hover:bg-red-50"
            title="Supprimer le contrat"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="surface-card p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="display-font text-xl font-semibold text-slate-900">Contrats de travail</h2>
          <p className="mt-1 text-sm text-slate-500">Générez et gérez les contrats de travail du personnel administratif et des enseignants.</p>
        </div>
        <button
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={18} /> Nouveau contrat
        </button>
      </div>

      <DataTable
        columns={columns}
        data={contracts}
        searchKeys={['contract_type', 'status']}
        searchPlaceholder="Rechercher un contrat..."
        loading={loading}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Créer un contrat de travail"
        size="lg"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveContract()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
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
            <FormField label="Type d'employé" required>
              <select
                value={form.person_type}
                onChange={e => setForm({ ...form, person_type: e.target.value as 'teacher' | 'staff', person_id: '' })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="staff">Administration</option>
                <option value="teacher">Enseignant</option>
              </select>
            </FormField>

            <FormField label="Sélectionner l'employé" required>
              <select
                value={form.person_id}
                onChange={e => setForm({ ...form, person_id: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Sélectionner</option>
                {selectedPersonOptions.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.last_name} {person.first_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Type de contrat" required>
              <select
                value={form.contract_type}
                onChange={e => setForm({ ...form, contract_type: e.target.value as any })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="cdi">CDI (Durée indéterminée)</option>
                <option value="cdd">CDD (Durée déterminée)</option>
                <option value="vacataire">Vacataire</option>
                <option value="stagiaire">Stage</option>
                <option value="interim">Intérim</option>
              </select>
            </FormField>

            <FormField label="Date de début" required>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </FormField>

            <FormField label="Date de fin (Optionnel pour CDD)">
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </FormField>

            <FormField label="Statut du contrat">
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as any })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="active">Actif</option>
                <option value="draft">Brouillon</option>
                <option value="ended">Terminé</option>
              </select>
            </FormField>

            <FormField label="Salaire de base (Mensuel)" required>
              <input
                type="number"
                value={form.base_salary}
                onChange={e => setForm({ ...form, base_salary: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </FormField>

            <FormField label="Indemnités / Primes (Mensuel)">
              <input
                type="number"
                value={form.allowances}
                onChange={e => setForm({ ...form, allowances: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Missions & Description du poste">
                <textarea
                  value={form.job_description}
                  onChange={e => setForm({ ...form, job_description: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
                  placeholder="Attributions de l'employé..."
                />
              </FormField>
            </div>

            <div className="md:col-span-2">
              <FormField label="Clauses particulières & Conditions">
                <textarea
                  value={form.terms}
                  onChange={e => setForm({ ...form, terms: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
                  placeholder="Spécifier les dispositions spéciales de ce contrat..."
                />
              </FormField>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
