import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDate, PAYMENT_METHODS, generateReceiptNumber } from '../../lib/utils';
import type { Payment, Fee, FeeType, Student } from '../../types';
import { DollarSign, Plus, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function FinancePage() {
  const { school, academicYear } = useApp();
  const { isAdmin, isDirector, isCashier, isAccountant, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'payments' | 'fees' | 'discounts'>('payments');
  const [modalOpen, setModalOpen] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    student_id: '', fee_id: '', amount: 0, payment_method: 'cash', notes: '',
  });

  const [feeForm, setFeeForm] = useState({
    fee_type_id: '', amount: 0, level_id: '', class_id: '', due_date: '', description: '',
  });

  useEffect(() => { if (school) fetchData(); }, [school, academicYear]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [payRes, feeRes, ftRes, stuRes] = await Promise.all([
      supabase.from('payments').select('*, students(first_name, last_name, matricule)').eq('school_id', sid).order('created_at', { ascending: false }),
      supabase.from('fees').select('*, fee_type:fee_types(*)').eq('school_id', sid),
      supabase.from('fee_types').select('*').eq('school_id', sid),
      supabase.from('students').select('id, first_name, last_name, matricule').eq('school_id', sid).eq('status', 'active'),
    ]);
    setPayments((payRes.data as Payment[]) || []);
    setFees((feeRes.data as Fee[]) || []);
    setFeeTypes((ftRes.data as FeeType[]) || []);
    setStudents((stuRes.data as Student[]) || []);
    setLoading(false);
  }

  async function handleSavePayment() {
    setSaving(true);
    const receiptNumber = generateReceiptNumber();
    await supabase.from('payments').insert({
      ...paymentForm,
      school_id: school!.id,
      receipt_number: receiptNumber,
      payment_date: new Date().toISOString().split('T')[0],
      academic_year_id: academicYear?.id,
      processed_by: profile?.id,
      status: 'paid',
    });
    // Also create a cash transaction
    await supabase.from('cash_transactions').insert({
      school_id: school!.id,
      transaction_number: `TRX-${Date.now()}`,
      type: 'in',
      amount: paymentForm.amount,
      description: `Paiement - ${students.find(s => s.id === paymentForm.student_id)?.last_name || ''}`,
      category: 'payment',
      processed_by: profile?.id,
      validated: true,
    });
    setSaving(false); setModalOpen(false); fetchData();
  }

  async function handleSaveFee() {
    setSaving(true);
    await supabase.from('fees').insert({
      ...feeForm,
      school_id: school!.id,
      academic_year_id: academicYear?.id,
    });
    setSaving(false); setFeeModalOpen(false); fetchData();
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalFees = fees.reduce((s, f) => s + Number(f.amount), 0);

  const paymentColumns = [
    { key: 'receipt_number', label: 'N° Reçu' },
    { key: 'student', label: 'Élève', render: (p: any) => p.students ? `${p.students.first_name} ${p.students.last_name}` : '-' },
    { key: 'amount', label: 'Montant', render: (p: Payment) => formatCurrency(p.amount) },
    { key: 'payment_method', label: 'Mode', render: (p: Payment) => PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method },
    { key: 'payment_date', label: 'Date', render: (p: Payment) => formatDate(p.payment_date) },
    { key: 'status', label: 'Statut', render: (p: Payment) => <Badge status={p.status} /> },
  ];

  const feeColumns = [
    { key: 'fee_type', label: 'Type de frais', render: (f: any) => f.fee_type?.name || '-' },
    { key: 'amount', label: 'Montant', render: (f: Fee) => formatCurrency(f.amount) },
    { key: 'level_id', label: 'Niveau' },
    { key: 'due_date', label: 'Échéance', render: (f: Fee) => f.due_date ? formatDate(f.due_date) : '-' },
    { key: 'description', label: 'Description' },
  ];

  const tabs = [
    { key: 'payments', label: 'Paiements' },
    { key: 'fees', label: 'Frais' },
    { key: 'discounts', label: 'Remises & Bourses' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion financière</h1>
          <p className="text-gray-500 mt-1">Paiements, frais et scolarité</p>
        </div>
        {(isAdmin || isDirector || isCashier || isAccountant) && (
          <div className="flex gap-2">
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus size={18} /> Nouveau paiement
            </button>
            <button onClick={() => setFeeModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
              <Plus size={18} /> Nouveau frais
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<DollarSign size={20} />} value={formatCurrency(totalPaid)} label="Total encaissé" color="green" />
        <StatCard icon={<CheckCircle size={20} />} value={payments.length} label="Paiements" color="blue" />
        <StatCard icon={<AlertTriangle size={20} />} value={formatCurrency(Math.max(0, totalFees * students.length - totalPaid))} label="Impayés estimés" color="red" />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payments' && <DataTable columns={paymentColumns} data={payments as any[]} searchPlaceholder="Rechercher un paiement..." searchKeys={['receipt_number']} loading={loading} />}
      {tab === 'fees' && <DataTable columns={feeColumns} data={fees as any[]} searchPlaceholder="Rechercher un frais..." searchKeys={['description']} loading={loading} />}
      {tab === 'discounts' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Les remises et bourses seront gérées ici
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau paiement" size="md"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSavePayment} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer le paiement</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Élève" required>
            <select value={paymentForm.student_id} onChange={e => setPaymentForm({...paymentForm, student_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner un élève</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name} ({s.matricule})</option>)}
            </select>
          </FormField>
          <FormField label="Frais">
            <select value={paymentForm.fee_id} onChange={e => setPaymentForm({...paymentForm, fee_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner un frais</option>
              {fees.map(f => <option key={f.id} value={f.id}>{(f as any).fee_type?.name || 'Frais'} - {formatCurrency(f.amount)}</option>)}
            </select>
          </FormField>
          <FormField label="Montant" required>
            <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Mode de paiement">
            <select value={paymentForm.payment_method} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>
          <FormField label="Notes">
            <textarea value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
        </div>
      </Modal>

      <Modal isOpen={feeModalOpen} onClose={() => setFeeModalOpen(false)} title="Nouveau frais" size="md"
        actions={<>
          <button onClick={() => setFeeModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveFee} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Type de frais" required>
            <select value={feeForm.fee_type_id} onChange={e => setFeeForm({...feeForm, fee_type_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner</option>
              {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
            </select>
          </FormField>
          <FormField label="Montant" required>
            <input type="number" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Échéance"><input type="date" value={feeForm.due_date} onChange={e => setFeeForm({...feeForm, due_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Description"><textarea value={feeForm.description} onChange={e => setFeeForm({...feeForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
