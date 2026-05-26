import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import type { CashRegister, CashTransaction } from '../../types';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Unlock, Lock } from 'lucide-react';

export default function CashPage() {
  const { school } = useApp();
  const { isAdmin, isCashier, isAccountant, profile } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [activeRegister, setActiveRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'in', amount: 0, description: '', category: '' });

  useEffect(() => { if (school) fetchData(); }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [regRes, txRes] = await Promise.all([
      supabase.from('cash_registers').select('*').eq('school_id', sid).order('opened_at', { ascending: false }),
      supabase.from('cash_transactions').select('*').eq('school_id', sid).order('created_at', { ascending: false }).limit(50),
    ]);
    const regs = (regRes.data as CashRegister[]) || [];
    setRegisters(regs);
    setActiveRegister(regs.find(r => r.status === 'open') || null);
    setTransactions((txRes.data as CashTransaction[]) || []);
    setLoading(false);
  }

  async function openRegister() {
    setSaving(true);
    const { data } = await supabase.from('cash_registers').insert({
      school_id: school!.id,
      cashier_id: profile?.id,
      opening_balance: 0,
      status: 'open',
    }).select().maybeSingle();
    if (data) setActiveRegister(data as CashRegister);
    setSaving(false); fetchData();
  }

  async function closeRegister() {
    if (!activeRegister) return;
    const inTotal = transactions.filter(t => t.type === 'in' && t.cash_register_id === activeRegister.id).reduce((s, t) => s + Number(t.amount), 0);
    const outTotal = transactions.filter(t => t.type === 'out' && t.cash_register_id === activeRegister.id).reduce((s, t) => s + Number(t.amount), 0);
    await supabase.from('cash_registers').update({
      closing_balance: activeRegister.opening_balance + inTotal - outTotal,
      closed_at: new Date().toISOString(),
      status: 'closed',
    }).eq('id', activeRegister.id);
    setActiveRegister(null); fetchData();
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('cash_transactions').insert({
      school_id: school!.id,
      cash_register_id: activeRegister?.id,
      transaction_number: `TRX-${Date.now()}`,
      ...form,
      processed_by: profile?.id,
      validated: isAdmin,
    });
    setSaving(false); setModalOpen(false); fetchData();
  }

  const totalIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIn - totalOut;

  const columns = [
    { key: 'transaction_number', label: 'N° Transaction' },
    { key: 'type', label: 'Type', render: (t: CashTransaction) => (
      <span className={`flex items-center gap-1 ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
        {t.type === 'in' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {t.type === 'in' ? 'Entrée' : 'Sortie'}
      </span>
    )},
    { key: 'amount', label: 'Montant', render: (t: CashTransaction) => formatCurrency(t.amount) },
    { key: 'description', label: 'Description' },
    { key: 'validated', label: 'Validé', render: (t: CashTransaction) => <Badge status={t.validated ? 'validated' : 'pending'} label={t.validated ? 'Oui' : 'En attente'} /> },
    { key: 'created_at', label: 'Date', render: (t: CashTransaction) => formatDateTime(t.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caisse</h1>
          <p className="text-gray-500 mt-1">Gestion des entrées et sorties d'argent</p>
        </div>
        <div className="flex gap-2">
          {activeRegister ? (
            <>
              <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus size={18} /> Transaction
              </button>
              <button onClick={closeRegister} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                <Lock size={18} /> Fermer la caisse
              </button>
            </>
          ) : (
            <button onClick={openRegister} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
              <Unlock size={18} /> Ouvrir la caisse
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<ArrowUpRight size={20} />} value={formatCurrency(totalIn)} label="Total entrées" color="green" />
        <StatCard icon={<ArrowDownRight size={20} />} value={formatCurrency(totalOut)} label="Total sorties" color="red" />
        <StatCard icon={<Wallet size={20} />} value={formatCurrency(balance)} label="Solde actuel" color="blue" />
      </div>

      {activeRegister && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg"><Unlock size={18} className="text-emerald-600" /></div>
          <div>
            <p className="text-sm font-medium text-emerald-800">Caisse ouverte</p>
            <p className="text-xs text-emerald-600">Fond de caisse : {formatCurrency(activeRegister.opening_balance)}</p>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={transactions as any[]} searchPlaceholder="Rechercher une transaction..." searchKeys={['transaction_number', 'description']} loading={loading} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle transaction" size="md"
        actions={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Type de transaction" required>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="in">Entrée d'argent</option>
              <option value="out">Sortie d'argent</option>
            </select>
          </FormField>
          <FormField label="Montant" required>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Catégorie">
            <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Ex: fournitures, salaires..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Description">
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
