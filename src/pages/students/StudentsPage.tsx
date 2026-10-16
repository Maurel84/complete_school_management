import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { PAYMENT_METHODS, formatCurrency } from '../../lib/utils';
import { resolveTeacherClass, resolveParentChildren } from '../../lib/roleDataResolver';
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
  ShieldCheck,
  Trash2,
  AlertTriangle,
  CopyCheck,
  Utensils,
  RotateCcw,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useStudents, useStudentFamilyLinks } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useParents } from '../../hooks/useParents';
import { useFinance } from '../../hooks/useFinance';
import StudentFormModal from './components/StudentFormModal';
import StudentDetailModal from './components/StudentDetailModal';
import FamilyModal from './components/FamilyModal';
import AuditDuplicatesModal from './components/AuditDuplicatesModal';
import AuditLogsViewerModal from './components/AuditLogsViewerModal';
import PaymentFormModal from '../finance/components/PaymentFormModal';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

type StudentListItem = Student & { class?: Pick<Class, 'id' | 'name'>; family_count: number };

export default function StudentsPage() {
  const { school, academicYear } = useApp();
  const {
    isAdmin,
    isSuperAdmin,
    isDirector,
    isSupervisor,
    isCashier,
    isAccountant,
    isTeacher,
    isParent,
    profile,
    role,
  } = useAuth();

  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const isParentUser = isParent || role === 'parent' || (profile?.role as any)?.name === 'parent' || profile?.account_type === 'parent';

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Quick Action Modal states (Guichet Unique)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetStudent, setPaymentTargetStudent] = useState<Student | null>(null);
  const [paymentType, setPaymentType] = useState<'tuition' | 'canteen'>('tuition');
  const [savingPayment, setSavingPayment] = useState(false);

  // Admin correction modal state
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editingIsCanteen, setEditingIsCanteen] = useState<boolean>(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('cash');
  const [editPaymentDate, setEditPaymentDate] = useState<string>('');
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>('');
  const [savingEditPayment, setSavingEditPayment] = useState<boolean>(false);

  // Status & Class filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [classFilter, setClassFilter] = useState<string>('');
  const [reactivatingStudentId, setReactivatingStudentId] = useState<string | null>(null);

  // Role Scoped State
  const [parentChildIds, setParentChildIds] = useState<string[]>([]);
  const [assignedTeacherClass, setAssignedTeacherClass] = useState<Class | null>(null);
  const [teacherRoleLabel, setTeacherRoleLabel] = useState<string>('Enseignant');

  const isGeneralAdmin = isSuperAdmin || isAdmin;
  // All school staff members have access to student actions (create, edit, payments, print)
  const isStaff =
    isSuperAdmin ||
    isAdmin ||
    isDirector ||
    isSupervisor ||
    isCashier ||
    isAccountant ||
    isTeacher ||
    profile?.account_type === 'staff';
  const canManageStudents = isStaff && !isTeacherUser && !isParentUser;

  const actorRole = (Array.isArray(profile?.role) ? profile?.role[0]?.name : (profile?.role as any)?.name) || 'staff';
  const actorName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || 'Utilisateur';

  // Custom Hooks with TanStack Query
  const {
    studentsQuery,
    saveStudent,
    isSaving,
    archiveStudent,
    reactivateStudent,
  } = useStudents(school?.id);

  const { data: classes = [] } = useClasses(school?.id);
  const { data: parents = [] } = useParents(school?.id);

  // Auto-detect teacher assigned class (e.g. CP1 for stagiaire) or parent linked children
  useEffect(() => {
    async function loadRoleScope() {
      if (!school?.id || !profile) return;
      if (isTeacherUser) {
        const { assignedClass, roleLabel } = await resolveTeacherClass(school.id, profile, classes);
        if (assignedClass) {
          setAssignedTeacherClass(assignedClass);
          setClassFilter(assignedClass.id);
        }
        if (roleLabel) setTeacherRoleLabel(roleLabel);
      } else if (isParentUser) {
        const { childrenIds } = await resolveParentChildren(school.id, profile);
        setParentChildIds(childrenIds);
      }
    }
    void loadRoleScope();
  }, [isTeacherUser, isParentUser, school?.id, profile, classes]);

  const queryClient = useQueryClient();

  // Financial system integration
  const {
    plansQuery,
    studentFeesQuery,
    studentInstallmentsQuery,
    canteenPaymentsQuery,
    saveDetailedPayment,
    saveCanteenPayment,
  } = useFinance(school?.id, academicYear?.id);

  // Query: tuition payments list for the school (synced live)
  const paymentsQuery = useQuery({
    queryKey: ['payments_all', school?.id],
    queryFn: async () => {
      if (!school?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          student:students(id, first_name, last_name, matricule, class:classes(name, level_id)),
          parent:parents(id, first_name, last_name, phone, email),
          processor:profiles(first_name, last_name)
        `)
        .eq('school_id', school.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!school?.id,
  });

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

  const totalCount = students.length;
  const activeCount = useMemo(() => students.filter(s => s.status === 'active').length, [students]);
  const inactiveCount = useMemo(() => students.filter(s => s.status !== 'active').length, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      if (isParentUser) {
        if (parentChildIds.length > 0 && !parentChildIds.includes(student.id)) {
          return false;
        }
      }
      if (statusFilter === 'active' && student.status !== 'active') return false;
      if (statusFilter === 'inactive' && student.status === 'active') return false;
      if (classFilter && student.class_id !== classFilter) return false;
      return true;
    });
  }, [students, statusFilter, classFilter, isParentUser, parentChildIds]);

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

  async function handleReactivateStudent(id: string) {
    if (!school || !confirm('Réactiver cet élève et le réintégrer dans les effectifs actifs ?')) return;
    try {
      setReactivatingStudentId(id);
      await reactivateStudent({ id, profile });
    } catch (error: any) {
      console.error('Failed to reactivate student', error);
      alert(`Erreur lors de la réactivation : ${error?.message || 'Erreur inconnue'}`);
    } finally {
      setReactivatingStudentId(null);
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
      userName: actorName,
      userEmail: profile?.email,
      userRole: actorRole,
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

      // Record audit log
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        userName: actorName,
        userEmail: profile?.email,
        userRole: actorRole,
        action: 'payment_tuition_created',
        entityType: 'payment',
        entityId: payment.id,
        details: {
          receipt_number: payment.receipt_number,
          amount: payload.amount,
          student_id: payload.student_id,
          student_name: studentName,
          payment_method: payload.payment_method,
        },
      });

      setPaymentModalOpen(false);
      void studentsQuery.refetch();
      void paymentsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['payments_all', school.id] });
      void queryClient.invalidateQueries({ queryKey: ['student_fees', school.id, academicYear?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student_installments_all', school.id, academicYear?.id] });

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

      // Record audit log
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        userName: actorName,
        userEmail: profile?.email,
        userRole: actorRole,
        action: 'payment_canteen_created',
        entityType: 'canteen_payment',
        entityId: cp.id,
        details: {
          receipt_number: cp.receipt_number,
          amount: payload.amount,
          trimester: payload.trimester,
          student_id: payload.student_id,
          student_name: studentName,
          payment_method: payload.payment_method,
        },
      });

      setPaymentModalOpen(false);
      void studentsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['canteen_payments', school.id, academicYear?.id] });
      void queryClient.invalidateQueries({ queryKey: ['payments_all', school.id] });

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

    void recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      userName: actorName,
      userEmail: profile?.email,
      userRole: actorRole,
      action: 'statement_printed',
      entityType: 'student',
      entityId: student.id,
      details: {
        student_name: `${student.first_name} ${student.last_name}`,
        matricule: student.matricule,
        total_paid: fin.totalPaid,
        remaining: fin.remaining,
      },
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

    void recordAuditLog({
      schoolId: school.id,
      userId: profile?.id,
      userName: actorName,
      userEmail: profile?.email,
      userRole: actorRole,
      action: 'receipt_printed',
      entityType: isCanteen ? 'canteen_payment' : 'payment',
      entityId: p.id,
      details: {
        receipt_number: p.receipt_number,
        amount: p.amount,
        student_name: `${(student as any).first_name || ''} ${(student as any).last_name || ''}`.trim(),
        is_canteen: isCanteen,
      },
    });

    openPrintPreview(html);
  }

  // Admin Payment Correction Handlers
  function openEditPayment(payment: any, isCanteen: boolean) {
    setEditingPayment(payment);
    setEditingIsCanteen(isCanteen);
    setEditPaymentAmount(Number(payment.amount) || 0);
    setEditPaymentMethod(payment.payment_method || 'cash');
    setEditPaymentDate(payment.payment_date || new Date().toISOString().split('T')[0]);
    setEditPaymentNotes(payment.notes || '');
    setEditPaymentModalOpen(true);
  }

  async function handleSaveEditedPayment() {
    if (!editingPayment || !school?.id) return;
    if (editPaymentAmount <= 0) {
      alert('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    setSavingEditPayment(true);
    try {
      const table = editingIsCanteen ? 'canteen_payments' : 'payments';
      const { error } = await supabase
        .from(table)
        .update({
          amount: editPaymentAmount,
          payment_method: editPaymentMethod,
          payment_date: editPaymentDate,
          notes: editPaymentNotes.trim() || null,
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      // Log the update action
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        userName: actorName,
        userEmail: profile?.email,
        userRole: actorRole,
        action: 'payment_updated',
        entityType: editingIsCanteen ? 'canteen_payment' : 'payment',
        entityId: editingPayment.id,
        details: {
          receipt_number: editingPayment.receipt_number,
          old_amount: editingPayment.amount,
          new_amount: editPaymentAmount,
          old_method: editingPayment.payment_method,
          new_method: editPaymentMethod,
          old_date: editingPayment.payment_date,
          new_date: editPaymentDate,
          notes: editPaymentNotes,
          is_canteen: editingIsCanteen,
        },
      });

      alert('✅ Versement rectifié avec succès ! Le total et les restes de l\'élève sont mis à jour.');
      setEditPaymentModalOpen(false);
      setEditingPayment(null);
      void studentsQuery.refetch();
    } catch (err: any) {
      alert(`Erreur lors de la modification : ${err.message}`);
    } finally {
      setSavingEditPayment(false);
    }
  }

  async function handleDeletePayment(payment: any, isCanteen: boolean) {
    if (!canManageStudents || !school?.id) {
      alert("Vous n'avez pas l'autorisation d'annuler une ligne de versement.");
      return;
    }

    const typeLabel = isCanteen ? 'de cantine' : 'de scolarité';
    const confirmMsg = `⚠️ ATTENTION ACTION IRRÉVERSIBLE :\n\nVoulez-vous vraiment supprimer le versement ${typeLabel} N° ${payment.receipt_number} d'un montant de ${formatCurrency(payment.amount)} ?\n\nCette action va annuler l'encaissement et recalculer immédiatement le solde et les restes à payer de l'élève.`;

    if (!confirm(confirmMsg)) return;

    try {
      if (isCanteen) {
        await supabase.from('receipts').delete().eq('canteen_payment_id', payment.id);
        const { error } = await supabase.from('canteen_payments').delete().eq('id', payment.id);
        if (error) throw error;
      } else {
        await supabase.from('receipts').delete().eq('payment_id', payment.id);
        await supabase.from('payment_details').delete().eq('payment_id', payment.id);
        await supabase.from('cash_transactions').delete().eq('payment_id', payment.id);
        const { error } = await supabase.from('payments').delete().eq('id', payment.id);
        if (error) throw error;
      }

      // Record deletion in audit logs
      await recordAuditLog({
        schoolId: school.id,
        userId: profile?.id,
        userName: actorName,
        userEmail: profile?.email,
        userRole: actorRole,
        action: 'payment_deleted',
        entityType: isCanteen ? 'canteen_payment' : 'payment',
        entityId: payment.id,
        details: {
          receipt_number: payment.receipt_number,
          deleted_amount: payment.amount,
          payment_method: payment.payment_method,
          payment_date: payment.payment_date,
          notes: payment.notes,
          is_canteen: isCanteen,
        },
      });

      alert('🗑️ Versement supprimé avec succès. Les soldes et totaux ont été recalculés.');
      void studentsQuery.refetch();
    } catch (err: any) {
      alert(`Erreur lors de la suppression : ${err.message}`);
    }
  }

  const columns: Column<StudentListItem>[] = useMemo(() => {
    const cols: Column<StudentListItem>[] = [
      {
        key: 'identity',
        label: isParentUser ? 'Mon Enfant' : 'Élève',
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
          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg text-xs">
            {student.class?.name || '-'}
          </span>
        ),
      },
    ];

    // ZERO financial columns for teachers! Only admins, accountants, cashiers, and parents (for their own children)
    if (!isTeacherUser) {
      cols.push(
        {
          key: 'expected',
          label: isParentUser ? 'Frais Scolaires' : 'Scolarité Annuelle',
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
        }
      );
    }

    cols.push({
      key: 'status',
      label: 'Statut',
      render: (student: StudentListItem) => <Badge status={student.status} />,
    });

    cols.push({
      key: 'actions',
      label: 'Actions',
      render: (student: StudentListItem) => (
        <div className="flex items-center flex-wrap gap-1">
          {/* Payment collection button: strictly administrative staff, NOT teachers, NOT parents */}
          {!isTeacherUser && !isParentUser && canManageStudents && (
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
          )}

          {/* Statement print: Available to Admin, Staff, and Parent (not teacher) */}
          {!isTeacherUser && (
            <button
              onClick={() => handlePrintStatement(student)}
              title={isParentUser ? "Imprimer le relevé financier de mon enfant" : "Imprimer le relevé officiel de l'élève"}
              className="rounded-xl p-1.5 text-slate-700 hover:bg-slate-100 transition border border-slate-200"
            >
              <FileText size={15} />
            </button>
          )}

          {/* National Student Card button: available to all */}
          <button
            onClick={() => {
              setSelectedStudent(student);
              void handleStudentCardAction('print');
            }}
            title="Imprimer la carte scolaire officielle"
            className="rounded-xl p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-200"
          >
            <Printer size={15} />
          </button>

          {/* 360 View: available to everyone */}
          <button
            onClick={() => openDetail(student)}
            title="Voir le dossier"
            className="rounded-xl p-1.5 text-blue-600 transition hover:bg-blue-50"
          >
            <Eye size={16} />
          </button>

          {canManageStudents && student.status === 'active' && (
            <button
              onClick={() => openEdit(student)}
              title="Modifier"
              className="rounded-xl p-1.5 text-amber-600 transition hover:bg-amber-50"
            >
              <Edit size={16} />
            </button>
          )}
          {canManageStudents && student.status === 'active' && (
            <button
              onClick={() => void handleDeleteStudent(student.id)}
              title="Archiver"
              className="rounded-xl p-1.5 text-red-600 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          )}
          {canManageStudents && student.status !== 'active' && (
            <button
              onClick={() => void handleReactivateStudent(student.id)}
              disabled={reactivatingStudentId === student.id}
              title="Réactiver cet élève (le réintégrer dans les effectifs actifs)"
              className="rounded-xl px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-200 flex items-center gap-1 shadow-2xs"
            >
              <RotateCcw size={13} className={reactivatingStudentId === student.id ? 'animate-spin' : ''} />
              <span>Réactiver</span>
            </button>
          )}
        </div>
      ),
    });

    return cols;
  }, [isTeacherUser, isParentUser, canManageStudents, reactivatingStudentId]);

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">
              {isParentUser
                ? 'Mes Enfants'
                : isTeacherUser
                ? 'Mes Élèves'
                : 'Dossiers élèves & identités'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isParentUser
                ? 'Consultez les dossiers scolaires, cartes scolaires officielles et informations de vos enfants inscrits.'
                : isTeacherUser
                ? `${teacherRoleLabel} • Suivi pédagogique et effectif complet de votre classe.`
                : 'Chaque élève dispose d\'un dossier complet avec photo, famille rattachée, carte scolaire imprimable et relevé financier.'}
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {isParentUser ? 'Mes enfants inscrits' : isTeacherUser ? 'Effectif de ma classe' : 'Vision dossier complet'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {isParentUser || isTeacherUser ? filteredStudents.length : activeCount}
                </p>
                <p className="text-xs text-slate-500">
                  {isParentUser ? 'Enfant(s)' : isTeacherUser ? 'Élèves actifs' : inactiveCount > 0 ? `Élèves actifs (${totalCount} total)` : 'Élèves suivis'}
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {filteredStudents.filter(student => Boolean(student.photo_url)).length}
                </p>
                <p className="text-xs text-slate-500">Photos chargées</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-3">
                <p className="text-2xl font-bold text-slate-900">
                  {isTeacherUser
                    ? (assignedTeacherClass?.name || 'CP1')
                    : isParentUser
                    ? 'Famille'
                    : students.reduce((sum, student) => sum + student.family_count, 0)}
                </p>
                <p className="text-xs text-slate-500">
                  {isTeacherUser ? 'Classe' : isParentUser ? 'Espace Parent' : 'Liens famille'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">
            {isParentUser ? 'Mes Enfants' : isTeacherUser ? 'Mes Élèves' : 'Population scolaire'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isParentUser
              ? `Dossiers de vos enfants inscrits (${filteredStudents.length} enfant(s))`
              : isTeacherUser
              ? `Élèves de votre classe (${filteredStudents.length} actif(s))`
              : `${activeCount} élève(s) actif(s) sur ${totalCount} au total${inactiveCount > 0 ? ` (${inactiveCount} archivé / inactif)` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isTeacherUser && !isParentUser && isGeneralAdmin && (
            <button
              onClick={() => setAuditLogsOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-900 shadow-2xs border border-indigo-800/50"
              title="Consulter le journal d'audit et surveiller les actions de tous les utilisateurs"
            >
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Journal d'Audit</span>
            </button>
          )}
          {!isTeacherUser && !isParentUser && (
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
          )}
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

      {!isParentUser && inactiveCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200/80 font-bold text-amber-900">
              {inactiveCount}
            </span>
            <div>
              <p className="font-semibold text-amber-950">
                {inactiveCount} dossier(s) archivé(s) ou transféré(s)
              </p>
              <p className="text-xs text-amber-700">
                Le tableau de bord comptabilise <strong>{activeCount} élèves actifs</strong>. Les dossiers archivés sont conservés pour l'historique financier et scolaire sans fausser les effectifs en classe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                statusFilter === 'inactive'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {statusFilter === 'inactive' ? 'Afficher tous les élèves' : 'Isoler l\'élève archivé'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs and Class selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={14} /> Filtres :
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tous ({filteredStudents.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
            Actifs ({isParentUser || isTeacherUser ? filteredStudents.length : activeCount})
          </button>
          {!isParentUser && inactiveCount > 0 && (
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                statusFilter === 'inactive'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
              Archivés / Inactifs ({inactiveCount})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isTeacherUser ? (
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              Classe : {assignedTeacherClass?.name || classes.find((c) => c.id === classFilter)?.name || 'CP1'}
            </span>
          ) : isParentUser ? (
            <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
              Famille • {filteredStudents.length} enfant(s)
            </span>
          ) : (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="">Toutes les classes ({classes.length})</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          )}

          {!isTeacherUser && !isParentUser && (statusFilter !== 'all' || classFilter) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setClassFilter('');
              }}
              className="text-xs text-slate-500 hover:text-red-600 font-medium px-2 py-1"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {filteredStudents.length === 0 && !loading ? (
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Aucun élève trouvé"
          description="Aucun élève ne correspond aux critères de filtre sélectionnés."
          action={
            statusFilter !== 'all' || classFilter ? (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setClassFilter('');
                }}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Réinitialiser les filtres
              </button>
            ) : canManageStudents ? (
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
          data={filteredStudents}
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
          canManageStudents={!isTeacher && canManageStudents}
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
          onEditPayment={openEditPayment}
          onDeletePayment={handleDeletePayment}
          onUpdateMatricule={async () => {
            await studentsQuery.refetch();
          }}
          isGeneralAdmin={!isTeacher && canManageStudents}
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
          payments={paymentsQuery.data || []}
          canteenPayments={canteenPaymentsQuery.data || []}
          studentInstallments={studentInstallmentsQuery.data || []}
          classes={classes}
          initialStudentId={paymentTargetStudent?.id}
          initialPaymentType={paymentType}
          onSavePayment={handleSaveTuitionPayment}
          onSaveCanteen={handleSaveCanteenPayment}
          saving={savingPayment}
        />
      )}

      {/* Modal Rectification Versement Admin */}
      <Modal
        isOpen={editPaymentModalOpen}
        onClose={() => setEditPaymentModalOpen(false)}
        title={`Rectification du versement N° ${editingPayment?.receipt_number || ''}`}
        size="md"
        actions={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditPaymentModalOpen(false)}
              className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveEditedPayment}
              disabled={savingEditPayment}
              className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {savingEditPayment ? 'Enregistrement...' : 'Enregistrer la correction'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            ⚠️ <strong>Modification Administrateur :</strong> Vous rectifiez directement la ligne de paiement. Le total encaissé et les restes à payer de l'élève seront immédiatement recalculés.
          </div>

          <FormField label="Montant du versement (FCFA)" required>
            <input
              type="number"
              value={editPaymentAmount}
              onChange={e => setEditPaymentAmount(Number(e.target.value))}
              min={1}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date du versement" required>
              <input
                type="date"
                value={editPaymentDate}
                onChange={e => setEditPaymentDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
              />
            </FormField>

            <FormField label="Mode de règlement">
              <select
                value={editPaymentMethod}
                onChange={e => setEditPaymentMethod(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Observation / Motif de correction">
            <textarea
              value={editPaymentNotes}
              onChange={e => setEditPaymentNotes(e.target.value)}
              rows={3}
              placeholder="Ex: Correction montant saisi en doublon..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
            />
          </FormField>
        </div>
      </Modal>

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

      {/* Journal d'Audit & Surveillance des Actions Utilisateurs */}
      <AuditLogsViewerModal
        isOpen={auditLogsOpen}
        onClose={() => setAuditLogsOpen(false)}
        schoolId={school?.id}
      />
    </div>
  );
}
