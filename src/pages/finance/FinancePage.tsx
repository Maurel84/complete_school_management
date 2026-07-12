import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import { PAYMENT_METHODS, formatCurrency, formatDate } from '../../lib/utils';
import { buildPaymentReceiptHtml, openPrintPreview } from '../../lib/printableDocuments';
import { useFinance } from '../../hooks/useFinance';

import FinanceDashboard from './components/FinanceDashboard';
import StudentDebts from './components/StudentDebts';
import CanteenModule from './components/CanteenModule';
import FinanceAdminConfig from './components/FinanceAdminConfig';
import FinanceReports from './components/FinanceReports';
import PaymentFormModal from './components/PaymentFormModal';

import {
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  Plus,
  Printer,
  Settings,
  Utensils,
} from 'lucide-react';

export default function FinancePage() {
  const { school, academicYear, academicYears } = useApp();
  const { profile, isAdmin, isDirector, isCashier, isAccountant } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'payments' | 'debts' | 'canteen' | 'reports' | 'admin'>('dashboard');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const canManage = isAdmin || isDirector || isCashier || isAccountant;
  const canConfig = isAdmin || isDirector;

  const schoolId = school?.id;
  const yearId = academicYear?.id;

  // Custom hook containing plans, student assignments, installments, canteen payments
  const {
    plansQuery,
    studentFeesQuery,
    studentInstallmentsQuery,
    canteenPaymentsQuery,
    savePlan,
    assignStudentPlan,
    saveDetailedPayment,
    saveCanteenPayment,
  } = useFinance(schoolId, yearId);

  // Query: tuition payments list
  const paymentsQuery = useQuery({
    queryKey: ['payments_all', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          student:students(id, first_name, last_name, matricule, class:classes(name, level_id)),
          parent:parents(id, first_name, last_name, phone, email),
          processor:profiles(first_name, last_name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Query: active student profiles (with their parents list)
  const studentsQuery = useQuery({
    queryKey: ['students_finance', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, matricule, class_id, phone, status,
          class:classes(name, level_id),
          parents:student_parents(parent_id, relationship, parent:parents(id, first_name, last_name, phone, email))
        `)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('last_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Query: classes
  const classesQuery = useQuery({
    queryKey: ['classes_finance', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Query: levels
  const levelsQuery = useQuery({
    queryKey: ['levels_finance', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('school_id', schoolId)
        .order('order_index');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Query: Active Cash Register (caisse)
  const activeRegisterQuery = useQuery({
    queryKey: ['cash_register_active', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('school_id', schoolId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Helper to record transaction to cash register if payment mode is cash
  async function syncCashRegisterTransaction(paymentId: string, studentName: string, amount: number, isCanteen = false) {
    const register = activeRegisterQuery.data;
    if (!register?.id) return; // Cashier register is closed

    const payload = {
      school_id: schoolId,
      cash_register_id: register.id,
      transaction_number: `TRX-${Date.now()}`,
      type: 'in',
      amount,
      description: `${isCanteen ? 'Cantine' : 'Frais Scolaires'} - ${studentName}`,
      category: 'payment',
      payment_id: isCanteen ? null : paymentId,
      processed_by: profile?.id,
      validated: true,
    };

    await supabase.from('cash_transactions').insert(payload);
  }

  // Register standard tuition payment
  async function handleSaveTuitionPayment(payload: any, details: any[], qrHash: string, digitalSig: string) {
    setSavingPayment(true);
    try {
      const student = (studentsQuery.data || []).find((s: any) => s.id === payload.student_id);
      const studentName = student ? `${student.last_name} ${student.first_name}` : 'Élève';

      // 1. Save payment details and receipt hash
      const payment = await saveDetailedPayment({
        paymentData: payload,
        details,
        profile,
        qrHash,
        digitalSig,
      });

      // 2. Sync to active register if Cash payment
      if (payload.payment_method === 'cash') {
        await syncCashRegisterTransaction(payment.id, studentName, payload.amount, false);
      }

      setPaymentModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['payments_all', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, yearId] });
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingPayment(false);
    }
  }

  // Register canteen payment
  async function handleSaveCanteenPayment(payload: any, qrHash: string, digitalSig: string) {
    setSavingPayment(true);
    try {
      const student = (studentsQuery.data || []).find((s: any) => s.id === payload.student_id);
      const studentName = student ? `${student.last_name} ${student.first_name}` : 'Élève';

      await saveCanteenPayment({
        canteenData: payload,
        profile,
        qrHash,
        digitalSig,
      });

      if (payload.payment_method === 'cash') {
        await syncCashRegisterTransaction('', studentName, payload.amount, true);
      }

      setPaymentModalOpen(false);
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingPayment(false);
    }
  }

  // Fetch receipt metadata and trigger print preview
  async function handlePrintReceipt(p: any, isCanteen = false) {
    if (!school) return;

    // Fetch details & metadata
    const [receiptRes, detailsRes] = await Promise.all([
      supabase
        .from('receipts')
        .select('*')
        .eq(isCanteen ? 'canteen_payment_id' : 'payment_id', p.id)
        .maybeSingle(),
      isCanteen
        ? Promise.resolve({ data: [] })
        : supabase.from('payment_details').select('*').eq('payment_id', p.id),
    ]);

    const receiptMeta = receiptRes.data;
    const compositions = detailsRes.data || [];

    const paymentMethodLabel =
      PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method;

    const html = buildPaymentReceiptHtml({
      school,
      payment: { ...p, payment_method: paymentMethodLabel },
      student: p.student || { first_name: '', last_name: '', matricule: '' },
      academicYearName: academicYears.find(y => y.id === p.academic_year_id)?.name,
      className: p.student?.class?.name || '-',
      parentName: p.parent ? `${p.parent.first_name} ${p.parent.last_name}` : 'Parent',
      feeLabel: isCanteen ? `Cantine scolaire - Trimestre ${p.trimester}` : 'Scolarité annuelle',
      processedByName: p.processor ? `${p.processor.first_name} ${p.processor.last_name}` : undefined,
      compositions: compositions.length > 0 ? compositions : undefined,
      qrCodeHash: receiptMeta?.qr_code_hash,
      digitalSignature: receiptMeta?.digital_signature,
    });

    openPrintPreview(html);
  }

  // Assign tuition plan to a student (done in administration or student profile)
  async function handleAssignStudentPlan(studentId: string, planId: string, canteenOption: string, discount: number) {
    try {
      await assignStudentPlan({ studentId, planId, canteenOption, discountAmount: discount, profile });
      alert('Plan de scolarité assigné avec succès !');
    } catch (e: any) {
      alert(`Erreur d'assignation : ${e.message}`);
    }
  }

  // Columns for the simple list of tuition payments
  const paymentsColumns: Column<any>[] = [
    { key: 'receipt_number', label: 'Reçu' },
    {
      key: 'student',
      label: 'Élève',
      render: row => (row.student ? `${row.student.first_name} ${row.student.last_name}` : '-'),
    },
    {
      key: 'parent',
      label: 'Responsable',
      render: row => (row.parent ? `${row.parent.first_name} ${row.parent.last_name}` : '-'),
    },
    { key: 'amount', label: 'Montant', render: row => formatCurrency(Number(row.amount)) },
    {
      key: 'payment_method',
      label: 'Mode',
      render: row => PAYMENT_METHODS.find(m => m.value === row.payment_method)?.label || row.payment_method,
    },
    { key: 'payment_date', label: 'Date', render: row => formatDate(row.payment_date) },
    { key: 'status', label: 'Statut', render: row => <Badge status={row.status} /> },
    {
      key: 'actions',
      label: 'Imprimer',
      render: row => (
        <button
          onClick={() => void handlePrintReceipt(row, false)}
          className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 transition"
        >
          <Printer size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Top bar */}
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">Module Financier</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Gestion de la facturation par tranches, ventilation de premier versement, cantine trimestrielle et reçus sécurisés.
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <div className="flex justify-between items-center">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Registre de Caisse</p>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  activeRegisterQuery.data ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
            </div>
            <p className="mt-2 display-font text-xl font-bold text-slate-800">
              {activeRegisterQuery.data ? 'Caisse Ouverte' : 'Caisse Fermée'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {activeRegisterQuery.data
                ? 'Les versements en espèces sont enregistrés dans le journal de caisse en cours.'
                : 'Ouvrez un tiroir-caisse dans le module caisse pour comptabiliser les paiements physiques.'}
            </p>
          </div>
        </div>
      </section>

      {/* Tabs list */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={15} /> },
            { key: 'payments', label: 'Versements Scolarité', icon: <History size={15} /> },
            { key: 'debts', label: 'Suivi des Dettes', icon: <DollarSign size={15} /> },
            { key: 'canteen', label: 'Module Cantine', icon: <Utensils size={15} /> },
            { key: 'reports', label: 'Rapports & Balance', icon: <FileSpreadsheet size={15} /> },
            { key: 'admin', label: 'Tarifs & Config', icon: <Settings size={15} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                tab === t.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {canManage && (
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-slate-800 shadow-sm"
          >
            <Plus size={15} /> Nouveau versement
          </button>
        )}
      </div>

      {/* Rendering panels */}
      {tab === 'dashboard' && (
        <FinanceDashboard
          students={studentsQuery.data || []}
          payments={paymentsQuery.data || []}
          canteenPayments={canteenPaymentsQuery.data || []}
          studentFees={studentFeesQuery.data || []}
          studentInstallments={studentInstallmentsQuery.data || []}
          levels={levelsQuery.data || []}
          classes={classesQuery.data || []}
        />
      )}

      {tab === 'payments' && (
        <div className="surface-card p-6 space-y-4">
          <h2 className="display-font text-lg font-semibold text-slate-900">Historique général de Scolarité</h2>
          <DataTable
            columns={paymentsColumns}
            data={paymentsQuery.data || []}
            searchPlaceholder="Rechercher un versement..."
            searchKeys={['receipt_number', 'notes']}
            loading={paymentsQuery.isLoading}
          />
        </div>
      )}

      {tab === 'debts' && (
        <StudentDebts
          students={studentsQuery.data || []}
          payments={paymentsQuery.data || []}
          canteenPayments={canteenPaymentsQuery.data || []}
          studentFees={studentFeesQuery.data || []}
          studentInstallments={studentInstallmentsQuery.data || []}
          classes={classesQuery.data || []}
        />
      )}

      {tab === 'canteen' && (
        <CanteenModule
          canteenPayments={canteenPaymentsQuery.data || []}
          onPrintReceipt={p => void handlePrintReceipt(p, true)}
        />
      )}

      {tab === 'reports' && (
        <FinanceReports
          students={studentsQuery.data || []}
          payments={paymentsQuery.data || []}
          canteenPayments={canteenPaymentsQuery.data || []}
          studentFees={studentFeesQuery.data || []}
          studentInstallments={studentInstallmentsQuery.data || []}
          levels={levelsQuery.data || []}
          classes={classesQuery.data || []}
        />
      )}

      {tab === 'admin' && (
        <FinanceAdminConfig
          plans={plansQuery.data || []}
          levels={levelsQuery.data || []}
          onSavePlan={async (plan, planId) => {
            await savePlan({ plan, planId, profile });
          }}
          saving={plansQuery.isRefetching}
        />
      )}

      {/* Unified Payment registration Modal */}
      <PaymentFormModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        students={studentsQuery.data || []}
        studentFees={studentFeesQuery.data || []}
        plans={plansQuery.data || []}
        onSavePayment={handleSaveTuitionPayment}
        onSaveCanteen={handleSaveCanteenPayment}
        saving={savingPayment}
      />
    </div>
  );
}
