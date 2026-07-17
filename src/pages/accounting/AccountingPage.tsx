import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Expense, AccountingAccount, AccountingEntry } from '../../types';
import { Calculator, Plus, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import { createDoubleEntry, createCashTransaction } from '../../lib/accountingSync';

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  min_threshold: number;
  unit_price: number;
};

export default function AccountingPage() {
  const { school } = useApp();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expenses' | 'entries' | 'plan' | 'inventory'>('expenses');
  const [expenseModal, setExpenseModal] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [inventoryModal, setInventoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: 0, supplier: '', invoice_number: '' });
  const [entryForm, setEntryForm] = useState({ account_id: '', entry_number: '', debit: 0, credit: 0, description: '', reference: '' });
  const [adjustForm, setAdjustForm] = useState({ quantity: 0, type: 'in' as 'in' | 'out', description: '' });

  useEffect(() => { if (school) fetchData(); }, [school]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    const [expRes, entRes, accRes, invRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('school_id', sid).order('expense_date', { ascending: false }),
      supabase.from('accounting_entries').select('*').eq('school_id', sid).order('entry_date', { ascending: false }),
      supabase.from('accounting_accounts').select('*').eq('school_id', sid).order('account_number'),
      supabase.from('inventory_items').select('*').eq('school_id', sid).order('name'),
    ]);
    setExpenses((expRes.data as Expense[]) || []);
    setEntries((entRes.data as AccountingEntry[]) || []);
    setAccounts((accRes.data as AccountingAccount[]) || []);
    setInventoryItems((invRes.data as InventoryItem[]) || []);
    setLoading(false);
  }

  async function handleSaveExpense() {
    setSaving(true);
    try {
      const { data, error } = await supabase.from('expenses').insert({
        ...expenseForm,
        school_id: school!.id,
        status: 'validated'
      }).select('id').single();

      if (error) throw error;

      // 1. Sync to Caisse (Sortie)
      await createCashTransaction({
        schoolId: school!.id,
        type: 'out',
        amount: expenseForm.amount,
        description: `Dépense - ${expenseForm.description}`,
        category: 'expense',
      });

      // 2. Sync to General Journal (Charges 605100 / Caisse 571100)
      await createDoubleEntry({
        schoolId: school!.id,
        amount: expenseForm.amount,
        description: `Règlement Dépense - ${expenseForm.description}`,
        debitAccountNo: '605100',
        creditAccountNo: '571100',
        reference: expenseForm.invoice_number || '',
      });
    } catch (e) {
      console.error("Failed to save and sync expense", e);
    }
    setSaving(false);
    setExpenseModal(false);
    fetchData();
  }

  async function handleSaveEntry() {
    setSaving(true);
    await supabase.from('accounting_entries').insert({ ...entryForm, school_id: school!.id, entry_date: new Date().toISOString().split('T')[0] });
    setSaving(false); setEntryModal(false); fetchData();
  }

  async function handleAdjustStock() {
    if (!selectedItem || !school) return;
    setSaving(true);
    const change = adjustForm.type === 'in' ? adjustForm.quantity : -adjustForm.quantity;
    const newQty = selectedItem.quantity + change;

    try {
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', selectedItem.id);
      await supabase.from('inventory_transactions').insert({
        school_id: school.id,
        item_id: selectedItem.id,
        transaction_type: adjustForm.type,
        quantity: adjustForm.quantity,
        unit_price: selectedItem.unit_price,
        description: adjustForm.description || `Ajustement de stock (${adjustForm.type === 'in' ? 'Entrée' : 'Sortie'})`,
      });

      setInventoryModal(false);
      setAdjustForm({ quantity: 0, type: 'in', description: '' });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

  const expenseColumns = [
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Catégorie' },
    { key: 'amount', label: 'Montant', render: (e: Expense) => formatCurrency(e.amount) },
    { key: 'supplier', label: 'Fournisseur' },
    { key: 'status', label: 'Statut', render: (e: Expense) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{e.status === 'validated' ? 'Validé' : 'En attente'}</span> },
    { key: 'expense_date', label: 'Date', render: (e: Expense) => formatDate(e.expense_date) },
  ];

  const entryColumns = [
    { key: 'entry_number', label: 'N° Écriture' },
    { key: 'account_id', label: 'Compte', render: (e: AccountingEntry) => accounts.find(a => a.id === e.account_id)?.name || e.account_id },
    { key: 'debit', label: 'Débit', render: (e: AccountingEntry) => e.debit > 0 ? formatCurrency(e.debit) : '-' },
    { key: 'credit', label: 'Crédit', render: (e: AccountingEntry) => e.credit > 0 ? formatCurrency(e.credit) : '-' },
    { key: 'description', label: 'Libellé' },
    { key: 'entry_date', label: 'Date', render: (e: AccountingEntry) => formatDate(e.entry_date) },
  ];

  const accountColumns = [
    { key: 'account_number', label: 'N° Compte' },
    { key: 'name', label: 'Intitulé' },
    { key: 'account_type', label: 'Type', render: (a: AccountingAccount) => (
      <span className="capitalize">{a.account_type === 'asset' ? 'Actif' : a.account_type === 'liability' ? 'Passif' : a.account_type === 'revenue' ? 'Recette' : 'Dépense'}</span>
    )},
  ];

  const inventoryColumns = [
    { key: 'name', label: 'Nom de l\'article' },
    { key: 'quantity', label: 'En Stock', render: (item: InventoryItem) => (
      <span className={`font-bold ${item.quantity <= item.min_threshold ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
        {item.quantity} {item.quantity <= item.min_threshold && '⚠️ (Seuil critique)'}
      </span>
    )},
    { key: 'min_threshold', label: 'Seuil d\'Alerte' },
    { key: 'unit_price', label: 'Prix Unitaire', render: (item: InventoryItem) => formatCurrency(item.unit_price) },
    { key: 'actions', label: 'Actions', render: (item: InventoryItem) => (
      <button
        onClick={() => { setSelectedItem(item); setInventoryModal(true); }}
        className="rounded-full px-3 py-1 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
      >
        Ajuster stock
      </button>
    )},
  ];

  const tabs = [
    { key: 'expenses', label: 'Dépenses' },
    { key: 'entries', label: 'Écritures' },
    { key: 'plan', label: 'Plan comptable' },
    { key: 'inventory', label: 'Stock & Inventaire' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Gestion comptable et financière</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setExpenseModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={18} /> Dépense
          </button>
          <button onClick={() => setEntryModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
            <Plus size={18} /> Écriture
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<TrendingDown size={20} />} value={formatCurrency(totalExpenses)} label="Total dépenses" color="red" />
        <StatCard icon={<TrendingUp size={20} />} value={formatCurrency(totalDebit)} label="Total débit" color="blue" />
        <StatCard icon={<FileText size={20} />} value={formatCurrency(totalCredit)} label="Total crédit" color="green" />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && <DataTable columns={expenseColumns} data={expenses as any[]} searchKeys={['description', 'category', 'supplier']} searchPlaceholder="Rechercher une dépense..." loading={loading} />}
      {tab === 'entries' && <DataTable columns={entryColumns} data={entries as any[]} searchKeys={['entry_number', 'description']} searchPlaceholder="Rechercher une écriture..." loading={loading} />}
      {tab === 'plan' && <DataTable columns={accountColumns} data={accounts as any[]} searchKeys={['account_number', 'name']} searchPlaceholder="Rechercher un compte..." loading={loading} />}
      {tab === 'inventory' && <DataTable columns={inventoryColumns} data={inventoryItems as any[]} searchKeys={['name']} searchPlaceholder="Rechercher un article..." loading={loading} />}

      <Modal isOpen={expenseModal} onClose={() => setExpenseModal(false)} title="Nouvelle dépense" size="md"
        actions={<>
          <button onClick={() => setExpenseModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveExpense} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Description" required><input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Catégorie"><input type="text" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} placeholder="Ex: fournitures, entretien..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Montant" required><input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Fournisseur"><input type="text" value={expenseForm.supplier} onChange={e => setExpenseForm({...expenseForm, supplier: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="N° Facture"><input type="text" value={expenseForm.invoice_number} onChange={e => setExpenseForm({...expenseForm, invoice_number: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={entryModal} onClose={() => setEntryModal(false)} title="Nouvelle écriture comptable" size="md"
        actions={<>
          <button onClick={() => setEntryModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveEntry} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Compte" required>
            <select value={entryForm.account_id} onChange={e => setEntryForm({...entryForm, account_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner un compte</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
            </select>
          </FormField>
          <FormField label="N° Écriture"><input type="text" value={entryForm.entry_number} onChange={e => setEntryForm({...entryForm, entry_number: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Débit"><input type="number" value={entryForm.debit} onChange={e => setEntryForm({...entryForm, debit: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <FormField label="Crédit"><input type="number" value={entryForm.credit} onChange={e => setEntryForm({...entryForm, credit: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          </div>
          <FormField label="Libellé"><input type="text" value={entryForm.description} onChange={e => setEntryForm({...entryForm, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={inventoryModal} onClose={() => setInventoryModal(false)} title={`Ajuster le stock - ${selectedItem?.name || ''}`} size="md"
        actions={<>
          <button onClick={() => setInventoryModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={handleAdjustStock} disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Type d'opération" required>
            <select value={adjustForm.type} onChange={e => setAdjustForm({...adjustForm, type: e.target.value as 'in' | 'out'})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="in">Entrée de stock (Approvisionnement)</option>
              <option value="out">Sortie de stock (Vente / Consommation)</option>
            </select>
          </FormField>
          <FormField label="Quantité" required>
            <input type="number" value={adjustForm.quantity} onChange={e => setAdjustForm({...adjustForm, quantity: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Commentaire / Justification">
            <textarea value={adjustForm.description} onChange={e => setAdjustForm({...adjustForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Ex: Livraison mensuelle..." />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
