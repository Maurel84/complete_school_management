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

  const [expenseForm, setExpenseForm] = useState({
    category: '',
    description: '',
    amount: 0,
    supplier: '',
    invoice_number: '',
    debit_account_no: '605100',  // standard school supplies
    credit_account_no: '571100', // school cash register
  });
  const [entryForm, setEntryForm] = useState({
    debit_account_id: '',
    credit_account_id: '',
    amount: 0,
    description: '',
    reference: '',
  });
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
    if (expenseForm.amount <= 0 || !expenseForm.description) {
      alert("Veuillez remplir les champs obligatoires (Description, Montant).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        category: expenseForm.category,
        description: expenseForm.description,
        amount: expenseForm.amount,
        supplier: expenseForm.supplier,
        invoice_number: expenseForm.invoice_number,
        school_id: school!.id,
        status: 'validated'
      });

      if (error) throw error;

      // 1. Sync to Caisse (Sortie) if the source account is Caisse École (571100)
      if (expenseForm.credit_account_no === '571100') {
        await createCashTransaction({
          schoolId: school!.id,
          type: 'out',
          amount: expenseForm.amount,
          description: `Dépense - ${expenseForm.description}`,
          category: 'expense',
        });
      }

      // 2. Sync to General Journal (Double-entry match)
      await createDoubleEntry({
        schoolId: school!.id,
        amount: expenseForm.amount,
        description: `Règlement Dépense - ${expenseForm.description}`,
        debitAccountNo: expenseForm.debit_account_no,
        creditAccountNo: expenseForm.credit_account_no,
        reference: expenseForm.invoice_number || '',
      });

      // Reset form
      setExpenseForm({
        category: '',
        description: '',
        amount: 0,
        supplier: '',
        invoice_number: '',
        debit_account_no: '605100',
        credit_account_no: '571100',
      });
    } catch (e: any) {
      console.error("Failed to save and sync expense", e);
      alert(`Erreur lors de l'enregistrement de la dépense : ${e.message}`);
    }
    setSaving(false);
    setExpenseModal(false);
    fetchData();
  }

  async function handleSaveEntry() {
    if (!entryForm.debit_account_id || !entryForm.credit_account_id || entryForm.amount <= 0 || !entryForm.description) {
      alert("Veuillez remplir tous les champs obligatoires (Compte débit, Compte crédit, Montant, Libellé).");
      return;
    }
    setSaving(true);
    try {
      const entryNumber = `ECR-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];

      // Save both debit and credit entries to keep journal balanced
      const { error } = await supabase.from('accounting_entries').insert([
        {
          school_id: school!.id,
          account_id: entryForm.debit_account_id,
          entry_number: entryNumber,
          debit: entryForm.amount,
          credit: 0,
          description: entryForm.description,
          entry_date: today,
          reference: entryForm.reference,
        },
        {
          school_id: school!.id,
          account_id: entryForm.credit_account_id,
          entry_number: entryNumber,
          debit: 0,
          credit: entryForm.amount,
          description: entryForm.description,
          entry_date: today,
          reference: entryForm.reference,
        }
      ]);

      if (error) throw error;

      // Reset form
      setEntryForm({
        debit_account_id: '',
        credit_account_id: '',
        amount: 0,
        description: '',
        reference: '',
      });
    } catch (e: any) {
      console.error("Failed to save manual journal entry", e);
      alert(`Erreur lors de l'enregistrement de l'écriture : ${e.message}`);
    }
    setSaving(false);
    setEntryModal(false);
    fetchData();
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

  const expenseAccounts = accounts.filter(a => a.account_type === 'expense' || a.account_number.startsWith('6'));
  const treasuryAccounts = accounts.filter(a => a.account_number.startsWith('5') || a.account_type === 'asset');

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
          <FormField label="Description / Objet" required>
            <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="Ex: Achat de craies, Facture électricité..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          
          <FormField label="Nature de la dépense (Compte à débiter)" required>
            <select value={expenseForm.debit_account_no} onChange={e => setExpenseForm({...expenseForm, debit_account_no: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {expenseAccounts.map(a => (
                <option key={a.id} value={a.account_number}>
                  {a.account_number} - {a.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Source de règlement (Compte à créditer / Moyen)" required>
            <select value={expenseForm.credit_account_no} onChange={e => setExpenseForm({...expenseForm, credit_account_no: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {treasuryAccounts.map(a => (
                <option key={a.id} value={a.account_number}>
                  {a.account_number} - {a.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Montant (F CFA)" required>
              <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </FormField>
            <FormField label="Catégorie">
              <input type="text" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} placeholder="Ex: Fournitures, entretien..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fournisseur">
              <input type="text" value={expenseForm.supplier} onChange={e => setExpenseForm({...expenseForm, supplier: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </FormField>
            <FormField label="N° Facture / Pièce">
              <input type="text" value={expenseForm.invoice_number} onChange={e => setExpenseForm({...expenseForm, invoice_number: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </FormField>
          </div>
        </div>
      </Modal>

      <Modal isOpen={entryModal} onClose={() => setEntryModal(false)} title="Nouvelle écriture générale (Journal double entrée)" size="md"
        actions={<>
          <button onClick={() => setEntryModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveEntry} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">Valider l'écriture</button>
        </>}>
        <div className="space-y-4">
          <div className="rounded-[16px] border border-blue-100 bg-blue-50/50 p-3 text-[11px] text-blue-700 leading-relaxed">
            💡 <strong>Comptabilité d'engagement</strong> : Cette fenêtre vous permet de passer des écritures comptables générales équilibrées. En sélectionnant un compte à débiter et un compte à créditer, le logiciel crée automatiquement la double-écriture correspondante.
          </div>

          <FormField label="Compte à Débiter (+ Actif / + Charge)" required>
            <select value={entryForm.debit_account_id} onChange={e => setEntryForm({...entryForm, debit_account_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner le compte de débit</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
            </select>
          </FormField>

          <FormField label="Compte à Créditer (+ Passif / + Recette)" required>
            <select value={entryForm.credit_account_id} onChange={e => setEntryForm({...entryForm, credit_account_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Sélectionner le compte de crédit</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
            </select>
          </FormField>

          <FormField label="Montant de l'opération (F CFA)" required>
            <input type="number" value={entryForm.amount} onChange={e => setEntryForm({...entryForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>

          <FormField label="Libellé / Objet de la transaction" required>
            <input type="text" value={entryForm.description} onChange={e => setEntryForm({...entryForm, description: e.target.value})} placeholder="Ex: Constat de créance, virement interne..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>

          <FormField label="Référence / N° de pièce">
            <input type="text" value={entryForm.reference} onChange={e => setEntryForm({...entryForm, reference: e.target.value})} placeholder="Ex: CHQ-829, VIR-89320" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
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
