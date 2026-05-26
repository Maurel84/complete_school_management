import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { buildPaymentReceiptHtml, downloadTextDocument, openPrintPreview } from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { recordAuditLog } from '../../lib/audit';
import type { CashRegister, School } from '../../types';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  Lock,
  Plus,
  Printer,
  Unlock,
  Wallet,
} from 'lucide-react';

type TransactionRow = {
  id: string;
  school_id: string;
  cash_register_id: string;
  transaction_number: string;
  type: string;
  amount: number;
  description: string;
  category: string;
  payment_id: string;
  processed_by: string;
  validated_by: string;
  validated: boolean;
  created_at: string;
  payment?: {
    id: string;
    school_id: string;
    student_id: string;
    fee_id: string;
    parent_id: string;
    receipt_number: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    status: string;
    academic_year_id: string;
    processed_by: string;
    notes: string;
    student?: {
      id: string;
      first_name: string;
      last_name: string;
      matricule: string;
      class?: { name: string };
    };
    parent?: { first_name: string; last_name: string; phone?: string; email?: string };
    fee?: { description?: string; fee_type?: { name: string } };
    processor?: { first_name: string; last_name: string };
  };
};

type TransactionPaymentSummary = NonNullable<TransactionRow['payment']>;
type TransactionStudentSummary = NonNullable<TransactionPaymentSummary['student']>;
type TransactionParentSummary = NonNullable<TransactionPaymentSummary['parent']>;
type TransactionFeeSummary = NonNullable<TransactionPaymentSummary['fee']>;
type TransactionProcessorSummary = NonNullable<TransactionPaymentSummary['processor']>;

export default function CashPage() {
  const { school, academicYear, academicYears } = useApp();
  const { isAdmin, isCashier, isAccountant, profile } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [activeRegister, setActiveRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'in', amount: 0, description: '', category: '' });

  useEffect(() => {
    if (!school) return;
    void fetchData();
  }, [school, academicYear]);

  function takeFirst<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  }

  function normalizeTransactionStudent(value: Record<string, unknown> | undefined): TransactionStudentSummary | undefined {
    if (!value) return undefined;

    return {
      id: String(value.id || ''),
      first_name: String(value.first_name || ''),
      last_name: String(value.last_name || ''),
      matricule: String(value.matricule || ''),
      class: takeFirst(value.class as { name: string } | Array<{ name: string }>) || undefined,
    };
  }

  function normalizeTransactionParent(value: Record<string, unknown> | undefined): TransactionParentSummary | undefined {
    if (!value) return undefined;

    return {
      first_name: String(value.first_name || ''),
      last_name: String(value.last_name || ''),
      phone: value.phone ? String(value.phone) : undefined,
      email: value.email ? String(value.email) : undefined,
    };
  }

  function normalizeTransactionFee(value: Record<string, unknown> | undefined): TransactionFeeSummary | undefined {
    if (!value) return undefined;

    return {
      description: value.description ? String(value.description) : undefined,
      fee_type: takeFirst(value.fee_type as { name: string } | Array<{ name: string }>) || undefined,
    };
  }

  function normalizeTransactionProcessor(value: Record<string, unknown> | undefined): TransactionProcessorSummary | undefined {
    if (!value) return undefined;

    return {
      first_name: String(value.first_name || ''),
      last_name: String(value.last_name || ''),
    };
  }

  async function fetchData() {
    if (!school) return;
    setLoading(true);
    const schoolId = school.id;

    const [regRes, txRes] = await Promise.all([
      supabase.from('cash_registers').select('*').eq('school_id', schoolId).order('opened_at', { ascending: false }),
      supabase
        .from('cash_transactions')
        .select('*, payment:payments(*, student:students(id, first_name, last_name, matricule, class:classes(name)), parent:parents(first_name, last_name, phone, email), fee:fees(description, fee_type:fee_types(name)), processor:profiles(first_name, last_name))')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
    ]);

    const cashRegisters = (regRes.data as CashRegister[]) || [];
    const normalizedTransactions: TransactionRow[] = ((txRes.data as Array<Record<string, unknown>>) || []).map(transaction => {
      const payment = takeFirst(transaction.payment as Record<string, unknown> | Array<Record<string, unknown>>);
      const rawStudent = payment ? takeFirst(payment.student as Record<string, unknown> | Array<Record<string, unknown>>) : undefined;
      const rawParent = payment ? takeFirst(payment.parent as Record<string, unknown> | Array<Record<string, unknown>>) : undefined;
      const rawFee = payment ? takeFirst(payment.fee as Record<string, unknown> | Array<Record<string, unknown>>) : undefined;
      const rawProcessor = payment ? takeFirst(payment.processor as Record<string, unknown> | Array<Record<string, unknown>>) : undefined;

      return {
        id: String(transaction.id || ''),
        school_id: String(transaction.school_id || ''),
        cash_register_id: String(transaction.cash_register_id || ''),
        transaction_number: String(transaction.transaction_number || ''),
        type: String(transaction.type || ''),
        amount: Number(transaction.amount || 0),
        description: String(transaction.description || ''),
        category: String(transaction.category || ''),
        payment_id: String(transaction.payment_id || ''),
        processed_by: String(transaction.processed_by || ''),
        validated_by: String(transaction.validated_by || ''),
        validated: Boolean(transaction.validated),
        created_at: String(transaction.created_at || ''),
        payment: payment
          ? {
              id: String(payment.id || ''),
              school_id: String(payment.school_id || ''),
              student_id: String(payment.student_id || ''),
              fee_id: String(payment.fee_id || ''),
              parent_id: String(payment.parent_id || ''),
              receipt_number: String(payment.receipt_number || ''),
              amount: Number(payment.amount || 0),
              payment_method: String(payment.payment_method || ''),
              payment_date: String(payment.payment_date || ''),
              status: String(payment.status || ''),
              academic_year_id: String(payment.academic_year_id || ''),
              processed_by: String(payment.processed_by || ''),
              notes: String(payment.notes || ''),
              student: normalizeTransactionStudent(rawStudent),
              parent: normalizeTransactionParent(rawParent),
              fee: normalizeTransactionFee(rawFee),
              processor: normalizeTransactionProcessor(rawProcessor),
            }
          : undefined,
      };
    });

    setRegisters(cashRegisters);
    setActiveRegister(cashRegisters.find(register => register.status === 'open') || null);
    setTransactions(normalizedTransactions);
    setLoading(false);
  }

  async function openRegister() {
    if (!school) return;
    setSaving(true);
    const { data } = await supabase.from('cash_registers').insert({
      school_id: school.id,
      cashier_id: profile?.id,
      opening_balance: 0,
      status: 'open',
    }).select().maybeSingle();

    if (data) setActiveRegister(data as CashRegister);
    setSaving(false);
    await fetchData();
  }

  async function closeRegister() {
    if (!activeRegister) return;

    const { data } = await supabase
      .from('cash_transactions')
      .select('amount, type')
      .eq('cash_register_id', activeRegister.id);

    const registerTransactions = data || [];
    const inTotal = registerTransactions.filter(item => item.type === 'in').reduce((sum, item) => sum + Number(item.amount), 0);
    const outTotal = registerTransactions.filter(item => item.type === 'out').reduce((sum, item) => sum + Number(item.amount), 0);

    await supabase.from('cash_registers').update({
      closing_balance: Number(activeRegister.opening_balance) + inTotal - outTotal,
      closed_at: new Date().toISOString(),
      status: 'closed',
    }).eq('id', activeRegister.id);

    await recordAuditLog({
      schoolId: school!.id,
      userId: profile?.id,
      action: 'cash_register_closed',
      entityType: 'cash_register',
      entityId: activeRegister.id,
      details: { inTotal, outTotal },
    });

    setActiveRegister(null);
    await fetchData();
  }

  async function handleSaveTransaction() {
    if (!school) return;
    setSaving(true);
    await supabase.from('cash_transactions').insert({
      school_id: school.id,
      cash_register_id: activeRegister?.id,
      transaction_number: `TRX-${Date.now()}`,
      ...form,
      processed_by: profile?.id,
      validated: isAdmin,
    });

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: 'cash_transaction_created',
      entityType: 'cash_transaction',
      details: { amount: form.amount, type: form.type, category: form.category },
    });

    setSaving(false);
    setModalOpen(false);
    setForm({ type: 'in', amount: 0, description: '', category: '' });
    await fetchData();
  }

  async function handleReceiptAction(transaction: TransactionRow, mode: 'print' | 'download') {
    const payment = transaction.payment;
    const student = payment?.student;
    if (!school || !payment || !student) return;

    const html = buildPaymentReceiptHtml({
      school: school as School,
      payment,
      student,
      academicYearName: academicYears.find(year => year.id === payment.academic_year_id)?.name || academicYear?.name,
      className: student.class?.name,
      parentName: payment.parent ? `${payment.parent.first_name} ${payment.parent.last_name}` : undefined,
      feeLabel: payment.fee?.fee_type?.name || payment.fee?.description || 'Paiement scolaire',
      processedByName: payment.processor ? `${payment.processor.first_name} ${payment.processor.last_name}` : undefined,
    });

    try {
      await saveGeneratedDocument({
        schoolId: school.id,
        entityType: 'payment',
        entityId: payment.id,
        documentType: 'receipt',
        title: `Recu ${payment.receipt_number}`,
        baseFileName: `recu-${payment.receipt_number}`,
        html,
        uploadedBy: profile?.id,
      });
    } catch (error) {
      console.error('Unable to persist receipt from cash page', error);
    }

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: mode === 'print' ? 'receipt_printed_from_cash' : 'receipt_downloaded_from_cash',
      entityType: 'payment',
      entityId: payment.id,
    });

    if (mode === 'print') {
      openPrintPreview(html);
      return;
    }

    downloadTextDocument(html, `recu-${payment.receipt_number}.html`);
  }

  const totalIn = transactions.filter(transaction => transaction.type === 'in').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalOut = transactions.filter(transaction => transaction.type === 'out').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const balance = totalIn - totalOut;

  const columns: Column<TransactionRow>[] = [
    { key: 'transaction_number', label: 'Transaction' },
    {
      key: 'type',
      label: 'Type',
      render: (transaction: TransactionRow) => (
        <span className={`inline-flex items-center gap-1 ${transaction.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
          {transaction.type === 'in' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {transaction.type === 'in' ? 'Entree' : 'Sortie'}
        </span>
      ),
    },
    {
      key: 'payment',
      label: 'Paiement',
      render: (transaction: TransactionRow) => transaction.payment?.receipt_number ? transaction.payment.receipt_number : '-',
    },
    {
      key: 'student',
      label: 'Eleve',
      render: (transaction: TransactionRow) => transaction.payment?.student ? `${transaction.payment.student.first_name} ${transaction.payment.student.last_name}` : '-',
    },
    { key: 'amount', label: 'Montant', render: (transaction: TransactionRow) => formatCurrency(Number(transaction.amount)) },
    { key: 'validated', label: 'Valide', render: (transaction: TransactionRow) => <Badge status={transaction.validated ? 'validated' : 'pending'} label={transaction.validated ? 'Oui' : 'En attente'} /> },
    { key: 'created_at', label: 'Date', render: (transaction: TransactionRow) => formatDateTime(transaction.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      render: (transaction: TransactionRow) => (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => { setSelectedTransaction(transaction); setDetailOpen(true); }} className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50">
            <Eye size={16} />
          </button>
          {transaction.payment?.id && (
            <button onClick={() => void handleReceiptAction(transaction, 'print')} className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50">
              <Printer size={16} />
            </button>
          )}
          {transaction.payment?.id && (
            <button onClick={() => void handleReceiptAction(transaction, 'download')} className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100">
              <Download size={16} />
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
            <h1 className="display-font text-3xl font-semibold text-slate-900">Caisse & encaissements</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              La caisse reprend les encaissements réels, les transactions manuelles et les paiements relies aux recus de l'ecole.
            </p>
          </div>
          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Etat de caisse</p>
            <p className="mt-3 display-font text-2xl font-semibold text-slate-900">{activeRegister ? 'Ouverte' : 'Fermee'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {activeRegister ? `Fond de caisse : ${formatCurrency(Number(activeRegister.opening_balance))}` : 'Ouvre une caisse pour journaliser les mouvements especes.'}
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Mouvements financiers</h2>
          <p className="mt-1 text-sm text-slate-500">Caisse, encaissements et recus relies</p>
        </div>
        <div className="flex gap-2">
          {activeRegister ? (
            <>
              <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                <Plus size={16} /> Transaction
              </button>
              <button onClick={() => void closeRegister()} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700">
                <Lock size={16} /> Fermer la caisse
              </button>
            </>
          ) : (
            <button onClick={() => void openRegister()} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Unlock size={16} /> Ouvrir la caisse
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<ArrowUpRight size={20} />} value={formatCurrency(totalIn)} label="Total entrees" color="green" />
        <StatCard icon={<ArrowDownRight size={20} />} value={formatCurrency(totalOut)} label="Total sorties" color="red" />
        <StatCard icon={<Wallet size={20} />} value={formatCurrency(balance)} label="Solde actuel" color="blue" />
      </div>

      {activeRegister && (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Caisse ouverte</p>
          <p className="mt-1 text-sm text-emerald-700">Les paiements en especes seront rattaches a cette session jusqu'a sa fermeture.</p>
        </div>
      )}

      <DataTable columns={columns} data={transactions} searchPlaceholder="Rechercher une transaction..." searchKeys={['transaction_number', 'description', 'category']} loading={loading} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouvelle transaction"
        size="md"
        actions={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveTransaction()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Type de transaction" required>
            <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              <option value="in">Entree d'argent</option>
              <option value="out">Sortie d'argent</option>
            </select>
          </FormField>
          <FormField label="Montant" required>
            <input type="number" value={form.amount} onChange={event => setForm({ ...form, amount: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Categorie">
            <input type="text" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Ex: fournitures, salaires..." className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Description">
            <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={2} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
        </div>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Detail du mouvement" size="lg">
        {selectedTransaction && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Transaction</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedTransaction.transaction_number}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDateTime(selectedTransaction.created_at)}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Montant</p>
                <p className={`mt-2 text-2xl font-semibold ${selectedTransaction.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(Number(selectedTransaction.amount))}
                </p>
                <div className="mt-3">
                  <Badge status={selectedTransaction.validated ? 'validated' : 'pending'} label={selectedTransaction.validated ? 'Valide' : 'En attente'} />
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Description</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTransaction.description || 'Aucune description.'}</p>
              <p className="mt-3 text-sm text-slate-500">Categorie : <strong className="text-slate-700">{selectedTransaction.category || '-'}</strong></p>
            </div>

            {selectedTransaction.payment && (
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Paiement associe</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {selectedTransaction.payment.receipt_number} • {selectedTransaction.payment.student ? `${selectedTransaction.payment.student.first_name} ${selectedTransaction.payment.student.last_name}` : 'Eleve'}
                    </p>
                    <p className="mt-2 text-sm text-emerald-700">
                      Date de paiement : {formatDate(selectedTransaction.payment.payment_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void handleReceiptAction(selectedTransaction, 'print')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                      <Printer size={16} /> Imprimer le recu
                    </button>
                    <button onClick={() => void handleReceiptAction(selectedTransaction, 'download')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                      <Download size={16} /> Telecharger
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
