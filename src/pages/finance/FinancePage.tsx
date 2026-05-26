import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { PAYMENT_METHODS, formatCurrency, formatDate, generateReceiptNumber } from '../../lib/utils';
import { buildPaymentReceiptHtml, downloadTextDocument, openPrintPreview } from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { recordAuditLog } from '../../lib/audit';
import type { CashRegister, Fee, FeeType, Level } from '../../types';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Download,
  Edit,
  Eye,
  Plus,
  Printer,
  Receipt,
} from 'lucide-react';

type PaymentRow = {
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
    photo_url?: string;
    class?: { name: string };
  };
  parent?: { id?: string; first_name: string; last_name: string; phone?: string; email?: string };
  fee?: { id?: string; description?: string; amount?: number; fee_type?: FeeType };
  processor?: { first_name: string; last_name: string };
};

type PaymentStudentSummary = NonNullable<PaymentRow['student']>;
type PaymentParentSummary = NonNullable<PaymentRow['parent']>;
type PaymentFeeSummary = NonNullable<PaymentRow['fee']>;
type PaymentProcessorSummary = NonNullable<PaymentRow['processor']>;

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string;
  photo_url: string;
  class?: { name: string };
};
type FamilyLinkOption = {
  id: string;
  student_id: string;
  parent_id: string;
  relationship: string;
  is_primary: boolean;
  is_billing_contact: boolean;
  is_pickup_authorized: boolean;
  emergency_priority: number;
  notes: string;
  parent?: { id: string; first_name: string; last_name: string; phone?: string; email?: string };
};
type ParentLinkLookup = Record<string, FamilyLinkOption[]>;

const EMPTY_PAYMENT_FORM = {
  student_id: '',
  parent_id: '',
  fee_id: '',
  amount: 0,
  payment_method: 'cash',
  payment_date: new Date().toISOString().split('T')[0],
  status: 'paid',
  notes: '',
};

const EMPTY_FEE_FORM = {
  fee_type_id: '',
  amount: 0,
  level_id: '',
  class_id: '',
  due_date: '',
  description: '',
};

export default function FinancePage() {
  const { school, academicYear, academicYears } = useApp();
  const { isAdmin, isDirector, isCashier, isAccountant, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [familyLinksByStudent, setFamilyLinksByStudent] = useState<ParentLinkLookup>({});
  const [activeRegister, setActiveRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'payments' | 'fees' | 'discounts'>('payments');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [feeForm, setFeeForm] = useState(EMPTY_FEE_FORM);

  const canManagePayments = isAdmin || isDirector || isCashier || isAccountant;

  useEffect(() => {
    if (!school) return;
    void fetchData();
  }, [school, academicYear]);

  function takeFirst<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  }

  function normalizePaymentStudent(value: Record<string, unknown> | undefined): PaymentStudentSummary | undefined {
    if (!value) return undefined;

    return {
      id: String(value.id || ''),
      first_name: String(value.first_name || ''),
      last_name: String(value.last_name || ''),
      matricule: String(value.matricule || ''),
      photo_url: value.photo_url ? String(value.photo_url) : undefined,
      class: takeFirst(value.class as { name: string } | Array<{ name: string }>) || undefined,
    };
  }

  function normalizePaymentParent(value: Record<string, unknown> | undefined): PaymentParentSummary | undefined {
    if (!value) return undefined;

    return {
      id: value.id ? String(value.id) : undefined,
      first_name: String(value.first_name || ''),
      last_name: String(value.last_name || ''),
      phone: value.phone ? String(value.phone) : undefined,
      email: value.email ? String(value.email) : undefined,
    };
  }

  function normalizePaymentFee(value: Record<string, unknown> | undefined): PaymentFeeSummary | undefined {
    if (!value) return undefined;

    return {
      id: value.id ? String(value.id) : undefined,
      description: value.description ? String(value.description) : undefined,
      amount: value.amount ? Number(value.amount) : undefined,
      fee_type: takeFirst(value.fee_type as FeeType | FeeType[]) || undefined,
    };
  }

  function normalizePaymentProcessor(value: Record<string, unknown> | undefined): PaymentProcessorSummary | undefined {
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

    const [paymentRes, feeRes, feeTypeRes, studentRes, levelRes, familyRes, registerRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, student:students(id, first_name, last_name, matricule, photo_url, class:classes(name)), parent:parents(id, first_name, last_name, phone, email), fee:fees(*, fee_type:fee_types(*)), processor:profiles(first_name, last_name)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabase.from('fees').select('*, fee_type:fee_types(*)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('fee_types').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('id, first_name, last_name, matricule, photo_url, class:classes(name)').eq('school_id', schoolId).eq('status', 'active').order('last_name'),
      supabase.from('levels').select('*').eq('school_id', schoolId).order('order_index'),
      supabase.from('student_parents').select('id, student_id, parent_id, relationship, is_primary, is_billing_contact, is_pickup_authorized, emergency_priority, notes, parent:parents(id, first_name, last_name, phone, email)'),
      supabase.from('cash_registers').select('*').eq('school_id', schoolId).eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const normalizedFamilyLinks: FamilyLinkOption[] = ((familyRes.data as Array<Record<string, unknown>>) || []).map(link => ({
      id: String(link.id || ''),
      student_id: String(link.student_id || ''),
      parent_id: String(link.parent_id || ''),
      relationship: String(link.relationship || 'pere'),
      is_primary: Boolean(link.is_primary),
      is_billing_contact: Boolean(link.is_billing_contact),
      is_pickup_authorized: Boolean(link.is_pickup_authorized),
      emergency_priority: Number(link.emergency_priority || 1),
      notes: String(link.notes || ''),
      parent: takeFirst(link.parent as { id: string; first_name: string; last_name: string; phone?: string; email?: string } | Array<{ id: string; first_name: string; last_name: string; phone?: string; email?: string }>),
    }));

    const familyMap = normalizedFamilyLinks.reduce<ParentLinkLookup>((accumulator, link) => {
      if (!accumulator[link.student_id]) {
        accumulator[link.student_id] = [];
      }
      accumulator[link.student_id].push(link);
      return accumulator;
    }, {});

    const normalizedPayments: PaymentRow[] = ((paymentRes.data as Array<Record<string, unknown>>) || []).map(payment => {
      const rawStudent = takeFirst(payment.student as Record<string, unknown> | Array<Record<string, unknown>>);
      const rawParent = takeFirst(payment.parent as Record<string, unknown> | Array<Record<string, unknown>>);
      const rawFee = takeFirst(payment.fee as Record<string, unknown> | Array<Record<string, unknown>>);
      const rawProcessor = takeFirst(payment.processor as Record<string, unknown> | Array<Record<string, unknown>>);

      return {
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
        student: normalizePaymentStudent(rawStudent),
        parent: normalizePaymentParent(rawParent),
        fee: normalizePaymentFee(rawFee),
        processor: normalizePaymentProcessor(rawProcessor),
      };
    });

    const normalizedStudents: StudentOption[] = ((studentRes.data as Array<Record<string, unknown>>) || []).map(student => ({
      id: String(student.id || ''),
      first_name: String(student.first_name || ''),
      last_name: String(student.last_name || ''),
      matricule: String(student.matricule || ''),
      photo_url: String(student.photo_url || ''),
      class: takeFirst(student.class as { name: string } | Array<{ name: string }>),
    }));

    setPayments(normalizedPayments);
    setFees((feeRes.data as Fee[]) || []);
    setFeeTypes((feeTypeRes.data as FeeType[]) || []);
    setStudents(normalizedStudents);
    setLevels((levelRes.data as Level[]) || []);
    setFamilyLinksByStudent(familyMap);
    setActiveRegister((registerRes.data as CashRegister) || null);
    setLoading(false);
  }

  function getParentOptionsForStudent(studentId: string) {
    return (familyLinksByStudent[studentId] || []).slice().sort((left, right) => {
      if (left.is_billing_contact === right.is_billing_contact) {
        if (left.is_primary === right.is_primary) {
          return (left.emergency_priority || 99) - (right.emergency_priority || 99);
        }
        return left.is_primary ? -1 : 1;
      }
      return left.is_billing_contact ? -1 : 1;
    });
  }

  function openCreatePayment() {
    setEditMode(false);
    setSelectedPayment(null);
    setNotice(null);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setPaymentModalOpen(true);
  }

  function openEditPayment(payment: PaymentRow) {
    setEditMode(true);
    setSelectedPayment(payment);
    setNotice(null);
    setPaymentForm({
      student_id: payment.student_id,
      parent_id: payment.parent_id || '',
      fee_id: payment.fee_id || '',
      amount: Number(payment.amount),
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      status: payment.status,
      notes: payment.notes || '',
    });
    setPaymentModalOpen(true);
  }

  function openPaymentDetail(payment: PaymentRow) {
    setSelectedPayment(payment);
    setPaymentDetailOpen(true);
  }

  function handleStudentChange(studentId: string) {
    const recommendedParent = getParentOptionsForStudent(studentId)[0];
    setPaymentForm(current => ({
      ...current,
      student_id: studentId,
      parent_id: recommendedParent?.parent_id || '',
    }));
  }

  function handleFeeChange(feeId: string) {
    const selectedFee = fees.find(fee => fee.id === feeId);
    setPaymentForm(current => ({
      ...current,
      fee_id: feeId,
      amount: selectedFee ? Number(selectedFee.amount) : current.amount,
    }));
  }

  async function syncCashTransaction(paymentId: string, studentName: string, amount: number, paymentMethod: string) {
    if (!school) return;

    const { data: existingTransaction } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('payment_id', paymentId)
      .maybeSingle();

    const needsRegisterEntry = paymentMethod === 'cash';

    if (!needsRegisterEntry && existingTransaction?.id) {
      await supabase.from('cash_transactions').delete().eq('id', existingTransaction.id);
      return;
    }

    if (!needsRegisterEntry) return;

    if (!existingTransaction?.id && !activeRegister?.id) {
      throw new Error("Ouvre d'abord une caisse avant d'enregistrer un paiement en especes.");
    }

    const payload = {
      school_id: school.id,
      cash_register_id: existingTransaction?.cash_register_id || activeRegister?.id || null,
      transaction_number: existingTransaction?.transaction_number || `TRX-${Date.now()}`,
      type: 'in',
      amount,
      description: `Paiement - ${studentName}`,
      category: 'payment',
      payment_id: paymentId,
      processed_by: profile?.id,
      validated: true,
    };

    if (existingTransaction?.id) {
      await supabase.from('cash_transactions').update(payload).eq('id', existingTransaction.id);
      return;
    }

    await supabase.from('cash_transactions').insert(payload);
  }

  async function handleSavePayment() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    try {
      const selectedStudent = students.find(student => student.id === paymentForm.student_id);
      if (!selectedStudent) {
        throw new Error('Selectionne un eleve avant de valider le paiement.');
      }

      const payload = {
        ...paymentForm,
        school_id: school.id,
        academic_year_id: academicYear?.id,
        processed_by: profile?.id,
        amount: Number(paymentForm.amount) || 0,
        parent_id: paymentForm.parent_id || null,
        fee_id: paymentForm.fee_id || null,
      };

      let savedPaymentId = selectedPayment?.id || '';

      if (editMode && selectedPayment) {
        await supabase.from('payments').update(payload).eq('id', selectedPayment.id);
        savedPaymentId = selectedPayment.id;
      } else {
        const { data } = await supabase
          .from('payments')
          .insert({
            ...payload,
            receipt_number: generateReceiptNumber(),
          })
          .select('id')
          .single();

        if (!data?.id) {
          throw new Error("Le paiement a ete cree mais son identifiant n'a pas pu etre relu.");
        }

        savedPaymentId = data.id;
      }

      await syncCashTransaction(
        savedPaymentId,
        `${selectedStudent.last_name} ${selectedStudent.first_name}`,
        Number(paymentForm.amount) || 0,
        paymentForm.payment_method,
      );

      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        action: editMode ? 'payment_updated' : 'payment_created',
        entityType: 'payment',
        entityId: savedPaymentId,
        details: {
          student_id: paymentForm.student_id,
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
        },
      });

      setPaymentModalOpen(false);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      setSelectedPayment(null);
      setEditMode(false);
      await fetchData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Le paiement n'a pas pu etre enregistre.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFee() {
    if (!school) return;
    setSaving(true);

    await supabase.from('fees').insert({
      ...feeForm,
      school_id: school.id,
      academic_year_id: academicYear?.id,
    });

    setSaving(false);
    setFeeModalOpen(false);
    setFeeForm(EMPTY_FEE_FORM);
    await fetchData();
  }

  async function handleReceiptAction(payment: PaymentRow, mode: 'print' | 'download') {
    if (!school || !payment.student) return;

    const paymentMethodLabel = PAYMENT_METHODS.find(method => method.value === payment.payment_method)?.label || payment.payment_method;
    const html = buildPaymentReceiptHtml({
      school,
      payment: { ...payment, payment_method: paymentMethodLabel },
      student: payment.student,
      academicYearName: academicYears.find(year => year.id === payment.academic_year_id)?.name,
      className: payment.student.class?.name,
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
      console.error('Unable to persist receipt document', error);
    }

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: mode === 'print' ? 'receipt_printed' : 'receipt_downloaded',
      entityType: 'payment',
      entityId: payment.id,
      details: { receipt_number: payment.receipt_number },
    });

    if (mode === 'print') {
      openPrintPreview(html);
      return;
    }

    downloadTextDocument(html, `recu-${payment.receipt_number}.html`);
  }

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalFees = fees.reduce((sum, fee) => sum + Number(fee.amount), 0);
  const cashPayments = payments.filter(payment => payment.payment_method === 'cash').reduce((sum, payment) => sum + Number(payment.amount), 0);

  const paymentColumns: Column<PaymentRow>[] = [
    { key: 'receipt_number', label: 'Recu' },
    {
      key: 'student',
      label: 'Eleve',
      render: (payment: PaymentRow) => payment.student ? `${payment.student.first_name} ${payment.student.last_name}` : '-',
    },
    {
      key: 'parent',
      label: 'Payeur',
      render: (payment: PaymentRow) => payment.parent ? `${payment.parent.first_name} ${payment.parent.last_name}` : '-',
    },
    { key: 'amount', label: 'Montant', render: (payment: PaymentRow) => formatCurrency(Number(payment.amount)) },
    {
      key: 'payment_method',
      label: 'Mode',
      render: (payment: PaymentRow) => PAYMENT_METHODS.find(method => method.value === payment.payment_method)?.label || payment.payment_method,
    },
    { key: 'payment_date', label: 'Date', render: (payment: PaymentRow) => formatDate(payment.payment_date) },
    { key: 'status', label: 'Statut', render: (payment: PaymentRow) => <Badge status={payment.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (payment: PaymentRow) => (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => openPaymentDetail(payment)} className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50">
            <Eye size={16} />
          </button>
          {canManagePayments && (
            <button onClick={() => openEditPayment(payment)} className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50">
              <Edit size={16} />
            </button>
          )}
          <button onClick={() => void handleReceiptAction(payment, 'print')} className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50">
            <Printer size={16} />
          </button>
          <button onClick={() => void handleReceiptAction(payment, 'download')} className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100">
            <Download size={16} />
          </button>
        </div>
      ),
    },
  ];

  const feeColumns: Column<Fee>[] = [
    { key: 'fee_type', label: 'Type de frais', render: (fee: Fee & { fee_type?: FeeType }) => fee.fee_type?.name || '-' },
    {
      key: 'academic_year_id',
      label: 'Annee',
      render: (fee: Fee) => academicYears.find(year => year.id === fee.academic_year_id)?.name || '-',
    },
    {
      key: 'level_id',
      label: 'Niveau',
      render: (fee: Fee) => levels.find(level => level.id === fee.level_id)?.name || 'Tous les niveaux',
    },
    { key: 'amount', label: 'Montant', render: (fee: Fee) => formatCurrency(Number(fee.amount)) },
    { key: 'due_date', label: 'Echeance', render: (fee: Fee) => fee.due_date ? formatDate(fee.due_date) : '-' },
    { key: 'description', label: 'Description' },
  ];

  const parentOptions = useMemo(
    () => getParentOptionsForStudent(paymentForm.student_id),
    [familyLinksByStudent, paymentForm.student_id],
  );

  const tabs = [
    { key: 'payments', label: 'Paiements' },
    { key: 'fees', label: 'Frais academiques' },
    { key: 'discounts', label: 'Remises & bourses' },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">Finances scolaires & recus</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Les paiements sont maintenant lies aux eleves, aux responsables payeurs, a la caisse et a des recus imprimables ou telechargeables.
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Caisse active</p>
            <p className="mt-3 display-font text-2xl font-semibold text-slate-900">{activeRegister ? 'Ouverte' : 'Non ouverte'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {activeRegister ? 'Les paiements en especes seront rattaches a la caisse en cours.' : "Ouvre la caisse pour journaliser les paiements en especes."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<DollarSign size={20} />} value={formatCurrency(totalPaid)} label="Total encaisse" color="green" />
        <StatCard icon={<CheckCircle size={20} />} value={payments.length} label="Paiements enregistres" color="blue" />
        <StatCard icon={<Receipt size={20} />} value={formatCurrency(cashPayments)} label="Paiements especes" color="amber" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as 'payments' | 'fees' | 'discounts')}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                tab === tabItem.key
                  ? 'bg-slate-900 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]'
                  : 'bg-white/75 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {canManagePayments && (
          <div className="flex flex-wrap gap-2">
            <button onClick={openCreatePayment} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              <Plus size={16} /> Nouveau paiement
            </button>
            <button onClick={() => setFeeModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700">
              <Plus size={16} /> Nouveau frais
            </button>
          </div>
        )}
      </div>

      {tab === 'payments' && (
        <DataTable columns={paymentColumns} data={payments} searchPlaceholder="Rechercher un paiement..." searchKeys={['receipt_number', 'status', 'notes']} loading={loading} />
      )}

      {tab === 'fees' && (
        <DataTable columns={feeColumns} data={fees} searchPlaceholder="Rechercher un frais..." searchKeys={['description']} loading={loading} />
      )}

      {tab === 'discounts' && (
        <div className="surface-card p-8 text-center text-slate-400">
          Les remises, bourses et exonérations pourront maintenant s'appuyer sur les familles et les responsables financiers.
        </div>
      )}

      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={editMode ? 'Modifier le paiement' : 'Nouveau paiement'}
        size="lg"
        actions={
          <>
            <button onClick={() => setPaymentModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSavePayment()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {editMode ? 'Mettre a jour' : 'Enregistrer le paiement'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {notice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Eleve" required>
              <select value={paymentForm.student_id} onChange={event => handleStudentChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="">Selectionner un eleve</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.last_name} {student.first_name} ({student.matricule})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Responsable payeur">
              <select value={paymentForm.parent_id} onChange={event => setPaymentForm({ ...paymentForm, parent_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="">Selectionner un responsable</option>
                {parentOptions.map(link => (
                  <option key={link.parent_id} value={link.parent_id}>
                    {link.parent ? `${link.parent.last_name} ${link.parent.first_name}` : 'Parent'}{link.is_billing_contact ? ' • paiement' : link.is_primary ? ' • principal' : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Frais">
              <select value={paymentForm.fee_id} onChange={event => handleFeeChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="">Selectionner un frais</option>
                {fees.map(fee => (
                  <option key={fee.id} value={fee.id}>
                    {(fee as Fee & { fee_type?: FeeType }).fee_type?.name || 'Frais'} - {formatCurrency(Number(fee.amount))}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Montant" required>
              <input type="number" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>

            <FormField label="Mode de paiement">
              <select value={paymentForm.payment_method} onChange={event => setPaymentForm({ ...paymentForm, payment_method: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                {PAYMENT_METHODS.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date de paiement">
              <input type="date" value={paymentForm.payment_date} onChange={event => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>

            <FormField label="Statut">
              <select value={paymentForm.status} onChange={event => setPaymentForm({ ...paymentForm, status: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
                <option value="paid">Paye</option>
                <option value="partial">Partiel</option>
              </select>
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea value={paymentForm.notes} onChange={event => setPaymentForm({ ...paymentForm, notes: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Les paiements en especes sont relies a la caisse ouverte. Les autres modes restent traces dans le dossier financier sans mouvement de caisse.
          </div>
        </div>
      </Modal>

      <Modal isOpen={feeModalOpen} onClose={() => setFeeModalOpen(false)} title="Nouveau frais" size="md"
        actions={
          <>
            <button onClick={() => setFeeModalOpen(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void handleSaveFee()} disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Type de frais" required>
            <select value={feeForm.fee_type_id} onChange={event => setFeeForm({ ...feeForm, fee_type_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              <option value="">Selectionner</option>
              {feeTypes.map(feeType => (
                <option key={feeType.id} value={feeType.id}>
                  {feeType.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Niveau concerne">
            <select value={feeForm.level_id} onChange={event => setFeeForm({ ...feeForm, level_id: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10">
              <option value="">Tous les niveaux</option>
              {levels.map(level => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Montant" required>
            <input type="number" value={feeForm.amount} onChange={event => setFeeForm({ ...feeForm, amount: parseFloat(event.target.value) || 0 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Echeance">
            <input type="date" value={feeForm.due_date} onChange={event => setFeeForm({ ...feeForm, due_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
          <FormField label="Description">
            <textarea value={feeForm.description} onChange={event => setFeeForm({ ...feeForm, description: event.target.value })} rows={2} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
          </FormField>
        </div>
      </Modal>

      <Modal isOpen={paymentDetailOpen} onClose={() => setPaymentDetailOpen(false)} title="Detail du paiement" size="lg">
        {selectedPayment && (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recu</p>
                  <h3 className="display-font mt-2 text-2xl font-semibold text-slate-900">{selectedPayment.receipt_number}</h3>
                  <p className="mt-2 text-sm text-slate-500">{formatDate(selectedPayment.payment_date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void handleReceiptAction(selectedPayment, 'print')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                    <Printer size={16} /> Imprimer
                  </button>
                  <button onClick={() => void handleReceiptAction(selectedPayment, 'download')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                    <Download size={16} /> Telecharger
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Eleve</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedPayment.student ? `${selectedPayment.student.first_name} ${selectedPayment.student.last_name}` : '-'}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedPayment.student?.matricule || '-'}</p>
                <p className="mt-3 text-sm text-slate-600">Classe : <strong>{selectedPayment.student?.class?.name || '-'}</strong></p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Responsable payeur</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedPayment.parent ? `${selectedPayment.parent.first_name} ${selectedPayment.parent.last_name}` : 'Non renseigne'}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedPayment.parent?.phone || selectedPayment.parent?.email || '-'}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Montant</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(Number(selectedPayment.amount))}</p>
                <p className="mt-3 text-sm text-slate-600">Mode : <strong>{PAYMENT_METHODS.find(method => method.value === selectedPayment.payment_method)?.label || selectedPayment.payment_method}</strong></p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Affectation</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedPayment.fee?.fee_type?.name || 'Paiement scolaire'}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedPayment.fee?.description || 'Sans description'}</p>
                <div className="mt-3">
                  <Badge status={selectedPayment.status} />
                </div>
              </div>
            </div>

            {selectedPayment.notes && (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Notes</p>
                <p className="mt-2 leading-6">{selectedPayment.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
