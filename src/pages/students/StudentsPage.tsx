import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { PAYMENT_METHODS, formatCurrency } from '../../lib/utils';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import {
  buildPaymentReceiptHtml,
  buildStudentAccountStatementHtml,
  buildStudentCardHtml,
  downloadTextDocument,
  openPrintPreview,
  sanitizeDocumentName,
} from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { recordAuditLog } from '../../lib/audit';
import { createDoubleEntry } from '../../lib/accountingSync';
import { resolveStudentFinance } from '../../lib/financePlanResolver';
import type { Class, Student } from '../../types';
import {
  CreditCard,
  Download,
  Edit,
  Eye,
  FileText,
  GraduationCap,
  Plus,
  Printer,
  Trash2,
  AlertTriangle,
  CopyCheck,
  Utensils,
} from 'lucide-react';
import { useStudents, useStudentFamilyLinks } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useParents } from '../../hooks/useParents';
import { useFinance } from '../../hooks/useFinance';
import StudentFormModal from './components/StudentFormModal';
import StudentDetailModal from './components/StudentDetailModal';
import FamilyModal from './components/FamilyModal';
import AuditDuplicatesModal from './components/AuditDuplicatesModal';
import PaymentFormModal from '../finance/components/PaymentFormModal';

type StudentListItem = Student & { class?: Pick<Class, 'id' | 'name'>; family_count: number };

export default function StudentsPage() {
  const { school, academicYear } = useApp();
  const { isAdmin, isSuperAdmin, isDirector, isSupervisor, profile } = useAuth();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Quick Action Modal states (Guichet Unique)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetStudent, setPaymentTargetStudent] = useState<Student | null>(null);
  const [paymentType, setPaymentType] = useState<'tuition' | 'canteen'>('tuition');
  const [savingPayment, setSavingPayment] = useState(false);

  const canManageStudents = isSuperAdmin || isAdmin || isDirector || isSupervisor;

  // Custom Hooks with TanStack Query
  const {
    studentsQuery,
    saveStudent,
    isSaving,
    archiveStudent,
  } = useStudents(school?.id);

  const { data: classes = [] } = useClasses(school?.id);
  const { data: parents = [] } = useParents(school?.id);

  // Financial system integration
  const {
    plansQuery,
    studentFeesQuery,
    saveDetailedPayment,
    saveCanteenPayment,
  } = useFinance(school?.id, academicYear?.id);

  // Active Cash Register
  const activeRegisterQuery = useQuery({
    queryKey: ['cash_register_active', school?.id],
    queryFn: async () => {
      if (!school?.id) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('school_id', school.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!school?.id,
  });

  async function syncCashRegisterTransaction(paymentId: string, studentName: string, amount: number, isCanteen = false) {
    const register = activeRegisterQuery.data;
    if (!register?.id || !school?.id) return;

    const payload = {
      school_id: school.id,
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

  const {
    familyLinksQuery,
    saveFamilyLinks,
    isSavingLinks,
    removeFamilyLink,
  } = useStudentFamilyLinks(selectedStudent?.id, school?.id);

  const students = (studentsQuery.data || []) as StudentListItem[];
  const familyLinks = familyLinksQuery.data || [];
  const loading = studentsQuery.isLoading;

  const duplicatesAnalysis = useMemo(() => {
    if (!students || students.length === 0) return { byMatricule: [], byName: [], totalCount: 0 };

    const matMap: Record<string, StudentListItem[]> = {};
    const nameMap: Record<string, StudentListItem[]> = {};

    students.forEach(s => {
      const mat = (s.matricule || '').trim();
      const fn = (s.first_name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const ln = (s.last_name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nameKey = `${ln}_${fn}`;

      if (mat && mat !== '-') {
        if (!matMap[mat]) matMap[mat] = [];
        matMap[mat].push(s);
      }

      if (nameKey) {
        if (!nameMap[nameKey]) nameMap[nameKey] = [];
        nameMap[nameKey].push(s);
      }
    });

    const byMatricule = Object.entries(matMap)
      .filter(([_, list]) => list.length > 1)
      .map(([mat, list]) => ({ key: mat, list }));

    const byName = Object.entries(nameMap)
      .filter(([_, list]) => list.length > 1)
      .map(([key, list]) => ({
        key: `${list[0].last_name.toUpperCase()} ${list[0].first_name}`,
        list,
      }));

    return {
      byMatricule,
      byName,
      totalCount: byMatricule.length + byName.length,
    };
  }, [students]);

  function openCreate() {
    setEditMode(false);
    setSelectedStudent(null);
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditMode(true);
    setSelectedStudent(student);
    setModalOpen(true);
  }

  function openDetail(student: Student) {
    setSelectedStudent(student);
    setDetailOpen(true);
  }

  async function handleSaveStudent(form: any) {
    if (!school) return;
    try {
      await saveStudent({
        form,
        studentId: editMode && selectedStudent ? selectedStudent.id : undefined,
        profile,
        studentCount: students.length,
      });
      setModalOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Failed to save student', error);
      throw error;
    }
  }

  async function handleDeleteStudent(id: string) {
    if (!school || !confirm('Archiver cet élève ?')) return;
    try {
      await archiveStudent({ id, profile });
    } catch (error) {
      console.error('Failed to archive student', error);
    }
  }

  async function handleSaveFamilyLinks(updatedLinks: any[], linkForm: any) {
    if (!school || !selectedStudent) return;
    try {
      await saveFamilyLinks({
        familyLinks: updatedLinks,
        linkForm,
        profile,
      });
      setFamilyModalOpen(false);
    } catch (error) {
      console.error('Failed to save family links', error);
    }
  }

  async function handleRemoveFamilyLink(linkId: string) {
    if (!school || !selectedStudent || !confirm('Détacher ce parent de l\'élève ?')) return;
    try {
      await removeFamilyLink({ linkId, profile });
    } catch (error) {
      console.error('Failed to remove family link', error);
    }
  }

  async function handleStudentCardAction(mode: 'print' | 'download') {
    if (!school || !selectedStudent) return;

    const primaryGuardian =
      familyLinks.find(link => link.is_billing_contact)?.parent ||
      familyLinks.find(link => link.is_primary)?.parent ||
      familyLinks[0]?.parent;

    const html = buildStudentCardHtml({
      school,
      student: selectedStudent,
      academicYearName: academicYear?.name,
      className: (selectedStudent as any).class?.name,
      primaryGuardian: primaryGuardian
        ? `${primaryGuardian.first_name} ${primaryGuardian.last_name}`
        : undefined,
      primaryGuardianPhone: primaryGuardian?.phone || (selectedStudent as any).parent_phone || undefined,
    });

    try {
      await saveGeneratedDocument({
        schoolId: school.id,
        entityType: 'student',
        entityId: selectedStudent.id,
        documentType: 'student_card',
        title: `Carte scolaire - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
        baseFileName: `carte-scolaire-${selectedStudent.matricule}`,
        html,
        uploadedBy: profile?.id,
      });
    } catch (error) {
      console.error('Unable to persist student card', error);
    }

    await recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      action: mode === 'print' ? 'student_card_printed' : 'student_card_downloaded',
      entityType: 'student',
      entityId: selectedStudent.id,
      details: { matricule: selectedStudent.matricule },
    });

    if (mode === 'print') {
      openPrintPreview(html);
      return;
    }

    downloadTextDocument(html, `carte-scolaire-${selectedStudent.matricule}.html`);
  }

  const availableParents = useMemo(
    () => parents.filter(parent => !familyLinks.some(link => link.parent_id === parent.id)),
    [parents, familyLinks]
  );

  // Keep selectedStudent synced with latest data from studentsQuery
  const currentSelectedStudent = useMemo(() => {
    if (!selectedStudent) return null;
    return (students.find(s => s.id === selectedStudent.id) || selectedStudent) as StudentListItem;
  }, [students, selectedStudent]);

  // Payment Handlers (Guichet Unique)
  async function handleSaveTuitionPayment(payload: any, details: any[], qrHash: string, digitalSig: string) {
    if (!school?.id) return;
    setSavingPayment(true);
    try {
      const student = (studentsQuery.data || []).find((s: any) => s.id === payload.student_id);
      const studentName = student ? `${student.last_name} ${student.first_name}` : 'Élève';

      const payment = await saveDetailedPayment({
        paymentData: payload,
        details,
        profile,
        qrHash,
        digitalSig,
      });

      if (payload.payment_method === 'cash') {
        await syncCashRegisterTransaction(payment.id, studentName, payload.amount, false);
      }

      // Sync double-entry general accounting
      const debitAcc = payload.payment_method === 'cash' ? '571100' : '521100';
      await createDoubleEntry({
        schoolId: school.id,
        amount: payload.amount,
        description: `Paiement Scolarité - ${studentName}`,
        debitAccountNo: debitAcc,
        creditAccountNo: '706100',
        reference: payment.receipt_number || '',
      });

      setPaymentModalOpen(false);
      void studentsQuery.refetch();

      if (confirm(`Paiement de scolarité (Reçu N° ${payment.receipt_number || ''}) enregistré avec succès !\nVoulez-vous imprimer le reçu officiel ?`)) {
        void handlePrintReceipt({ ...payment, student_id: payload.student_id, student }, false);
      }
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleSaveCanteenPayment(payload: any, qrHash: string, digitalSig: string) {
    if (!school?.id) return;
    setSavingPayment(true);
    try {
      const student = (studentsQuery.data || []).find((s: any) => s.id === payload.student_id);
      const studentName = student ? `${student.last_name} ${student.first_name}` : 'Élève';

      const cp = await saveCanteenPayment({
        canteenData: payload,
        profile,
        qrHash,
        digitalSig,
      });

      if (payload.payment_method === 'cash') {
        await syncCashRegisterTransaction('', studentName, payload.amount, true);
      }

      const debitAcc = payload.payment_method === 'cash' ? '571100' : '521100';
      await createDoubleEntry({
        schoolId: school.id,
        amount: payload.amount,
        description: `Paiement Cantine - ${studentName}`,
        debitAccountNo: debitAcc,
        creditAccountNo: '708200',
        reference: payload.receipt_number || '',
      });

      setPaymentModalOpen(false);
      void studentsQuery.refetch();

      if (confirm(`Paiement Cantine (Reçu N° ${payload.receipt_number || ''}) enregistré avec succès !\nVoulez-vous imprimer le reçu officiel ?`)) {
        void handlePrintReceipt({ ...cp, student_id: payload.student_id, student }, true);
      }
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingPayment(false);
    }
  }

  function handlePrintStatement(student: any) {
    if (!school) {
      alert("Informations de l'établissement introuvables.");
      return;
    }

    const fin = student.finance || resolveStudentFinance({
      student,
      plans: plansQuery.data || [],
      studentFees: studentFeesQuery.data || [],
      tuitionPayments: student.payments || [],
      canteenPayments: student.canteen_payments || [],
      classes,
    });

    const tuitionHistory = (student.payments || []).map((p: any) => ({
      receipt_number: p.receipt_number,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      amount: Number(p.amount),
      is_canteen: false,
      description: 'Scolarité annuelle',
    }));
    const canteenHistory = (student.canteen_payments || []).map((p: any) => ({
      receipt_number: p.receipt_number,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      amount: Number(p.amount),
      is_canteen: true,
      description: `Cantine scolaire - Trimestre ${p.trimester || 1}`,
    }));

    const allPayments = [...tuitionHistory, ...canteenHistory].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
    );

    const html = buildStudentAccountStatementHtml({
      school,
      student: {
        first_name: student.first_name,
        last_name: student.last_name,
        matricule: student.matricule,
      },
      className: student.class?.name,
      academicYearName: academicYear?.name,
      planName: fin.planName,
      totalExpected: fin.totalExpected,
      totalPaid: fin.totalPaid,
      remaining: fin.remaining,
      installments: fin.schedule,
      paymentHistory: allPayments,
    });

    openPrintPreview(html);
  }

  async function handlePrintReceipt(p: any, isCanteen: boolean) {
    if (!school) return;

    const studentId = p.student_id || selectedStudent?.id;
    const student =
      p.student ||
      (studentsQuery.data || []).find((s: any) => s.id === studentId) ||
      selectedStudent || {
        first_name: '',
        last_name: '',
        matricule: '',
      };

    const [receiptRes, detailsRes] = await Promise.all([
      supabase
        .from('receipts')
        .select('qr_code_hash, digital_signature')
        .or(`payment_id.eq.${p.id},canteen_payment_id.eq.${p.id}`)
        .maybeSingle(),
      isCanteen
        ? Promise.resolve({ data: [] })
        : supabase
            .from('payment_details')
            .select('amount, payment_plan_compositions(item_name)')
            .eq('payment_id', p.id),
    ]);

    const receiptMeta = receiptRes.data;
    const compositions = detailsRes.data || [];

    const fin = (student as any).finance || resolveStudentFinance({
      student,
      plans: plansQuery.data || [],
      studentFees: studentFeesQuery.data || [],
      tuitionPayments: (student as any).payments || [],
      canteenPayments: (student as any).canteen_payments || [],
      classes,
    });

    const tuitionHistory = ((student as any).payments || []).map((tp: any) => ({
      receipt_number: tp.receipt_number,
      payment_date: tp.payment_date,
      payment_method: tp.payment_method,
      amount: Number(tp.amount),
      is_canteen: false,
    }));
    const canteenHistory = ((student as any).canteen_payments || []).map((cp: any) => ({
      receipt_number: cp.receipt_number,
      payment_date: cp.payment_date,
      payment_method: cp.payment_method,
      amount: Number(cp.amount),
      is_canteen: true,
    }));

    const paymentMethodLabel =
      PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method;

    const parentRaw = (student as any).parents?.[0]?.parent || (student as any).parents?.[0];
    const parentName = parentRaw ? `${parentRaw.first_name || ''} ${parentRaw.last_name || ''}`.trim() : 'Parent';

    const html = buildPaymentReceiptHtml({
      school,
      payment: { ...p, payment_method: paymentMethodLabel },
      student: {
        first_name: (student as any).first_name || '',
        last_name: (student as any).last_name || '',
        matricule: (student as any).matricule || '',
      },
      academicYearName: academicYear?.name,
      className: (student as any).class?.name || '-',
      parentName,
      feeLabel: isCanteen ? `Cantine scolaire - Trimestre ${p.trimester || 1}` : 'Scolarité annuelle',
      processedByName: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
      compositions: compositions.length > 0 ? compositions.map((c: any) => ({
        item_name: c.payment_plan_compositions?.item_name || 'Frais scolarité',
        amount: Number(c.amount),
      })) : undefined,
      qrCodeHash: receiptMeta?.qr_code_hash,
      digitalSignature: receiptMeta?.digital_signature,
      totalExpected: fin.totalExpected,
      totalPaid: fin.totalPaid,
      remaining: fin.remaining,
      installments: fin.schedule,
      paymentHistory: [...tuitionHistory, ...canteenHistory],
    });

    openPrintPreview(html);
  }

  const columns: Column<StudentListItem>[] = [
    {
      key: 'identity',
      label: 'Élève',
      render: (student: StudentListItem) => (
        <div className="flex items-center gap-3">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={`${student.first_name} ${student.last_name}`}
              className="h-11 w-11 rounded-2xl object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
              {student.first_name[0]}
              {student.last_name[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900">
              {student.first_name} {student.last_name}
            </p>
            <p className="text-xs text-slate-500">{student.matricule}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      label: 'Classe',
      render: (student: StudentListItem) => (
        <span className="font-medium text-slate-800">{student.class?.name || '-'}</span>
      ),
    },
    {
      key: 'expected',
      label: 'Scolarité Annuelle',
      render: (student: any) => (
        <div>
          <span className="font-semibold text-slate-900 text-sm">
            {formatCurrency(student.financial_expected || 0)}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {student.financial_plan_name || 'Tarif annuel'}
          </span>
        </div>
      ),
    },
    {
      key: 'paid',
      label: 'Total Payé',
      render: (student: any) => {
        const paid = Number(student.financial_paid || 0);
        const canteenPaid = Number(student.financial_canteen_paid || 0);

        return (
          <div>
            <span className={`text-sm font-bold ${paid > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
              {paid > 0 ? `+${formatCurrency(paid)}` : '0 FCFA'}
            </span>
            {canteenPaid > 0 && (
              <span className="text-[10px] text-teal-600 block">
                Dont cantine : {formatCurrency(canteenPaid)}
              </span>
            )}
            {paid > 0 && canteenPaid === 0 && (
              <span className="text-[10px] text-emerald-600 block">
                {(student.payments?.length || 0)} versement(s)
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'remaining',
      label: 'Reste à Payer',
      render: (student: any) => {
        const remaining = Number(student.financial_remaining || 0);
        const isSettled = remaining <= 0;
        return (
          <div>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`inline-block w-2 h-2 rounded-full ${isSettled ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={isSettled ? 'text-emerald-700 text-xs font-bold' : 'text-red-700 text-sm font-bold'}>
                {isSettled ? 'Soldé (0 FCFA)' : formatCurrency(remaining)}
              </span>
            </div>
            {!isSettled && (
              <span className="text-[10px] text-red-500 block">Solde dû</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Statut',
      render: (student: StudentListItem) => <Badge status={student.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (student: StudentListItem) => (
        <div className="flex items-center flex-wrap gap-1">
          <button
            onClick={() => {
              setPaymentTargetStudent(student);
              setPaymentType('tuition');
              setPaymentModalOpen(true);
            }}
            title="Encaisser un versement pour cet élève"
            className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-200 flex items-center gap-1"
          >
            <CreditCard size={13} />
            <span>Encaisser</span>
          </button>
          <button
            onClick={() => handlePrintStatement(student)}
            title="Imprimer le relevé officiel de l'élève"
            className="rounded-xl p-1.5 text-slate-700 hover:bg-slate-100 transition border border-slate-200"
          >
            <FileText size={15} />
          </button>
          <button
            onClick={() => openDetail(student)}
            title="Voir le dossier 360°"
            className="rounded-xl p-1.5 text-blue-600 transition hover:bg-blue-50"
          >
            <Eye size={16} />
          </button>
          {canManageStudents && (
            <button
              onClick={() => openEdit(student)}
              title="Modifier"
              className="rounded-xl p-1.5 text-amber-600 transition hover:bg-amber-50"
            >
              <Edit size={16} />
            </button>
          )}
          {canManageStudents && (
            <button
              onClick={() => void handleDeleteStudent(student.id)}
              title="Archiver"
              className="rounded-xl p-1.5 text-red-600 transition hover:bg-red-50"
            >
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
            <h1 className="display-font text-3xl font-semibold text-slate-900">
              Dossiers élèves & identités
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Chaque élève dispose maintenant d'un dossier plus riche avec photo, famille rattachée,
              carte scolaire imprimable et informations prêtes pour les documents officiels.
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Vision dossier complet</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                <p className="text-xs text-slate-500">Élèves suivis</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {students.filter(student => Boolean(student.photo_url)).length}
                </p>
                <p className="text-xs text-slate-500">Photos chargées</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {students.reduce((sum, student) => sum + student.family_count, 0)}
                </p>
                <p className="text-xs text-slate-500">Liens famille</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Population scolaire</h2>
          <p className="mt-1 text-sm text-slate-500">{students.length} élève(s) inscrit(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuditModalOpen(true)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition border shadow-2xs ${
              duplicatesAnalysis.totalCount > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CopyCheck size={16} className={duplicatesAnalysis.totalCount > 0 ? 'text-amber-600' : 'text-slate-500'} />
            Audit Doublons
            {duplicatesAnalysis.totalCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white animate-pulse">
                {duplicatesAnalysis.totalCount}
              </span>
            )}
          </button>
          {canManageStudents && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 shadow-2xs"
            >
              <Plus size={16} /> Nouvel élève
            </button>
          )}
        </div>
      </div>

      {students.length === 0 && !loading ? (
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Aucun élève"
          description="Commence par inscrire les élèves, ajouter leur photo et relier leur famille pour obtenir des dossiers complets."
          action={
            canManageStudents ? (
              <button
                onClick={openCreate}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Inscrire un élève
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchPlaceholder="Rechercher un élève..."
          searchKeys={['matricule', 'first_name', 'last_name']}
          loading={loading}
        />
      )}

      {/* Componentized Modals */}
      {school && (
        <StudentFormModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          schoolId={school.id}
          classes={classes}
          onSave={handleSaveStudent}
          saving={isSaving}
        />
      )}

      {currentSelectedStudent && (
        <StudentDetailModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelectedStudent(null);
          }}
          student={currentSelectedStudent}
          familyLinks={familyLinks}
          loading={familyLinksQuery.isLoading}
          canManageStudents={canManageStudents}
          onManageFamilyClick={() => {
            setDetailOpen(false);
            setFamilyModalOpen(true);
          }}
          onStudentCardAction={handleStudentCardAction}
          onMakePayment={(studentToPay, type) => {
            setPaymentTargetStudent(studentToPay);
            setPaymentType(type);
            setPaymentModalOpen(true);
          }}
          onPrintStatement={handlePrintStatement}
          onPrintReceipt={handlePrintReceipt}
          academicYear={academicYear}
          school={school}
        />
      )}

      {/* Guichet Unique Payment Modal */}
      {school && (
        <PaymentFormModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentTargetStudent(null);
          }}
          students={students}
          studentFees={studentFeesQuery.data || []}
          plans={plansQuery.data || []}
          payments={[]}
          canteenPayments={[]}
          classes={classes}
          initialStudentId={paymentTargetStudent?.id}
          initialPaymentType={paymentType}
          onSavePayment={handleSaveTuitionPayment}
          onSaveCanteen={handleSaveCanteenPayment}
          saving={savingPayment}
        />
      )}

      {selectedStudent && (
        <FamilyModal
          isOpen={familyModalOpen}
          onClose={() => {
            setFamilyModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          familyLinks={familyLinks}
          availableParents={availableParents}
          onSaveLinks={handleSaveFamilyLinks}
          onRemoveLink={handleRemoveFamilyLink}
          saving={isSavingLinks}
        />
      )}

      <AuditDuplicatesModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        byMatricule={duplicatesAnalysis.byMatricule}
        byName={duplicatesAnalysis.byName}
        onDeleteStudent={async (id) => {
          await archiveStudent({ id, profile });
        }}
        onSelectStudent={(s) => {
          setAuditModalOpen(false);
          openDetail(s);
        }}
      />
    </div>
  );
}
