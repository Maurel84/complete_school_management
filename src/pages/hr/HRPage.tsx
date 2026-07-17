import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { createDoubleEntry, createCashTransaction } from '../../lib/accountingSync';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import StatCard from '../../components/common/StatCard';
import {
  CONTRACT_TYPES,
  MONTH_OPTIONS,
  PAYROLL_STATUS_OPTIONS,
  STAFF_DEPARTMENTS,
  STAFF_POSITIONS,
  formatCurrency,
  formatDate,
  formatMonthYear,
  generateMatricule,
  getInitials,
} from '../../lib/utils';
import type { Payroll, Staff, Teacher } from '../../types';
import { Plus, Briefcase, Edit, Eye, Shield, WalletCards, ReceiptText, Trash2, Printer } from 'lucide-react';
import { buildPayslipHtml, openPrintPreview } from '../../lib/printableDocuments';
import ContractsModule from './components/ContractsModule';

type HRTab = 'staff' | 'payroll' | 'contracts';

type PayrollForm = {
  person_id: string;
  person_type: 'teacher' | 'staff';
  month: number;
  year: number;
  base_salary: number;
  bonuses: number;
  deductions: number;
  status: string;
  paid_date: string;
  sursalaire: number;
  transport: number;
  anciennete: number;
  autres_primes: number;
  gratification: number;
  conges_payes: number;
  pharmacie: number;
  solidarite: number;
  its: number;
  cr: number;
  mode_paiement: string;
};

export default function HRPage() {
  const { school } = useApp();
  const { isSuperAdmin, isAdmin, isDirector, isAccountant, profile } = useAuth();
  const canManagePayroll = isSuperAdmin || isAdmin || isDirector || isAccountant;
  const [staff, setStaff] = useState<Staff[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrollLoading, setPayrollLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [payrollEditMode, setPayrollEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<HRTab>('staff');
  const [notice, setNotice] = useState<string | null>(null);
  const [payrollNotice, setPayrollNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: 'M',
    phone: '',
    email: '',
    address: '',
    department: '',
    position: '',
    contract_type: 'cdi',
    hire_date: '',
    status: 'active',
  });
  const [payrollForm, setPayrollForm] = useState<PayrollForm>({
    person_id: '',
    person_type: 'staff',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    base_salary: 0,
    bonuses: 0,
    deductions: 0,
    status: 'draft',
    paid_date: '',
    sursalaire: 0,
    transport: 0,
    anciennete: 0,
    autres_primes: 0,
    gratification: 0,
    conges_payes: 0,
    pharmacie: 0,
    solidarite: 0,
    its: 0,
    cr: 0,
    mode_paiement: 'Virement',
  });

  useEffect(() => {
    if (!school) return;
    void fetchStaff();
    if (canManagePayroll) {
      void fetchPayrollData();
    } else {
      setPayrolls([]);
      setTeachers([]);
      setPayrollLoading(false);
    }
  }, [school, canManagePayroll]);

  async function fetchStaff() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from('staff').select('*').eq('school_id', school.id).order('last_name');
    setStaff((data as Staff[]) || []);
    setLoading(false);
  }

  async function fetchPayrollData() {
    if (!school) return;
    setPayrollLoading(true);

    const [teacherRes, payrollRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('school_id', school.id).order('last_name'),
      supabase.from('payrolls').select('*').eq('school_id', school.id).order('year', { ascending: false }).order('month', { ascending: false }),
    ]);

    setTeachers((teacherRes.data as Teacher[]) || []);
    setPayrolls((payrollRes.data as Payroll[]) || []);
    setPayrollLoading(false);
  }

  function resetStaffForm() {
    setForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      sex: 'M',
      phone: '',
      email: '',
      address: '',
      department: '',
      position: '',
      contract_type: 'cdi',
      hire_date: '',
      status: 'active',
    });
  }

  function resetPayrollForm() {
    setPayrollForm({
      person_id: '',
      person_type: 'staff',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      base_salary: 0,
      bonuses: 0,
      deductions: 0,
      status: 'draft',
      paid_date: '',
      sursalaire: 0,
      transport: 0,
      anciennete: 0,
      autres_primes: 0,
      gratification: 0,
      conges_payes: 0,
      pharmacie: 0,
      solidarite: 0,
      its: 0,
      cr: 0,
      mode_paiement: 'Virement',
    });
  }

  function openCreate() {
    setEditMode(false);
    setSelectedStaff(null);
    setNotice(null);
    resetStaffForm();
    setModalOpen(true);
  }

  function openEdit(staffMember: Staff) {
    setEditMode(true);
    setSelectedStaff(staffMember);
    setNotice(null);
    setForm({
      first_name: staffMember.first_name,
      last_name: staffMember.last_name,
      date_of_birth: staffMember.date_of_birth,
      sex: staffMember.sex,
      phone: staffMember.phone,
      email: staffMember.email,
      address: staffMember.address,
      department: staffMember.department,
      position: staffMember.position,
      contract_type: staffMember.contract_type,
      hire_date: staffMember.hire_date,
      status: staffMember.status,
    });
    setModalOpen(true);
  }

  function openCreatePayroll() {
    setPayrollEditMode(false);
    setSelectedPayroll(null);
    setPayrollNotice(null);
    resetPayrollForm();
    setPayrollModalOpen(true);
  }

  function openEditPayroll(payroll: Payroll) {
    setPayrollEditMode(true);
    setSelectedPayroll(payroll);
    setPayrollNotice(null);
    const details = (payroll as any).details || {};
    setPayrollForm({
      person_id: payroll.person_id,
      person_type: payroll.person_type as 'teacher' | 'staff',
      month: payroll.month,
      year: payroll.year,
      base_salary: Number(payroll.base_salary),
      bonuses: Number(payroll.bonuses),
      deductions: Number(payroll.deductions),
      status: payroll.status,
      paid_date: payroll.paid_date || '',
      sursalaire: Number(details.sursalaire || 0),
      transport: Number(details.transport || 0),
      anciennete: Number(details.anciennete || 0),
      autres_primes: Number(details.autres_primes || 0),
      gratification: Number(details.gratification || 0),
      conges_payes: Number(details.conges_payes || 0),
      pharmacie: Number(details.pharmacie || 0),
      solidarite: Number(details.solidarite || 0),
      its: Number(details.its || 0),
      cr: Number(details.cr || 0),
      mode_paiement: details.mode_paiement || 'Virement',
    });
    setPayrollModalOpen(true);
  }

  async function handleSaveStaff() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setNotice("Le prénom et le nom sont requis.");
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      date_of_birth: form.date_of_birth || null,
      hire_date: form.hire_date || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      department: form.department || null,
      position: form.position || null,
    };

    try {
      if (editMode && selectedStaff) {
        const { error } = await supabase.from('staff').update(payload).eq('id', selectedStaff.id);
        if (error) throw error;
      } else {
        const matricule = generateMatricule('ADM', staff.length + 1);
        const { error } = await supabase.from('staff').insert({ ...payload, school_id: school.id, matricule });
        if (error) throw error;
      }

      setModalOpen(false);
      resetStaffForm();
      await fetchStaff();
    } catch (err: any) {
      console.error(err);
      setNotice(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePayroll() {
    if (!school) return;
    setSaving(true);
    setPayrollNotice(null);

    if (!payrollForm.person_id) {
      setPayrollNotice("Veuillez sélectionner un collaborateur.");
      setSaving(false);
      return;
    }

    const totalGains = payrollForm.sursalaire + payrollForm.transport + payrollForm.anciennete + payrollForm.autres_primes + payrollForm.gratification + payrollForm.conges_payes;
    const totalDeductions = payrollForm.pharmacie + payrollForm.solidarite + payrollForm.its + payrollForm.cr;
    const netSalary = payrollForm.base_salary + totalGains - totalDeductions;

    const payload = {
      person_id: payrollForm.person_id,
      person_type: payrollForm.person_type,
      month: payrollForm.month,
      year: payrollForm.year,
      base_salary: payrollForm.base_salary,
      bonuses: totalGains,
      deductions: totalDeductions,
      net_salary: netSalary,
      status: payrollForm.status,
      school_id: school.id,
      paid_date: (payrollForm.status === 'paid' ? payrollForm.paid_date || new Date().toISOString().split('T')[0] : payrollForm.paid_date) || null,
      details: {
        sursalaire: payrollForm.sursalaire,
        transport: payrollForm.transport,
        anciennete: payrollForm.anciennete,
        autres_primes: payrollForm.autres_primes,
        gratification: payrollForm.gratification,
        conges_payes: payrollForm.conges_payes,
        pharmacie: payrollForm.pharmacie,
        solidarite: payrollForm.solidarite,
        its: payrollForm.its,
        cr: payrollForm.cr,
        mode_paiement: payrollForm.mode_paiement,
      }
    };

    try {
      if (payrollEditMode && selectedPayroll) {
        const { error } = await supabase.from('payrolls').update(payload).eq('id', selectedPayroll.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payrolls').insert(payload);
        if (error) throw error;
      }

      // Sync to general accounting journal and cash register if status is 'paid'
      if (payrollForm.status === 'paid') {
        const source = payrollForm.person_type === 'teacher' ? teachers : staff;
        const person = source.find(item => item.id === payrollForm.person_id);
        const personName = person ? `${person.last_name} ${person.first_name}` : 'Collaborateur';

        // 1. Sync to Caisse (Sortie)
        await createCashTransaction({
          schoolId: school.id,
          type: 'out',
          amount: netSalary,
          description: `Salaire - ${personName}`,
          category: 'payroll',
          processedBy: profile?.id,
        });

        // 2. Sync to General Journal (Charges personnel 661100 / Caisse 571100)
        await createDoubleEntry({
          schoolId: school.id,
          amount: netSalary,
          description: `Règlement Salaire - ${personName}`,
          debitAccountNo: '661100',
          creditAccountNo: '571100',
          reference: `PAIE-${payrollForm.month}-${payrollForm.year}`,
        });
      }

      setPayrollModalOpen(false);
      resetPayrollForm();
      await fetchPayrollData();
    } catch (err: any) {
      console.error(err);
      setPayrollNotice(err.message || "Une erreur est survenue lors de l'enregistrement de la paie.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayroll(payrollId: string) {
    if (!confirm('Supprimer cette fiche de paie ?')) return;
    await supabase.from('payrolls').delete().eq('id', payrollId);
    await fetchPayrollData();
  }

  function handlePrintPayslip(payroll: Payroll) {
    if (!school) return;
    const source = payroll.person_type === 'teacher' ? teachers : staff;
    const person = source.find(item => item.id === payroll.person_id);
    if (!person) return;

    const html = buildPayslipHtml({
      school,
      payroll,
      person,
    });
    openPrintPreview(html);
  }

  const allPeople = useMemo(
    () => ({
      staff,
      teachers,
    }),
    [staff, teachers],
  );

  const selectedPersonOptions = payrollForm.person_type === 'teacher' ? allPeople.teachers : allPeople.staff;
  const netSalaryPreview = payrollForm.base_salary +
    (payrollForm.sursalaire + payrollForm.transport + payrollForm.anciennete + payrollForm.autres_primes + payrollForm.gratification + payrollForm.conges_payes) -
    (payrollForm.pharmacie + payrollForm.solidarite + payrollForm.its + payrollForm.cr);
  const payrollTotal = payrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);
  const payrollPaid = payrolls.filter(payroll => payroll.status === 'paid').reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);
  const payrollPending = payrolls.filter(payroll => payroll.status !== 'paid').reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);

  const staffColumns = [
    { key: 'matricule', label: 'Matricule' },
    { key: 'last_name', label: 'Nom' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'department', label: 'Service' },
    { key: 'position', label: 'Poste' },
    {
      key: 'contract_type',
      label: 'Contrat',
      render: (staffMember: Staff) => CONTRACT_TYPES.find(contract => contract.value === staffMember.contract_type)?.label || staffMember.contract_type,
    },
    { key: 'status', label: 'Statut', render: (staffMember: Staff) => <Badge status={staffMember.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (staffMember: Staff) => (
        <div className="flex gap-1">
          <button onClick={() => { setSelectedStaff(staffMember); setDetailOpen(true); }} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <Eye size={16} />
          </button>
          <button onClick={() => openEdit(staffMember)} className="rounded-full p-2 text-amber-600 transition hover:bg-amber-50">
            <Edit size={16} />
          </button>
        </div>
      ),
    },
  ];

  const payrollColumns = [
    {
      key: 'person_id',
      label: 'Collaborateur',
      render: (payroll: Payroll) => {
        const source = payroll.person_type === 'teacher' ? teachers : staff;
        const person = source.find(item => item.id === payroll.person_id);
        return person ? `${person.first_name} ${person.last_name}` : 'Inconnu';
      },
    },
    {
      key: 'person_type',
      label: 'Type',
      render: (payroll: Payroll) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {payroll.person_type === 'teacher' ? 'Enseignant' : 'Administration'}
        </span>
      ),
    },
    {
      key: 'period',
      label: 'Période',
      render: (payroll: Payroll) => formatMonthYear(payroll.month, payroll.year),
    },
    { key: 'base_salary', label: 'Base', render: (payroll: Payroll) => formatCurrency(Number(payroll.base_salary)) },
    { key: 'bonuses', label: 'Primes', render: (payroll: Payroll) => formatCurrency(Number(payroll.bonuses)) },
    { key: 'deductions', label: 'Retenues', render: (payroll: Payroll) => formatCurrency(Number(payroll.deductions)) },
    { key: 'net_salary', label: 'Net', render: (payroll: Payroll) => <span className="font-semibold text-slate-900">{formatCurrency(Number(payroll.net_salary))}</span> },
    { key: 'status', label: 'Statut', render: (payroll: Payroll) => <Badge status={payroll.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (payroll: Payroll) => (
        <div className="flex gap-1">
          <button onClick={() => handlePrintPayslip(payroll)} className="rounded-full p-2 text-blue-600 transition hover:bg-blue-50" title="Imprimer le bulletin de paie">
            <Printer size={15} />
          </button>
          <button onClick={() => openEditPayroll(payroll)} className="rounded-full p-2 text-amber-600 transition hover:bg-amber-50">
            <Edit size={15} />
          </button>
          <button onClick={() => void handleDeletePayroll(payroll.id)} className="rounded-full p-2 text-red-500 transition hover:bg-red-50">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <Briefcase size={14} /> Administration & personnel
            </span>
            <h1 className="mt-4 display-font text-3xl font-semibold text-slate-900">Ressources humaines</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Gère le personnel administratif, les postes et la paie confidentielle des enseignants et du personnel.
            </p>
          </div>

          <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <Shield size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Confidentialité salariale</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Les salaires ne sont visibles et modifiables que par les administrateurs et comptables autorisés.
                </p>
              </div>
            </div>
            {!canManagePayroll && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm text-amber-700">
                Votre profil peut gérer les fiches du personnel, mais pas les rémunérations.
              </div>
            )}
          </div>
        </div>
      </section>

      {canManagePayroll && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={<WalletCards size={20} />} value={formatCurrency(payrollTotal)} label="Masse salariale suivie" color="blue" />
          <StatCard icon={<ReceiptText size={20} />} value={formatCurrency(payrollPaid)} label="Paie marquée comme versée" color="green" />
          <StatCard icon={<Shield size={20} />} value={formatCurrency(payrollPending)} label="Montant restant à régulariser" color="amber" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('staff')}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === 'staff'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
              : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          Personnel administratif
        </button>
        {canManagePayroll && (
          <button
            onClick={() => setTab('payroll')}
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              tab === 'payroll'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            Salaires & paie
          </button>
        )}
        {canManagePayroll && (
          <button
            onClick={() => setTab('contracts')}
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              tab === 'contracts'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            Contrats de travail
          </button>
        )}
      </div>

      {tab === 'staff' && (
        <section className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Administration de l'école</h2>
              <p className="mt-1 text-sm text-slate-500">{staff.filter(staffMember => staffMember.status === 'active').length} membre(s) actif(s)</p>
            </div>
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700">
              <Plus size={18} /> Nouveau membre de l'administration
            </button>
          </div>

          <DataTable
            columns={staffColumns}
            data={staff as any[]}
            searchKeys={['matricule', 'first_name', 'last_name', 'department', 'position']}
            searchPlaceholder="Rechercher un membre du personnel..."
            loading={loading}
          />
        </section>
      )}

      {tab === 'payroll' && canManagePayroll && (
        <section className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Paie confidentielle</h2>
              <p className="mt-1 text-sm text-slate-500">Fiches salariales du personnel enseignant et administratif.</p>
            </div>
            <button onClick={openCreatePayroll} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              <Plus size={18} /> Nouvelle fiche de paie
            </button>
          </div>

          {payrolls.length === 0 && !payrollLoading ? (
            <EmptyState
              icon={<WalletCards size={40} />}
              title="Aucune fiche salariale"
              description="Crée la première paie du personnel pour lancer le suivi des rémunérations."
              action={
                <button onClick={openCreatePayroll} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                  Créer une fiche
                </button>
              }
            />
          ) : (
            <DataTable
              columns={payrollColumns}
              data={payrolls as any[]}
              searchKeys={['person_type', 'status']}
              searchPlaceholder="Rechercher une fiche de paie..."
              loading={payrollLoading}
            />
          )}
        </section>
      )}
      {tab === 'contracts' && canManagePayroll && (
        <ContractsModule teachers={teachers} staff={staff} />
      )}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Modifier le personnel' : 'Nouveau membre du personnel'}
        size="lg"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveStaff()} disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
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
          <FormField label="Prénom" required>
            <input type="text" value={form.first_name} onChange={event => setForm({ ...form, first_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Nom" required>
            <input type="text" value={form.last_name} onChange={event => setForm({ ...form, last_name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Service">
            <select value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
              <option value="">Sélectionner</option>
              {STAFF_DEPARTMENTS.map(department => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Poste">
            <input
              list="staff-positions"
              value={form.position}
              onChange={event => setForm({ ...form, position: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
            <datalist id="staff-positions">
              {STAFF_POSITIONS.map(position => (
                <option key={position} value={position} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Téléphone">
            <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Email">
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Type de contrat">
            <select value={form.contract_type} onChange={event => setForm({ ...form, contract_type: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
              {CONTRACT_TYPES.map(contract => (
                <option key={contract.value} value={contract.value}>
                  {contract.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Date d'embauche">
            <input type="date" value={form.hire_date} onChange={event => setForm({ ...form, hire_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
        </div>
      </div>
    </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Fiche personnel" size="md">
        {selectedStaff && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-lg font-bold text-emerald-700">
                {getInitials(selectedStaff.first_name, selectedStaff.last_name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedStaff.first_name} {selectedStaff.last_name}</h3>
                <p className="text-sm text-slate-500">{selectedStaff.position || 'Fonction non renseignée'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Service :</span> <span className="font-medium text-slate-900">{selectedStaff.department || '-'}</span></div>
              <div><span className="text-slate-500">Contrat :</span> <span className="font-medium text-slate-900">{CONTRACT_TYPES.find(contract => contract.value === selectedStaff.contract_type)?.label || '-'}</span></div>
              <div><span className="text-slate-500">Téléphone :</span> <span className="font-medium text-slate-900">{selectedStaff.phone || '-'}</span></div>
              <div><span className="text-slate-500">Statut :</span> <Badge status={selectedStaff.status} /></div>
              <div><span className="text-slate-500">Embauche :</span> <span className="font-medium text-slate-900">{selectedStaff.hire_date ? formatDate(selectedStaff.hire_date) : '-'}</span></div>
              <div><span className="text-slate-500">Email :</span> <span className="font-medium text-slate-900">{selectedStaff.email || '-'}</span></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={payrollModalOpen}
        onClose={() => setPayrollModalOpen(false)}
        title={payrollEditMode ? 'Modifier une fiche de paie' : 'Nouvelle fiche de paie'}
        size="lg"
        actions={
          <>
            <button onClick={() => setPayrollModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSavePayroll()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {payrollNotice && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800 font-medium animate-in">
              {payrollNotice}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Type de collaborateur" required>
            <select
              value={payrollForm.person_type}
              onChange={event => setPayrollForm({
                ...payrollForm,
                person_type: event.target.value as 'teacher' | 'staff',
                person_id: '',
              })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
            >
              <option value="staff">Administration</option>
              <option value="teacher">Enseignant</option>
            </select>
          </FormField>
          <FormField label="Collaborateur" required>
            <select
              value={payrollForm.person_id}
              onChange={event => setPayrollForm({ ...payrollForm, person_id: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
            >
              <option value="">Sélectionner</option>
              {selectedPersonOptions.map(person => (
                <option key={person.id} value={person.id}>
                  {person.last_name} {person.first_name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Mois">
            <select value={payrollForm.month} onChange={event => setPayrollForm({ ...payrollForm, month: parseInt(event.target.value, 10) || 1 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              {MONTH_OPTIONS.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Année">
            <input type="number" value={payrollForm.year} onChange={event => setPayrollForm({ ...payrollForm, year: parseInt(event.target.value, 10) || new Date().getFullYear() })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <div className="md:col-span-2 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Éléments de Gains (Bruts)</h3>
          </div>
          <FormField label="Salaire de base">
            <input type="number" value={payrollForm.base_salary} onChange={event => setPayrollForm({ ...payrollForm, base_salary: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Sursalaire">
            <input type="number" value={payrollForm.sursalaire} onChange={event => setPayrollForm({ ...payrollForm, sursalaire: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Indemnité de transport">
            <input type="number" value={payrollForm.transport} onChange={event => setPayrollForm({ ...payrollForm, transport: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Ancienneté">
            <input type="number" value={payrollForm.anciennete} onChange={event => setPayrollForm({ ...payrollForm, anciennete: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Autres primes">
            <input type="number" value={payrollForm.autres_primes} onChange={event => setPayrollForm({ ...payrollForm, autres_primes: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Gratification">
            <input type="number" value={payrollForm.gratification} onChange={event => setPayrollForm({ ...payrollForm, gratification: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Congés payés">
            <input type="number" value={payrollForm.conges_payes} onChange={event => setPayrollForm({ ...payrollForm, conges_payes: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>

          <div className="md:col-span-2 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Éléments de Retenues (Déductions)</h3>
          </div>
          <FormField label="CNPS (Retraite - CR)">
            <input type="number" value={payrollForm.cr} onChange={event => setPayrollForm({ ...payrollForm, cr: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="ITS (Impôt sur salaire)">
            <input type="number" value={payrollForm.its} onChange={event => setPayrollForm({ ...payrollForm, its: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Impôt de solidarité">
            <input type="number" value={payrollForm.solidarite} onChange={event => setPayrollForm({ ...payrollForm, solidarite: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Crédit pharmacie">
            <input type="number" value={payrollForm.pharmacie} onChange={event => setPayrollForm({ ...payrollForm, pharmacie: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>

          <div className="md:col-span-2 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Règlement & Statut</h3>
          </div>
          <FormField label="Mode de paiement">
            <select value={payrollForm.mode_paiement} onChange={event => setPayrollForm({ ...payrollForm, mode_paiement: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              <option value="Virement">Virement bancaire</option>
              <option value="Espèces">Espèces</option>
              <option value="Chèque">Chèque</option>
              <option value="Mobile Money">Mobile Money</option>
            </select>
          </FormField>
          <FormField label="Statut">
            <select value={payrollForm.status} onChange={event => setPayrollForm({ ...payrollForm, status: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              {PAYROLL_STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Date de paiement">
              <input type="date" value={payrollForm.paid_date} onChange={event => setPayrollForm({ ...payrollForm, paid_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Net estimé</p>
          <p className="mt-2 display-font text-2xl font-semibold text-slate-900">{formatCurrency(netSalaryPreview)}</p>
        </div>
      </div>
    </Modal>
  </div>
  );
}
