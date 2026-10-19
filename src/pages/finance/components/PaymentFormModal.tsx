import { useEffect, useState, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import FormField from '../../../components/common/FormField';
import { PAYMENT_METHODS, formatCurrency, formatDate, generateReceiptNumber } from '../../../lib/utils';
import {
  Check,
  Info,
  ShieldAlert,
  Utensils,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Receipt,
  CreditCard,
  Phone,
  Sparkles,
  User,
  Calendar,
  ShieldCheck,
  ArrowRight,
  History,
  FileCheck2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { resolveStudentFinance } from '../../../lib/financePlanResolver';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  studentFees: any[];
  plans: any[];
  payments?: any[];
  canteenPayments?: any[];
  studentInstallments?: any[];
  classes?: any[];
  initialStudentId?: string;
  initialPaymentType?: 'tuition' | 'canteen';
  onSavePayment: (payload: any, details: any[], qrHash: string, digitalSig: string) => Promise<void>;
  onSaveCanteen: (payload: any, qrHash: string, digitalSig: string) => Promise<void>;
  saving: boolean;
}

const EMPTY_PAYMENT_FORM = {
  student_id: '',
  parent_id: '',
  payment_type: 'tuition', // 'tuition' | 'canteen'
  amount: 0,
  payment_method: 'cash',
  payment_date: new Date().toISOString().split('T')[0],
  notes: '',
  trimester: 1, // for canteen
  is_first_installment: false,
};

export default function PaymentFormModal({
  isOpen,
  onClose,
  students = [],
  studentFees = [],
  plans = [],
  payments = [],
  canteenPayments = [],
  studentInstallments = [],
  classes = [],
  initialStudentId,
  initialPaymentType = 'tuition',
  onSavePayment,
  onSaveCanteen,
  saving,
}: PaymentFormModalProps) {
  const [form, setForm] = useState(EMPTY_PAYMENT_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const selectedStudent = students.find(s => s.id === initialStudentId);
      const parentId = (selectedStudent as any)?.parents?.[0]?.parent_id || '';

      setForm({
        ...EMPTY_PAYMENT_FORM,
        student_id: initialStudentId || '',
        parent_id: parentId,
        payment_type: initialPaymentType || 'tuition',
        payment_date: new Date().toISOString().split('T')[0],
      });
      setNotice(null);
      setShowHistory(false);
    }
  }, [isOpen, initialStudentId, initialPaymentType, students]);

  const selectedStudentObj = useMemo(() => {
    return students.find(s => s.id === form.student_id);
  }, [form.student_id, students]);

  // Resolve student finance automatically
  const resolvedFinance = useMemo(() => {
    if (!selectedStudentObj) return null;
    return resolveStudentFinance({
      student: selectedStudentObj,
      plans,
      studentFees,
      studentInstallments,
      tuitionPayments: payments,
      canteenPayments,
      classes,
    });
  }, [selectedStudentObj, plans, studentFees, studentInstallments, payments, canteenPayments, classes]);

  // Retrieve past tuition payments for this student
  const studentPastTuitionPayments = useMemo(() => {
    if (!form.student_id) return [];
    return (payments || [])
      .filter((p: any) => p.student_id === form.student_id && p.status !== 'cancelled')
      .sort((a: any, b: any) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
  }, [payments, form.student_id]);

  // Retrieve past canteen payments for this student
  const studentPastCanteenPayments = useMemo(() => {
    if (!form.student_id) return [];
    return (canteenPayments || [])
      .filter((p: any) => p.student_id === form.student_id)
      .sort((a: any, b: any) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
  }, [canteenPayments, form.student_id]);

  // Compute detailed schedule coverage
  const scheduleCoverage = useMemo(() => {
    if (!resolvedFinance?.schedule || resolvedFinance.schedule.length === 0) return [];
    let runningPaid = resolvedFinance.paidTuition;
    const today = new Date().toISOString().split('T')[0];

    return resolvedFinance.schedule.map((inst, idx) => {
      const amt = Number(inst.amount) || 0;
      const paidForThis = Math.min(amt, runningPaid);
      const remainingForThis = Math.max(0, amt - paidForThis);
      runningPaid = Math.max(0, runningPaid - paidForThis);

      const isFullyPaid = paidForThis >= amt;
      const isPartial = paidForThis > 0 && paidForThis < amt;
      const isLate = !isFullyPaid && inst.due_date <= today;

      return {
        ...inst,
        paidAmount: paidForThis,
        remainingAmount: remainingForThis,
        isFullyPaid,
        isPartial,
        isLate,
        index: idx + 1,
      };
    });
  }, [resolvedFinance]);

  // Find next unpaid tranche
  const nextPayableTranche = useMemo(() => {
    return scheduleCoverage.find(s => !s.isFullyPaid);
  }, [scheduleCoverage]);

  // Compute percentage of tuition paid
  const percentagePaid = useMemo(() => {
    if (!resolvedFinance || resolvedFinance.totalExpectedTuition === 0) return 0;
    return Math.min(100, Math.round((resolvedFinance.paidTuition / resolvedFinance.totalExpectedTuition) * 100));
  }, [resolvedFinance]);

  // Retrieve primary guardian contact info
  const guardianInfo = useMemo(() => {
    if (!selectedStudentObj) return null;
    const pList = (selectedStudentObj as any).parents || [];
    if (pList.length > 0 && pList[0].parent) {
      return {
        name: `${pList[0].parent.first_name || ''} ${pList[0].parent.last_name || ''}`.trim(),
        phone: pList[0].parent.phone,
        relationship: pList[0].relationship || 'Tuteur',
      };
    }
    if ((selectedStudentObj as any).parent_name || (selectedStudentObj as any).parent_phone) {
      return {
        name: (selectedStudentObj as any).parent_name || 'Tuteur légal',
        phone: (selectedStudentObj as any).parent_phone,
        relationship: 'Tuteur',
      };
    }
    return null;
  }, [selectedStudentObj]);

  // Compute first versement items
  const firstVersementComposition = useMemo(() => {
    if (!resolvedFinance) return [];
    return resolvedFinance.composition || [];
  }, [resolvedFinance]);

  const totalFirstVersementValue = useMemo(() => {
    return firstVersementComposition.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  }, [firstVersementComposition]);

  // Handle canteen calculations
  const canteenRates = useMemo(() => {
    if (!resolvedFinance) return { monthly: 0, quarterly: 0, annual: 0 };
    return {
      monthly: resolvedFinance.canteenMonthly,
      quarterly: resolvedFinance.canteenQuarterly,
      annual: resolvedFinance.canteenAnnual,
    };
  }, [resolvedFinance]);

  // Set default values when student or payment type changes
  useEffect(() => {
    if (form.payment_type === 'canteen') {
      setForm(current => ({
        ...current,
        amount: canteenRates.quarterly || 24000,
        is_first_installment: false,
      }));
    } else {
      if (form.is_first_installment) {
        setForm(current => ({
          ...current,
          amount: totalFirstVersementValue,
        }));
      }
    }
  }, [form.payment_type, canteenRates.quarterly, totalFirstVersementValue, form.is_first_installment]);

  function handleStudentChange(studentId: string) {
    const feeInfo = studentFees.find(sf => sf.student_id === studentId);
    const parentId = feeInfo?.student?.parents?.[0]?.parent_id || '';

    setForm(current => ({
      ...current,
      student_id: studentId,
      parent_id: parentId,
      is_first_installment: false,
      amount: 0,
    }));
  }

  function handleQuickSetAmount(targetAmount: number, isFirstInst = false) {
    setForm(current => ({
      ...current,
      amount: Math.max(0, targetAmount),
      is_first_installment: isFirstInst,
    }));
  }

  async function handleSave() {
    setNotice(null);

    if (!form.student_id) {
      setNotice('Veuillez sélectionner un élève.');
      return;
    }

    if (!form.amount || form.amount <= 0) {
      setNotice('Veuillez renseigner un montant valide.');
      return;
    }

    // Hash and cryptographic signature simulation
    const qrHash = `SIGN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const digitalSig = `EDUSIGN-SHA256-${Date.now().toString(16)}-VALIDATED`;

    if (form.payment_type === 'canteen') {
      const payload = {
        student_id: form.student_id,
        amount: form.amount,
        trimester: form.trimester,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes || '',
        receipt_number: `CANT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      };

      await onSaveCanteen(payload, qrHash, digitalSig);
    } else {
      const finalNotes = form.is_first_installment
        ? (form.notes ? `${form.notes} - 1er versement (Inscription & Fournitures)` : '1er versement (Inscription & Fournitures)')
        : (form.notes || '');

      const payload = {
        student_id: form.student_id,
        parent_id: form.parent_id || null,
        amount: form.amount,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        notes: finalNotes,
        receipt_number: generateReceiptNumber(),
        status: 'paid',
      };

      const details = form.is_first_installment
        ? firstVersementComposition.map((c: any) => ({
            item_name: c.item_name,
            amount: c.amount,
          }))
        : [];

      await onSavePayment(payload, details, qrHash, digitalSig);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guichet d'Encaissement & Versement Élève"
      size="xl"
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 hidden sm:block">
            {resolvedFinance && form.amount > 0 ? (
              <span>
                Nouveau reste estimé après ce versement :{' '}
                <strong className="text-slate-800">
                  {formatCurrency(Math.max(0, resolvedFinance.remaining - form.amount))}
                </strong>
              </span>
            ) : (
              <span>Règlement immédiat avec validation en caisse & reçu ventilé</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.student_id || !form.amount || form.amount <= 0}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileCheck2 size={16} />
              {saving ? 'Enregistrement en cours...' : 'Valider & Encaisser'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 animate-in">
        {notice && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Top Selection Filters */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 bg-slate-50/80 p-4 rounded-3xl border border-slate-200/80">
          <FormField label="Sélectionner l'élève à encaisser" required>
            <select
              value={form.student_id}
              onChange={e => handleStudentChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none shadow-xs"
            >
              <option value="">Sélectionner un élève...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.last_name.toUpperCase()} {s.first_name} — {s.class?.name || 'Sans classe'} ({s.matricule})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Type de frais à encaisser" required>
            <select
              value={form.payment_type}
              onChange={e => setForm(c => ({ ...c, payment_type: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none shadow-xs"
            >
              <option value="tuition">Scolarité annuelle (Tranches & Inscription)</option>
              <option value="canteen">Cantine scolaire (Restauration)</option>
            </select>
          </FormField>
        </div>

        {/* DYNAMIC FINANCIAL SYNTHESIS PANEL */}
        {form.student_id && resolvedFinance && (
          <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/30 p-5 shadow-sm space-y-4">
            
            {/* Student Identity Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold flex items-center justify-center text-base shadow-sm">
                  {selectedStudentObj?.photo_url ? (
                    <img src={selectedStudentObj.photo_url} alt="Élève" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    `${selectedStudentObj?.first_name?.[0] || ''}${selectedStudentObj?.last_name?.[0] || ''}`.toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {selectedStudentObj?.last_name?.toUpperCase()} {selectedStudentObj?.first_name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {resolvedFinance.className}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-semibold text-slate-600">Matricule : {selectedStudentObj?.matricule}</span>
                    {guardianInfo && (
                      <span className="flex items-center gap-1 text-slate-600">
                        • {guardianInfo.relationship} : <strong className="text-slate-800">{guardianInfo.name}</strong>
                        {guardianInfo.phone && (
                          <a
                            href={`tel:${guardianInfo.phone}`}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 ml-1 font-mono font-bold"
                          >
                            <Phone size={11} /> {guardianInfo.phone}
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                {resolvedFinance.remaining === 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Scolarité Soldée à 100%
                  </span>
                ) : resolvedFinance.delayAmount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold">
                    <AlertCircle size={14} className="text-rose-600" />
                    Retard exigible : {formatCurrency(resolvedFinance.delayAmount)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold">
                    <Clock size={14} className="text-blue-600" />
                    À jour des échéances
                  </span>
                )}
              </div>
            </div>

            {/* 4 Financial KPIs Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Scolarité Annuelle */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  Scolarité Annuelle
                </span>
                <p className="text-base font-black text-slate-900 mt-1">
                  {formatCurrency(resolvedFinance.totalExpectedTuition)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Plan : {resolvedFinance.planName || 'Standard'}
                </p>
              </div>

              {/* 2. Déjà Encaissé */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                    Déjà Encaissé
                  </span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    {percentagePaid}%
                  </span>
                </div>
                <p className="text-base font-black text-emerald-700 mt-1">
                  {formatCurrency(resolvedFinance.paidTuition)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {studentPastTuitionPayments.length} versement(s) validé(s)
                </p>
              </div>

              {/* 3. Reste à Payer */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  Reste Net à Payer
                </span>
                <p className={`text-base font-black mt-1 ${resolvedFinance.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(resolvedFinance.remaining)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {resolvedFinance.remaining === 0 ? 'Aucun impayé' : 'Solde débiteur'}
                </p>
              </div>

              {/* 4. Cantine & Extras */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  Cantine Encaissée
                </span>
                <p className="text-base font-black text-amber-700 mt-1">
                  {formatCurrency(resolvedFinance.paidCanteen)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {studentPastCanteenPayments.length} trimestre(s) réglé(s)
                </p>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                <span>Progression du règlement annuel</span>
                <span>{percentagePaid}% soldé</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${percentagePaid}%` }}
                />
              </div>
            </div>

            {/* LIVE SCHEDULE / TRANCHES VISUAL TIMELINE */}
            {form.payment_type === 'tuition' && scheduleCoverage.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                    <Receipt size={14} className="text-emerald-600" />
                    Échéancier des Tranches de Scolarité
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Cliquez sur une tranche pour pré-remplir le montant
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {scheduleCoverage.map(inst => (
                    <button
                      key={inst.installment_number}
                      type="button"
                      onClick={() => handleQuickSetAmount(inst.remainingAmount, inst.index === 1 && inst.paidAmount === 0)}
                      disabled={inst.isFullyPaid}
                      className={`text-left p-3 rounded-2xl border transition-all text-xs flex flex-col justify-between ${
                        inst.isFullyPaid
                          ? 'bg-emerald-50/70 border-emerald-200 opacity-80 cursor-default'
                          : inst.isPartial
                          ? 'bg-amber-50 border-amber-300 hover:border-amber-400 shadow-xs'
                          : inst.isLate
                          ? 'bg-rose-50 border-rose-300 hover:border-rose-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-slate-800 text-xs">
                          {inst.label || `Tranche ${inst.index}`}
                        </span>
                        {inst.isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                            <Check size={10} /> Soldé
                          </span>
                        ) : inst.isPartial ? (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            Partiel
                          </span>
                        ) : inst.isLate ? (
                          <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded-md">
                            En retard
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            À venir
                          </span>
                        )}
                      </div>

                      <div className="mt-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] text-slate-500">Exigible :</span>
                          <span className="font-extrabold text-slate-900">{formatCurrency(inst.amount)}</span>
                        </div>
                        {!inst.isFullyPaid && (
                          <div className="flex justify-between items-baseline mt-0.5">
                            <span className="text-[11px] font-semibold text-rose-600">Reste dû :</span>
                            <span className="font-black text-rose-600">{formatCurrency(inst.remainingAmount)}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          Échéance : {formatDate(inst.due_date)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 1-Click Fast-Fill Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-500 mr-1">Raccourcis :</span>
                  
                  {nextPayableTranche && nextPayableTranche.remainingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleQuickSetAmount(nextPayableTranche.remainingAmount)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Sparkles size={12} className="text-amber-600" />
                      Payer {nextPayableTranche.label || `Tranche ${nextPayableTranche.index}`} ({formatCurrency(nextPayableTranche.remainingAmount)})
                    </button>
                  )}

                  {resolvedFinance.remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => handleQuickSetAmount(resolvedFinance.remaining)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      Solder la Totalité Restante ({formatCurrency(resolvedFinance.remaining)})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* PREMIER VERSEMENT TOGGLE & VENTILATION */}
            {form.payment_type === 'tuition' && (
              <div className="space-y-3 pt-2 border-t border-slate-200/60">
                <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3.5 cursor-pointer hover:border-emerald-500 transition shadow-2xs">
                  <input
                    type="checkbox"
                    checked={form.is_first_installment}
                    onChange={e =>
                      setForm(c => ({
                        ...c,
                        is_first_installment: e.target.checked,
                        amount: e.target.checked ? totalFirstVersementValue : (c.amount || 0),
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      S'agit-il du Premier Versement (Frais d'inscription & fournitures inclus) ?
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Génère le reçu officiel détaillé et ventilé avec inscription, tissus, tenue de sport et macaron ({formatCurrency(totalFirstVersementValue)}).
                    </p>
                  </div>
                </label>

                {form.is_first_installment && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-in">
                    <h5 className="text-xs font-extrabold text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      <Receipt size={13} className="text-emerald-600" />
                      Composition détaillée du premier versement :
                    </h5>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {firstVersementComposition.map((c: any, index: number) => (
                        <div key={index} className="flex justify-between border-b border-slate-50 pb-1">
                          <span>{c.item_name}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-black text-slate-900 pt-2 text-sm border-t border-slate-200">
                        <span>Total Premier Versement</span>
                        <span className="text-emerald-700">{formatCurrency(totalFirstVersementValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CANTINE RATES INFO */}
            {form.payment_type === 'canteen' && (
              <div className="space-y-4 pt-2 border-t border-slate-200/60 animate-in">
                <FormField label="Trimestre exigible" required>
                  <select
                    value={form.trimester}
                    onChange={e =>
                      setForm(c => ({
                        ...c,
                        trimester: Number(e.target.value),
                        amount: canteenRates.quarterly || 24000,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value={1}>1er Trimestre ({formatCurrency(canteenRates.quarterly || 24000)})</option>
                    <option value={2}>2e Trimestre ({formatCurrency(canteenRates.quarterly || 24000)})</option>
                    <option value={3}>3e Trimestre ({formatCurrency(canteenRates.quarterly || 24000)})</option>
                  </select>
                </FormField>

                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <Info size={16} />
                    <h5 className="text-xs font-bold uppercase tracking-wider">Tarification Cantine de l'école</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white rounded-xl p-2 border border-slate-100">
                      <p className="text-slate-400">Mensuel</p>
                      <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(canteenRates.monthly)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-amber-300 shadow-2xs">
                      <p className="text-amber-800 font-bold">Trimestriel</p>
                      <p className="font-black text-amber-900 mt-0.5">{formatCurrency(canteenRates.quarterly)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-slate-100">
                      <p className="text-slate-400">Annuel</p>
                      <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(canteenRates.annual)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 leading-normal mt-2">
                    *Règle métier* : Pour simplifier la gestion comptable, les règlements de cantine sont enregistrés au forfait trimestriel.
                  </p>
                </div>
              </div>
            )}

            {/* MINI PAST PAYMENTS HISTORY ACCORDION */}
            {studentPastTuitionPayments.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-slate-900 transition py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <History size={14} className="text-emerald-600" />
                    Historique des versements déjà effectués ({studentPastTuitionPayments.length})
                  </span>
                  {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showHistory && (
                  <div className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {studentPastTuitionPayments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">{p.receipt_number}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{formatDate(p.payment_date)}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 font-medium capitalize">{p.payment_method}</span>
                        </div>
                        <span className="font-black text-emerald-700">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* INPUT FIELDS: MONTANT & MODE DE PAIEMENT */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Montant à verser (FCFA)" required>
            <input
              type="number"
              disabled={form.payment_type === 'canteen'}
              value={form.amount || ''}
              onChange={e => setForm(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
              placeholder="Ex: 30000"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-base font-extrabold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </FormField>

          <FormField label="Mode de règlement" required>
            <select
              value={form.payment_method}
              onChange={e => setForm(c => ({ ...c, payment_method: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Date de versement" required>
            <input
              type="date"
              value={form.payment_date}
              onChange={e => setForm(c => ({ ...c, payment_date: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </FormField>
        </div>

        <FormField label="Notes / Référence du versement (optionnel)">
          <textarea
            value={form.notes}
            onChange={e => setForm(c => ({ ...c, notes: e.target.value }))}
            rows={2}
            placeholder="Ex: Règlement 2ème tranche, remis par M. Agohi..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-600"
          />
        </FormField>
      </div>
    </Modal>
  );
}
