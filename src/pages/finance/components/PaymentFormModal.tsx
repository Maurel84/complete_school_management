import { useEffect, useState, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import FormField from '../../../components/common/FormField';
import { PAYMENT_METHODS, formatCurrency } from '../../../lib/utils';
import { Check, Info, ShieldAlert, Utensils } from 'lucide-react';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  studentFees: any[];
  plans: any[];
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
  onSavePayment,
  onSaveCanteen,
  saving,
}: PaymentFormModalProps) {
  const [form, setForm] = useState(EMPTY_PAYMENT_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setForm(EMPTY_PAYMENT_FORM);
    setNotice(null);
  }, [isOpen]);

  // Find the selected student's plan and canteen option
  const studentFeeInfo = useMemo(() => {
    if (!form.student_id) return null;
    return studentFees.find(sf => sf.student_id === form.student_id);
  }, [form.student_id, studentFees]);

  const studentPlan = useMemo(() => {
    if (!studentFeeInfo) return null;
    // Find plan in plans array to get compositions and schedules
    return plans.find(p => p.id === studentFeeInfo.plan_id);
  }, [studentFeeInfo, plans]);

  const selectedStudentObj = useMemo(() => {
    return students.find(s => s.id === form.student_id);
  }, [form.student_id, students]);

  // Retrieve parent phone / billing contacts
  const parentOptions = useMemo(() => {
    if (!selectedStudentObj) return [];
    return (selectedStudentObj as any).parents || [];
  }, [selectedStudentObj]);

  // Compute first versement items
  const firstVersementComposition = useMemo(() => {
    if (!studentPlan) return [];
    return studentPlan.composition || [];
  }, [studentPlan]);

  const totalFirstVersementValue = useMemo(() => {
    return firstVersementComposition.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  }, [firstVersementComposition]);

  // Handle canteen calculations
  const canteenRates = useMemo(() => {
    if (!studentPlan) return { monthly: 0, quarterly: 0, annual: 0 };
    return {
      monthly: Number(studentPlan.canteen_monthly || 0),
      quarterly: Number(studentPlan.canteen_quarterly || 0),
      annual: Number(studentPlan.canteen_annual || 0),
    };
  }, [studentPlan]);

  // Set default values when student or payment type changes
  useEffect(() => {
    if (form.payment_type === 'canteen') {
      setForm(current => ({
        ...current,
        amount: canteenRates.quarterly,
        is_first_installment: false,
      }));
    } else {
      // For tuition, suggest the first versement if it's new, or default to 0
      setForm(current => ({
        ...current,
        amount: form.is_first_installment ? totalFirstVersementValue : 0,
      }));
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
    }));
  }

  function handleSave() {
    if (!form.student_id) {
      setNotice('Veuillez sélectionner un élève.');
      return;
    }
    if (form.amount <= 0) {
      setNotice('Veuillez saisir un montant valide.');
      return;
    }

    const receiptNum = `REC-${Date.now()}`;
    const qrHash = `https://www.hdd.eecae.org/verify-receipt?id=${receiptNum}`;
    const digitalSig = `SIG-${Math.random().toString(36).substring(2, 15).toUpperCase()}`;

    if (form.payment_type === 'canteen') {
      const payload = {
        student_id: form.student_id,
        amount: form.amount,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        trimester: form.trimester,
        receipt_number: receiptNum,
        notes: form.notes,
      };
      void onSaveCanteen(payload, qrHash, digitalSig);
    } else {
      const payload = {
        student_id: form.student_id,
        parent_id: form.parent_id || null,
        amount: form.amount,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        receipt_number: receiptNum,
        notes: form.notes,
        status: 'paid', // tuition payments are validated directly
      };

      // If first installment, send composition details
      const details = form.is_first_installment
        ? firstVersementComposition.map((c: any) => ({
            item_name: c.item_name,
            amount: c.amount,
          }))
        : [];

      void onSavePayment(payload, details, qrHash, digitalSig);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enregistrer un versement"
      size="lg"
      actions={
        <>
          <button
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.student_id}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-5 animate-in">
        {notice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <ShieldAlert size={16} />
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Select Student */}
          <FormField label="Sélectionner l'élève" required>
            <select
              value={form.student_id}
              onChange={e => handleStudentChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Sélectionner</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.last_name} {s.first_name} (Matricule : {s.matricule})
                </option>
              ))}
            </select>
          </FormField>

          {/* Payment Type */}
          <FormField label="Type de frais" required>
            <select
              value={form.payment_type}
              onChange={e => setForm(c => ({ ...c, payment_type: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="tuition">Scolarité (Tranches)</option>
              <option value="canteen">Cantine</option>
            </select>
          </FormField>
        </div>

        {/* Dynamic Panel based on selection */}
        {form.student_id && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400">Plan de scolarité</span>
                <p className="font-bold text-slate-800 text-sm">{studentPlan?.name || 'Non configuré'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400">Montant Annuel</span>
                <p className="font-bold text-emerald-700 text-sm">
                  {studentPlan ? formatCurrency(studentPlan.total_amount) : '-'}
                </p>
              </div>
            </div>

            {form.payment_type === 'tuition' && studentPlan && (
              <div className="space-y-3">
                <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_first_installment}
                    onChange={e =>
                      setForm(c => ({
                        ...c,
                        is_first_installment: e.target.checked,
                        amount: e.target.checked ? totalFirstVersementValue : 0,
                      }))
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      S'agit-il du Premier Versement (Frais d'inscription inclus) ?
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Génère le reçu ventilé spécifique du premier versement (50 000 FCFA).
                    </p>
                  </div>
                </label>

                {form.is_first_installment && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                      Composition du premier versement :
                    </h5>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {firstVersementComposition.map((c: any, index: number) => (
                        <div key={index} className="flex justify-between border-b border-slate-50 pb-1">
                          <span>{c.item_name}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-slate-800 pt-1.5 text-sm border-t border-slate-100">
                        <span>Total Premier Versement</span>
                        <span className="text-emerald-700">{formatCurrency(totalFirstVersementValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.payment_type === 'canteen' && studentPlan && (
              <div className="space-y-4 animate-in">
                {/* Trimester Canteen Selection */}
                <FormField label="Trimestre exigible" required>
                  <select
                    value={form.trimester}
                    onChange={e =>
                      setForm(c => ({
                        ...c,
                        trimester: Number(e.target.value),
                        amount: canteenRates.quarterly,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none"
                  >
                    <option value={1}>1er Trimestre (21 000 / 24 000 FCFA)</option>
                    <option value={2}>2e Trimestre (21 000 / 24 000 FCFA)</option>
                    <option value={3}>3e Trimestre (21 000 / 24 000 FCFA)</option>
                  </select>
                </FormField>

                {/* Read only rates information card */}
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <Info size={16} />
                    <h5 className="text-xs font-bold uppercase tracking-wider">Tarification Cantine</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white rounded-xl p-2 border border-slate-100">
                      <p className="text-slate-400">Mensuel</p>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {formatCurrency(canteenRates.monthly)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-amber-200">
                      <p className="text-amber-800 font-medium">Trimestriel</p>
                      <p className="font-bold text-amber-900 mt-0.5">
                        {formatCurrency(canteenRates.quarterly)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-slate-100">
                      <p className="text-slate-400">Annuel</p>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {formatCurrency(canteenRates.annual)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 leading-normal mt-2">
                    *Règle métier* : Pour simplifier la comptabilité de La Harpe de David, les paiements sont enregistrés trimestriellement.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Amount field */}
          <FormField label="Montant à verser (FCFA)" required>
            <input
              type="number"
              disabled={form.is_first_installment || form.payment_type === 'canteen'}
              value={form.amount || ''}
              onChange={e => setForm(c => ({ ...c, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </FormField>

          {/* Payment Method */}
          <FormField label="Mode de paiement" required>
            <select
              value={form.payment_method}
              onChange={e => setForm(c => ({ ...c, payment_method: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Payment Date */}
          <FormField label="Date de versement" required>
            <input
              type="date"
              value={form.payment_date}
              onChange={e => setForm(c => ({ ...c, payment_date: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </FormField>
        </div>

        <FormField label="Notes / Remarques">
          <textarea
            value={form.notes}
            onChange={e => setForm(c => ({ ...c, notes: e.target.value }))}
            rows={2}
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none"
          />
        </FormField>
      </div>
    </Modal>
  );
}
