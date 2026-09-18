import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Expense, AccountingAccount, AccountingEntry } from '../../types';
import { Calculator, Plus, TrendingUp, TrendingDown, FileText, Printer, BookOpen, Scale, PieChart, CheckCircle2, AlertCircle } from 'lucide-react';
import { createDoubleEntry, createCashTransaction } from '../../lib/accountingSync';
import { buildTrialBalanceHtml, openPrintPreview } from '../../lib/printableDocuments';

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  min_threshold: number;
  unit_price: number;
};

export default function AccountingPage() {
  const { school, academicYear } = useApp();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expenses' | 'entries' | 'balance' | 'ledger' | 'profit_loss' | 'plan' | 'inventory'>('expenses');
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [expenseModal, setExpenseModal] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
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
  const [accountForm, setAccountForm] = useState({
    account_number: '',
    name: '',
    account_type: 'asset' as 'asset' | 'liability' | 'revenue' | 'expense',
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

  async function handleSaveAccount() {
    if (!accountForm.account_number || !accountForm.name) {
      alert("Veuillez remplir les champs obligatoires (N° Compte, Intitulé).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('accounting_accounts').insert({
        ...accountForm,
        school_id: school!.id,
      });

      if (error) throw error;

      // Reset form
      setAccountForm({
        account_number: '',
        name: '',
        account_type: 'asset',
      });
    } catch (e: any) {
      console.error("Failed to save account", e);
      alert(`Erreur lors de l'enregistrement du compte : ${e.message}`);
    }
    setSaving(false);
    setAccountModal(false);
    fetchData();
  }

  const DEFAULT_SYSCOHADA_ACCOUNTS = [
    { account_number: '101000', name: 'Capital Social', account_type: 'liability' },
    { account_number: '411100', name: 'Élèves / Parents (Créances scolarité)', account_type: 'asset' },
    { account_number: '421100', name: 'Personnel Enseignant (Salaires dus)', account_type: 'liability' },
    { account_number: '421200', name: 'Personnel Administratif (Salaires dus)', account_type: 'liability' },
    { account_number: '521100', name: 'Banque (Compte Courant)', account_type: 'asset' },
    { account_number: '571100', name: 'Caisse École', account_type: 'asset' },
    { account_number: '605100', name: 'Achats de fournitures scolaires', account_type: 'expense' },
    { account_number: '611000', name: 'Transports du personnel', account_type: 'expense' },
    { account_number: '625000', name: 'Frais d\'entretien et réparations', account_type: 'expense' },
    { account_number: '661100', name: 'Rémunérations brutes du personnel', account_type: 'expense' },
    { account_number: '664000', name: 'Charges sociales (CNPS part patronale)', account_type: 'expense' },
    { account_number: '706100', name: 'Recettes - Droits de scolarité', account_type: 'revenue' },
    { account_number: '706200', name: 'Recettes - Droits d\'inscription', account_type: 'revenue' },
    { account_number: '707100', name: 'Recettes - Tissu, Tenues & Sport', account_type: 'revenue' },
    { account_number: '707200', name: 'Recettes - Macarons & divers', account_type: 'revenue' },
    { account_number: '708200', name: 'Recettes - Cantine scolaire', account_type: 'revenue' }
  ];

  async function handleSeedDefaultAccounts() {
    if (!school) return;
    setSaving(true);
    try {
      const payload = DEFAULT_SYSCOHADA_ACCOUNTS.map(acc => ({
        ...acc,
        school_id: school.id,
      }));
      const { error } = await supabase.from('accounting_accounts').insert(payload);
      if (error) throw error;
      alert("Plan comptable par défaut initialisé avec succès !");
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert(`Erreur d'initialisation : ${e.message}`);
    } finally {
      setSaving(false);
    }
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

  // Compute Trial Balance (Balance générale)
  const trialBalanceRows = accounts.map(acc => {
    const accEntries = entries.filter(e => e.account_id === acc.id);
    const totalDebit = accEntries.reduce((s, e) => s + Number(e.debit || 0), 0);
    const totalCredit = accEntries.reduce((s, e) => s + Number(e.credit || 0), 0);
    const net = totalDebit - totalCredit;
    return {
      id: acc.id,
      account_number: acc.account_number,
      name: acc.name,
      account_type: acc.account_type,
      total_debit: totalDebit,
      total_credit: totalCredit,
      debit_balance: net > 0 ? net : 0,
      credit_balance: net < 0 ? Math.abs(net) : 0,
    };
  }).sort((a, b) => a.account_number.localeCompare(b.account_number));

  const grandTotalDebit = trialBalanceRows.reduce((s, r) => s + r.total_debit, 0);
  const grandTotalCredit = trialBalanceRows.reduce((s, r) => s + r.total_credit, 0);
  const grandDebitBalance = trialBalanceRows.reduce((s, r) => s + r.debit_balance, 0);
  const grandCreditBalance = trialBalanceRows.reduce((s, r) => s + r.credit_balance, 0);
  const isBalanceBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

  // Compute Profit & Loss (Compte de résultat)
  const revenueRows = trialBalanceRows.filter(r => r.account_type === 'revenue' || r.account_number.startsWith('7'));
  const expenseRows = trialBalanceRows.filter(r => r.account_type === 'expense' || r.account_number.startsWith('6'));

  const totalRevenues = revenueRows.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
  const totalCharges = expenseRows.reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
  const netResult = totalRevenues - totalCharges;

  // Selected General Ledger Account entries
  const currentLedgerAccount = accounts.find(a => a.id === selectedLedgerAccountId) || accounts[0];
  const ledgerEntriesRaw = entries.filter(e => e.account_id === currentLedgerAccount?.id);
  
  let runningBal = 0;
  const ledgerEntriesWithBalance = ledgerEntriesRaw.slice().reverse().map(e => {
    runningBal += (Number(e.debit || 0) - Number(e.credit || 0));
    return {
      ...e,
      running_balance: runningBal,
    };
  }).reverse();

  function handlePrintTrialBalance() {
    if (!school) return;
    const html = buildTrialBalanceHtml({
      school,
      academicYearName: academicYear?.name || '2026-2027',
      rows: trialBalanceRows,
    });
    openPrintPreview(html);
  }

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
    { key: 'balance', label: 'Balance des Comptes' },
    { key: 'ledger', label: 'Grand Livre' },
    { key: 'profit_loss', label: 'Compte de Résultat' },
    { key: 'plan', label: 'Plan comptable' },
    { key: 'inventory', label: 'Stock & Inventaire' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Gestion comptable et financière (Conforme SYSCOHADA)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAccountModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
            <Plus size={18} /> Compte
          </button>
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

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'text-blue-600 border-blue-600 font-semibold' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && <DataTable columns={expenseColumns} data={expenses as any[]} searchKeys={['description', 'category', 'supplier']} searchPlaceholder="Rechercher une dépense..." loading={loading} />}
      {tab === 'entries' && <DataTable columns={entryColumns} data={entries as any[]} searchKeys={['entry_number', 'description']} searchPlaceholder="Rechercher une écriture..." loading={loading} />}
      
      {/* BALANCE GÉNÉRALE TAB */}
      {tab === 'balance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <Scale className="text-blue-600 h-6 w-6" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Balance Générale à 6 Colonnes</h3>
                <p className="text-xs text-slate-500">Bilan des mouvements et soldes des comptes du plan comptable</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${isBalanceBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {isBalanceBalanced ? '🟢 Balance Équilibrée' : '⚠️ Déséquilibre Detected'}
              </span>
              <button
                onClick={handlePrintTrialBalance}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
              >
                <Printer size={14} /> Imprimer Balance
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="py-3 px-4 border-b border-slate-200">N° Compte</th>
                  <th className="py-3 px-4 border-b border-slate-200">Intitulé</th>
                  <th className="py-3 px-4 border-b border-slate-200 text-right">Cumul Débit</th>
                  <th className="py-3 px-4 border-b border-slate-200 text-right">Cumul Crédit</th>
                  <th className="py-3 px-4 border-b border-slate-200 text-right">Solde Débiteur</th>
                  <th className="py-3 px-4 border-b border-slate-200 text-right">Solde Créditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {trialBalanceRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{row.account_number}</td>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{row.total_debit > 0 ? formatCurrency(row.total_debit) : '-'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{row.total_credit > 0 ? formatCurrency(row.total_credit) : '-'}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-blue-700">{row.debit_balance > 0 ? formatCurrency(row.debit_balance) : '-'}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{row.credit_balance > 0 ? formatCurrency(row.credit_balance) : '-'}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/80 font-bold text-slate-900 border-t-2 border-blue-600 text-sm">
                  <td colSpan={2} className="py-3 px-4 font-sans text-right font-bold">TOTAUX GÉNÉRAUX :</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(grandTotalDebit)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(grandTotalCredit)}</td>
                  <td className="py-3 px-4 text-right font-mono text-blue-800">{formatCurrency(grandDebitBalance)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">{formatCurrency(grandCreditBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRAND LIVRE TAB */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <BookOpen className="text-teal-600 h-6 w-6" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Grand Livre des Comptes</h3>
                <p className="text-xs text-slate-500">Extrait d'historique et suivi du solde de chaque compte</p>
              </div>
            </div>

            <div className="w-full sm:w-80">
              <select
                value={selectedLedgerAccountId || currentLedgerAccount?.id || ''}
                onChange={e => setSelectedLedgerAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold focus:border-teal-500 focus:outline-none"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentLedgerAccount && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase">
                    Compte N° {currentLedgerAccount.account_number}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900 mt-1">{currentLedgerAccount.name}</h4>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Solde Actuel du Compte</p>
                  <p className={`text-xl font-bold font-mono ${runningBal >= 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {formatCurrency(Math.abs(runningBal))} {runningBal >= 0 ? '(Débiteur)' : '(Créditeur)'}
                  </p>
                </div>
              </div>

              {ledgerEntriesWithBalance.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Aucune écriture enregistrée sur ce compte comptable.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700 border-collapse">
                    <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3 border-b border-slate-200">Date</th>
                        <th className="py-2.5 px-3 border-b border-slate-200">N° Écriture</th>
                        <th className="py-2.5 px-3 border-b border-slate-200">Libellé</th>
                        <th className="py-2.5 px-3 border-b border-slate-200">Référence</th>
                        <th className="py-2.5 px-3 border-b border-slate-200 text-right">Débit</th>
                        <th className="py-2.5 px-3 border-b border-slate-200 text-right">Crédit</th>
                        <th className="py-2.5 px-3 border-b border-slate-200 text-right">Solde Cumulé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {ledgerEntriesWithBalance.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-sans text-xs text-slate-600">{formatDate(e.entry_date)}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{e.entry_number}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-900">{e.description}</td>
                          <td className="py-2 px-3 text-slate-500">{e.reference || '-'}</td>
                          <td className="py-2 px-3 text-right text-blue-600 font-bold">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-bold">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                          <td className="py-2 px-3 text-right text-slate-900 font-bold bg-slate-50/50">{formatCurrency(e.running_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPTE DE RÉSULTAT TAB */}
      {tab === 'profit_loss' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-purple-50/60 rounded-2xl border border-purple-200">
            <div className="flex items-center gap-3">
              <PieChart className="text-purple-700 h-6 w-6" />
              <div>
                <h3 className="font-bold text-purple-950 text-base">Compte de Résultat Simplifié (P&L)</h3>
                <p className="text-xs text-purple-700">Synthese des Produits (Recettes) vs Charges (Dépenses)</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-purple-700 uppercase">Résultat Net d'Exercice</span>
              <p className={`text-2xl font-black font-mono ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {netResult >= 0 ? `+${formatCurrency(netResult)}` : `-${formatCurrency(Math.abs(netResult))}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PRODUITS (REVENUES) */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-200 pb-3">
                <h4 className="font-bold text-emerald-900 text-base flex items-center gap-2">
                  <TrendingUp className="text-emerald-600 h-5 w-5" /> Produits (Classe 7)
                </h4>
                <span className="font-bold font-mono text-emerald-800 text-lg">{formatCurrency(totalRevenues)}</span>
              </div>

              {revenueRows.length === 0 ? (
                <p className="text-xs text-emerald-700 italic">Aucune recette enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {revenueRows.map(r => (
                    <div key={r.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-white border border-emerald-100">
                      <div>
                        <span className="font-mono font-bold text-emerald-700">{r.account_number}</span>
                        <p className="font-medium text-slate-800">{r.name}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(r.total_credit - r.total_debit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CHARGES (EXPENSES) */}
            <div className="rounded-2xl border border-red-200 bg-red-50/30 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-red-200 pb-3">
                <h4 className="font-bold text-red-900 text-base flex items-center gap-2">
                  <TrendingDown className="text-red-600 h-5 w-5" /> Charges (Classe 6)
                </h4>
                <span className="font-bold font-mono text-red-800 text-lg">{formatCurrency(totalCharges)}</span>
              </div>

              {expenseRows.length === 0 ? (
                <p className="text-xs text-red-700 italic">Aucune charge enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {expenseRows.map(r => (
                    <div key={r.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-white border border-red-100">
                      <div>
                        <span className="font-mono font-bold text-red-700">{r.account_number}</span>
                        <p className="font-medium text-slate-800">{r.name}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(r.total_debit - r.total_credit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'plan' && (
        accounts.length === 0 && !loading ? (
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/50 p-6 text-center space-y-4">
            <h3 className="display-font text-lg font-semibold text-blue-900">Plan comptable non configuré</h3>
            <p className="text-sm text-blue-700 max-w-md mx-auto">
              Votre établissement n'a pas encore configuré son plan comptable. Vous pouvez l'initialiser en un clic avec les comptes standards de la comptabilité scolaire (SYSCOHADA).
            </p>
            <button
              onClick={handleSeedDefaultAccounts}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
            >
              Initialiser le plan comptable scolaire
            </button>
          </div>
        ) : (
          <DataTable columns={accountColumns} data={accounts as any[]} searchKeys={['account_number', 'name']} searchPlaceholder="Rechercher un compte..." loading={loading} />
        )
      )}
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

      <Modal isOpen={accountModal} onClose={() => setAccountModal(false)} title="Créer un nouveau compte comptable" size="md"
        actions={<>
          <button onClick={() => setAccountModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSaveAccount} disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">Créer le compte</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Numéro de compte (ex: 521100, 605100)" required>
            <input type="text" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} placeholder="Code du compte" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Intitulé du compte (Nom)" required>
            <input type="text" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} placeholder="Ex: Banque BNI, Achat de manuels..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </FormField>
          <FormField label="Type de compte (Classification)" required>
            <select value={accountForm.account_type} onChange={e => setAccountForm({...accountForm, account_type: e.target.value as any})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="asset">Actif (Trésorerie active, créances...)</option>
              <option value="liability">Passif (Capital, dettes fournisseurs...)</option>
              <option value="expense">Dépense / Charge (Achats, salaires payés...)</option>
              <option value="revenue">Recette / Produit (Frais de scolarité encaissés...)</option>
            </select>
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
