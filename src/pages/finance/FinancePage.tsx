import { useState, useEffect } from 'react';
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
import { createDoubleEntry } from '../../lib/accountingSync';

import FinanceDashboard from './components/FinanceDashboard';
import StudentDebts from './components/StudentDebts';
import CanteenModule from './components/CanteenModule';
import FinanceAdminConfig from './components/FinanceAdminConfig';
import FinanceReports from './components/FinanceReports';
import PaymentFormModal from './components/PaymentFormModal';
import Modal from '../../components/common/Modal';
import { resolveStudentFinance } from '../../lib/financePlanResolver';

import {
  CreditCard,
  DollarSign,
  Edit,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  Plus,
  Printer,
  Settings,
  Trash2,
  Utensils,
} from 'lucide-react';

export default function FinancePage() {
  const { school, academicYear, academicYears } = useApp();
  const { profile, isSuperAdmin, isAdmin, isDirector, isCashier, isAccountant } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'payments' | 'debts' | 'canteen' | 'reports' | 'admin'>('dashboard');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Admin correction modal state
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('cash');
  const [editPaymentDate, setEditPaymentDate] = useState<string>('');
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>('');
  const [savingEditPayment, setSavingEditPayment] = useState<boolean>(false);

  const isGeneralAdmin = isSuperAdmin || isAdmin;

  const schoolId = school?.id;
  const yearId = academicYear?.id;

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && schoolId) {
      const syncOffline = async () => {
        const offlinePayments = JSON.parse(localStorage.getItem('offline_payments') || '[]');
        if (offlinePayments.length === 0) return;

        for (const item of offlinePayments) {
          try {
            await handleSaveTuitionPayment(item.payload, item.details, item.qrHash, item.digitalSig);
          } catch (e) {
            console.error("Failed to sync offline payment", e);
          }
        }
        localStorage.removeItem('offline_payments');
        alert("🟢 Connexion rétablie : Tous les paiements enregistrés hors-ligne ont été synchronisés avec succès !");
      };
      void syncOffline();
    }
  }, [isOnline, schoolId]);

  const canManage = isAdmin || isDirector || isCashier || isAccountant;
  const canConfig = isAdmin || isDirector;

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
    if (!isOnline) {
      const offlinePayments = JSON.parse(localStorage.getItem('offline_payments') || '[]');
      offlinePayments.push({ payload, details, qrHash, digitalSig });
      localStorage.setItem('offline_payments', JSON.stringify(offlinePayments));
      alert("⚠️ Mode Hors-ligne : Paiement enregistré localement dans le navigateur. Il sera synchronisé dès le retour de la connexion.");
      setPaymentModalOpen(false);
      return;
    }
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

      // 3. Sync to general accounting journal
      const debitAcc = payload.payment_method === 'cash' ? '571100' : '521100';
      await createDoubleEntry({
        schoolId: schoolId!,
        amount: payload.amount,
        description: `Paiement Scolarité - ${studentName}`,
        debitAccountNo: debitAcc,
        creditAccountNo: '706100',
        reference: payment.receipt_number || '',
      });

      setPaymentModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['payments_all', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, yearId] });

      // 4. Send WhatsApp Notification (Simulated or Live via Green-API)
      const waProv = localStorage.getItem('wa_provider') || 'simulation';
      const waMsgTemplate = localStorage.getItem('receipt_text') || 'Bonjour, nous vous confirmons le règlement de scolarité de {student_name} d\'un montant de {amount} FCFA. Solde restant : {remaining} FCFA. Merci.';
      
      const studentInsts = (studentInstallmentsQuery?.data || []).filter((si: any) => si.student_id === payload.student_id);
      const totalFees = studentInsts.reduce((sum: number, si: any) => sum + Number(si.amount), 0);
      const totalPaid = studentInsts.reduce((sum: number, si: any) => sum + Number(si.paid_amount), 0) + Number(payload.amount);
      const remaining = Math.max(0, totalFees - totalPaid);

      const msg = waMsgTemplate
        .replace('{student_name}', studentName)
        .replace('{amount}', payload.amount.toString())
        .replace('{remaining}', remaining.toString());

      const parentItem = student?.parents?.[0]?.parent;
      const parentObj = Array.isArray(parentItem) ? parentItem[0] : parentItem;
      const parentPhone = parentObj?.phone;

      if (waProv === 'simulation') {
        alert(`[SIMULATION WHATSAPP PARENT]\n\nDestinataire : ${parentPhone || 'N/A'}\nMessage : ${msg}`);
      } else if (waProv === 'green-api') {
        const instanceId = localStorage.getItem('wa_instance');
        const token = localStorage.getItem('wa_token');
        if (instanceId && token && parentPhone) {
          try {
            await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: `${parentPhone.replace(/\s+/g, '')}@c.us`,
                message: msg
              })
            });
          } catch (err) {
            console.error("Failed to send live WhatsApp via Green-API", err);
          }
        }
      }
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

      const createdCanteenPayment = await saveCanteenPayment({
        canteenData: payload,
        profile,
        qrHash,
        digitalSig,
      });

      if (payload.payment_method === 'cash') {
        await syncCashRegisterTransaction('', studentName, payload.amount, true);
      }

      // 3. Sync to general accounting journal
      const debitAcc = payload.payment_method === 'cash' ? '571100' : '521100';
      await createDoubleEntry({
        schoolId: schoolId!,
        amount: payload.amount,
        description: `Paiement Cantine - ${studentName}`,
        debitAccountNo: debitAcc,
        creditAccountNo: '708200',
        reference: payload.receipt_number || '',
      });

      setPaymentModalOpen(false);

      if (confirm(`Paiement de Cantine (REC-${payload.receipt_number || ''}) enregistré avec succès !\nVoulez-vous imprimer le reçu immédiatement ?`)) {
        void handlePrintReceipt({ ...createdCanteenPayment, student, parent: student?.parents?.[0]?.parent }, true);
      }
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingPayment(false);
    }
  }

  // Fetch receipt metadata and trigger print preview
  async function handlePrintReceipt(p: any, isCanteen = false) {
    if (!school) return;

    // Fetch details & metadata, plus student financial balance
    const [receiptRes, detailsRes, feeLinkRes, installmentsRes, tuitionPaymentsRes, canteenPaymentsRes] = await Promise.all([
      supabase
        .from('receipts')
        .select('*')
        .eq(isCanteen ? 'canteen_payment_id' : 'payment_id', p.id)
        .maybeSingle(),
      isCanteen
        ? Promise.resolve({ data: [] as any[] })
        : supabase.from('payment_details').select('*').eq('payment_id', p.id),
      supabase
        .from('student_fees')
        .select('*, plan:payment_plans(*)')
        .eq('student_id', p.student_id)
        .maybeSingle(),
      supabase
        .from('student_installments')
        .select('*')
        .eq('student_id', p.student_id)
        .order('installment_number'),
      supabase
        .from('payments')
        .select('receipt_number, payment_date, payment_method, amount')
        .eq('student_id', p.student_id)
        .eq('status', 'paid'),
      supabase
        .from('canteen_payments')
        .select('receipt_number, payment_date, payment_method, amount')
        .eq('student_id', p.student_id),
    ]);

    const receiptMeta = receiptRes.data;
    const compositions = detailsRes.data || [];
    
    // Resolve full finance accurately (supports class/level fallback even without student_fees row)
    const studentObj =
      p.student ||
      (studentsQuery.data || []).find((s: any) => s.id === p.student_id) || { id: p.student_id };

    const resolvedFinance = resolveStudentFinance({
      student: studentObj,
      plans: plansQuery.data || [],
      studentFees: feeLinkRes.data ? [feeLinkRes.data] : (studentFeesQuery.data || []),
      studentInstallments: installmentsRes.data || [],
      tuitionPayments: tuitionPaymentsRes.data || [],
      canteenPayments: canteenPaymentsRes.data || [],
      classes: classesQuery.data || [],
    });

    // Compile historical payments list
    const tuitionHistory = (tuitionPaymentsRes.data || []).map(tp => ({
      receipt_number: tp.receipt_number,
      payment_date: tp.payment_date,
      payment_method: tp.payment_method,
      amount: Number(tp.amount),
      is_canteen: false,
    }));
    const canteenHistory = (canteenPaymentsRes.data || []).map(cp => ({
      receipt_number: cp.receipt_number,
      payment_date: cp.payment_date,
      payment_method: cp.payment_method,
      amount: Number(cp.amount),
      is_canteen: true,
    }));
    const paymentHistory = [...tuitionHistory, ...canteenHistory];

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
      totalExpected: resolvedFinance.totalExpected,
      totalPaid: resolvedFinance.totalPaid,
      remaining: resolvedFinance.remaining,
      installments: resolvedFinance.schedule,
      paymentHistory: paymentHistory.length > 0 ? paymentHistory : undefined,
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

  // Admin: Open Edit Payment Modal
  function handleOpenEditPayment(paymentRow: any) {
    setEditingPayment(paymentRow);
    setEditPaymentAmount(Number(paymentRow.amount) || 0);
    setEditPaymentMethod(paymentRow.payment_method || 'cash');
    setEditPaymentDate(paymentRow.payment_date || new Date().toISOString().split('T')[0]);
    setEditPaymentNotes(paymentRow.notes || '');
    setEditPaymentModalOpen(true);
  }

  // Admin: Save Edited Payment
  async function handleSaveEditedPayment() {
    if (!editingPayment) return;
    if (editPaymentAmount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    setSavingEditPayment(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          amount: editPaymentAmount,
          payment_method: editPaymentMethod,
          payment_date: editPaymentDate,
          notes: editPaymentNotes.trim() || null,
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      alert('✅ Versement rectifié avec succès !');
      setEditPaymentModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['payments_all', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, yearId] });
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setSavingEditPayment(false);
    }
  }

  // Admin: Delete Payment
  async function handleDeletePayment(paymentRow: any) {
    if (!isGeneralAdmin) {
      alert("Seul l'administrateur général a le droit de supprimer une transaction financière.");
      return;
    }

    const confirmMsg = `⚠️ ATTENTION ACTION IRRÉVERSIBLE (ADMIN) :\n\nVoulez-vous vraiment supprimer le versement N° ${paymentRow.receipt_number} d'un montant de ${formatCurrency(paymentRow.amount)} pour l'élève ${paymentRow.student?.first_name || ''} ${paymentRow.student?.last_name || ''} ?\n\nCette action recalculera automatiquement les soldes et tranches de l'élève.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      // 1. Delete associated receipt metadata
      await supabase.from('receipts').delete().eq('payment_id', paymentRow.id);
      // 2. Delete payment details
      await supabase.from('payment_details').delete().eq('payment_id', paymentRow.id);
      // 3. Delete cash transaction if exists
      await supabase.from('cash_transactions').delete().eq('payment_id', paymentRow.id);
      // 4. Delete payment row
      const { error } = await supabase.from('payments').delete().eq('id', paymentRow.id);

      if (error) throw error;

      alert('🗑️ Versement supprimé avec succès. Les soldes ont été mis à jour.');
      void queryClient.invalidateQueries({ queryKey: ['payments_all', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', schoolId, yearId] });
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
    } catch (err: any) {
      alert(`Erreur lors de la suppression : ${err.message}`);
    }
  }

  // Admin: Delete Canteen Payment
  async function handleDeleteCanteenPayment(canteenRow: any) {
    if (!isGeneralAdmin) {
      alert("Seul l'administrateur général a le droit de supprimer une transaction financière.");
      return;
    }

    const confirmMsg = `⚠️ ATTENTION ACTION IRRÉVERSIBLE (ADMIN) :\n\nVoulez-vous vraiment supprimer le paiement de cantine N° ${canteenRow.receipt_number} d'un montant de ${formatCurrency(canteenRow.amount)} pour l'élève ${canteenRow.student?.first_name || ''} ${canteenRow.student?.last_name || ''} ?`;

    if (!confirm(confirmMsg)) return;

    try {
      // 1. Delete associated receipt metadata
      await supabase.from('receipts').delete().eq('canteen_payment_id', canteenRow.id);
      // 2. Delete canteen payment row
      const { error } = await supabase.from('canteen_payments').delete().eq('id', canteenRow.id);

      if (error) throw error;

      alert('🗑️ Paiement de cantine supprimé avec succès.');
      void queryClient.invalidateQueries({ queryKey: ['canteen_payments', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
    } catch (err: any) {
      alert(`Erreur lors de la suppression : ${err.message}`);
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
      key: 'class',
      label: 'Classe',
      render: row => row.student?.class?.name || '-',
    },
    {
      key: 'total_expected',
      label: 'Scolarité Annuelle',
      render: row => {
        const fin = resolveStudentFinance({
          student: row.student,
          plans: plansQuery.data || [],
          studentFees: studentFeesQuery.data || [],
          tuitionPayments: paymentsQuery.data || [],
          canteenPayments: canteenPaymentsQuery.data || [],
          classes: classesQuery.data || [],
        });
        return <span className="font-semibold text-slate-800">{formatCurrency(fin.totalExpectedTuition)}</span>;
      },
    },
    {
      key: 'amount',
      label: 'Ce Versement',
      render: row => <span className="font-bold text-emerald-700">{formatCurrency(Number(row.amount))}</span>,
    },
    {
      key: 'paid',
      label: 'Total Déjà Versé',
      render: row => {
        const fin = resolveStudentFinance({
          student: row.student,
          plans: plansQuery.data || [],
          studentFees: studentFeesQuery.data || [],
          tuitionPayments: paymentsQuery.data || [],
          canteenPayments: canteenPaymentsQuery.data || [],
          classes: classesQuery.data || [],
        });
        return <span className="font-medium text-slate-700">{formatCurrency(fin.paidTuition)}</span>;
      },
    },
    {
      key: 'remaining',
      label: 'Reste à payer',
      render: row => {
        const fin = resolveStudentFinance({
          student: row.student,
          plans: plansQuery.data || [],
          studentFees: studentFeesQuery.data || [],
          tuitionPayments: paymentsQuery.data || [],
          canteenPayments: canteenPaymentsQuery.data || [],
          classes: classesQuery.data || [],
        });
        if (fin.remaining === 0) {
          return (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Soldé (0 FCFA)
            </span>
          );
        }
        return <span className="font-bold text-rose-600">{formatCurrency(fin.remaining)}</span>;
      },
    },
    {
      key: 'payment_method',
      label: 'Mode',
      render: row => PAYMENT_METHODS.find(m => m.value === row.payment_method)?.label || row.payment_method,
    },
    { key: 'payment_date', label: 'Date', render: row => formatDate(row.payment_date) },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => void handlePrintReceipt(row, false)}
            title="Imprimer le reçu"
            className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 transition"
          >
            <Printer size={15} />
          </button>
          {isGeneralAdmin && (
            <>
              <button
                onClick={() => handleOpenEditPayment(row)}
                title="Modifier ce paiement (Admin)"
                className="rounded-xl p-2 text-blue-600 hover:bg-blue-50 transition"
              >
                <Edit size={15} />
              </button>
              <button
                onClick={() => void handleDeletePayment(row)}
                title="Supprimer ce paiement erroné (Admin)"
                className="rounded-xl p-2 text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Top bar */}
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="display-font text-3xl font-semibold text-slate-900">Module Financier</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
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
          plans={plansQuery.data || []}
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
          school={school}
          academicYearName={academicYears.find(y => y.id === yearId)?.name || '2026-2027'}
          students={studentsQuery.data || []}
          payments={paymentsQuery.data || []}
          canteenPayments={canteenPaymentsQuery.data || []}
          studentFees={studentFeesQuery.data || []}
          studentInstallments={studentInstallmentsQuery.data || []}
          classes={classesQuery.data || []}
          plans={plansQuery.data || []}
        />
      )}

      {tab === 'canteen' && (
        <CanteenModule
          canteenPayments={canteenPaymentsQuery.data || []}
          onPrintReceipt={p => void handlePrintReceipt(p, true)}
          isGeneralAdmin={isGeneralAdmin}
          onDeletePayment={handleDeleteCanteenPayment}
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
          plans={plansQuery.data || []}
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
        payments={paymentsQuery.data || []}
        canteenPayments={canteenPaymentsQuery.data || []}
        studentInstallments={studentInstallmentsQuery.data || []}
        classes={classesQuery.data || []}
        onSavePayment={handleSaveTuitionPayment}
        onSaveCanteen={handleSaveCanteenPayment}
        saving={savingPayment}
      />

      {/* Admin: Edit Payment Modal */}
      <Modal
        isOpen={editPaymentModalOpen}
        onClose={() => setEditPaymentModalOpen(false)}
        title="Rectifier un versement (Admin Général)"
        size="md"
        actions={
          <>
            <button
              type="button"
              onClick={() => setEditPaymentModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              disabled={savingEditPayment}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveEditedPayment}
              disabled={savingEditPayment}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {savingEditPayment ? 'Enregistrement...' : 'Enregistrer la rectification'}
            </button>
          </>
        }
      >
        {editingPayment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
              <p className="font-semibold">⚠️ Modification autorisée - Administrateur Général</p>
              <p className="mt-1">
                Reçu : <strong className="font-mono">{editingPayment.receipt_number}</strong> | Élève :{' '}
                <strong>
                  {editingPayment.student?.last_name} {editingPayment.student?.first_name}
                </strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Montant payé (FCFA) *
              </label>
              <input
                type="number"
                min="1"
                value={editPaymentAmount}
                onChange={e => setEditPaymentAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mode de règlement *
              </label>
              <select
                value={editPaymentMethod}
                onChange={e => setEditPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date du versement *
              </label>
              <input
                type="date"
                value={editPaymentDate}
                onChange={e => setEditPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif / Justification de la correction
              </label>
              <textarea
                rows={2}
                value={editPaymentNotes}
                onChange={e => setEditPaymentNotes(e.target.value)}
                placeholder="Ex: Erreur de saisie du caissier, ajustement du mode de paiement..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
