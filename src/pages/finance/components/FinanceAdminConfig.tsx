import { useEffect, useState, useMemo } from 'react';
import FormField from '../../../components/common/FormField';
import { formatCurrency } from '../../../lib/utils';
import { Check, Edit, Plus, Save, Settings, Trash2 } from 'lucide-react';
import type { Level } from '../../../types';
import type { PaymentPlanInput } from '../../../hooks/useFinance';

interface FinanceAdminConfigProps {
  plans: any[];
  levels: Level[];
  onSavePlan: (plan: PaymentPlanInput, planId?: string) => Promise<void>;
  saving: boolean;
}

const DEFAULT_MATERNELLE_PLAN: PaymentPlanInput = {
  name: 'Maternelle',
  total_amount: 110000,
  canteen_monthly: 7000,
  canteen_quarterly: 21000,
  canteen_annual: 56000,
  levels: [],
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 30000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Fournitures scolaires', amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 10000 },
    { item_name: 'Tenue de sport', amount: 7000 },
    { item_name: 'Macaron', amount: 3000 },
  ],
};

const DEFAULT_PRIMAIRE_PLAN: PaymentPlanInput = {
  name: 'Primaire (CP1 à CM1)',
  total_amount: 105000,
  canteen_monthly: 8000,
  canteen_quarterly: 24000,
  canteen_annual: 64000,
  levels: [],
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 25000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 15000 },
    { item_name: 'Tenue de sport', amount: 15000 },
    { item_name: 'Macaron', amount: 5000 },
  ],
};

const DEFAULT_CM2_PLAN: PaymentPlanInput = {
  name: 'CM2',
  total_amount: 110000,
  canteen_monthly: 8000,
  canteen_quarterly: 24000,
  canteen_annual: 64000,
  levels: [],
  schedule: [
    { installment_number: 1, label: 'Premier versement', amount: 50000, due_date: '2026-09-07' },
    { installment_number: 2, label: 'Deuxième versement', amount: 30000, due_date: '2026-10-05' },
    { installment_number: 3, label: 'Troisième versement', amount: 30000, due_date: '2026-11-02' },
  ],
  composition: [
    { item_name: "Frais d'inscription", amount: 15000 },
    { item_name: 'Tissu du lundi', amount: 15000 },
    { item_name: 'Tenue de sport', amount: 15000 },
    { item_name: 'Macaron', amount: 5000 },
    { item_name: 'Droit d\'examen', amount: 3000 },
  ],
};

export default function FinanceAdminConfig({
  plans = [],
  levels = [],
  onSavePlan,
  saving,
}: FinanceAdminConfigProps) {
  const [activePlanTab, setActivePlanTab] = useState<'maternelle' | 'primaire' | 'cm2'>('maternelle');
  const [form, setForm] = useState<PaymentPlanInput>(DEFAULT_MATERNELLE_PLAN);
  const [planId, setPlanId] = useState<string | undefined>(undefined);

  // Map database plans to tabs
  const matchedDbPlan = useMemo(() => {
    if (activePlanTab === 'maternelle') {
      return plans.find(p => p.name.toLowerCase().includes('maternelle'));
    } else if (activePlanTab === 'primaire') {
      return plans.find(p => p.name.toLowerCase().includes('primaire') || p.name.toLowerCase().includes('cp1'));
    } else {
      return plans.find(p => p.name.toLowerCase().includes('cm2'));
    }
  }, [plans, activePlanTab]);

  // Load selected plan config
  useEffect(() => {
    if (matchedDbPlan) {
      setForm({
        name: matchedDbPlan.name,
        total_amount: Number(matchedDbPlan.total_amount),
        canteen_monthly: Number(matchedDbPlan.canteen_monthly || 0),
        canteen_quarterly: Number(matchedDbPlan.canteen_quarterly || 0),
        canteen_annual: Number(matchedDbPlan.canteen_annual || 0),
        levels: matchedDbPlan.levels?.map((l: any) => l.level_id) || [],
        schedule: matchedDbPlan.schedule?.slice().sort((a: any, b: any) => a.installment_number - b.installment_number) || [],
        composition: matchedDbPlan.composition || [],
      });
      setPlanId(matchedDbPlan.id);
    } else {
      // Default templates
      let defaultTemplate = DEFAULT_MATERNELLE_PLAN;
      if (activePlanTab === 'primaire') defaultTemplate = DEFAULT_PRIMAIRE_PLAN;
      else if (activePlanTab === 'cm2') defaultTemplate = DEFAULT_CM2_PLAN;

      // Try to auto-map levels based on name matches
      const defaultLevels = levels
        .filter(l => {
          const lName = l.name.toLowerCase();
          if (activePlanTab === 'maternelle') return lName.includes('maternelle');
          if (activePlanTab === 'cm2') return lName.includes('cm2');
          return (
            lName.includes('cp') ||
            lName.includes('ce') ||
            lName.includes('cm1')
          );
        })
        .map(l => l.id);

      setForm({
        ...defaultTemplate,
        levels: defaultLevels,
      });
      setPlanId(undefined);
    }
  }, [matchedDbPlan, activePlanTab, levels]);

  function handleFieldChange(key: keyof PaymentPlanInput, value: any) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function handleScheduleChange(index: number, key: string, value: any) {
    const updated = [...form.schedule];
    updated[index] = { ...updated[index], [key]: value };
    handleFieldChange('schedule', updated);
  }

  function handleCompositionChange(index: number, key: string, value: any) {
    const updated = [...form.composition];
    updated[index] = { ...updated[index], [key]: value };
    handleFieldChange('composition', updated);
  }

  function addCompositionItem() {
    const updated = [...form.composition, { item_name: 'Frais divers', amount: 0 }];
    handleFieldChange('composition', updated);
  }

  function removeCompositionItem(index: number) {
    const updated = [...form.composition];
    updated.splice(index, 1);
    handleFieldChange('composition', updated);
  }

  function handleLevelToggle(levelId: string) {
    const activeLevels = [...form.levels];
    const index = activeLevels.indexOf(levelId);
    if (index > -1) activeLevels.splice(index, 1);
    else activeLevels.push(levelId);
    handleFieldChange('levels', activeLevels);
  }

  async function handleSubmit() {
    // Basic verification: composition sum must match 1st installment
    const totalComposition = form.composition.reduce((s, c) => s + Number(c.amount), 0);
    const firstInstallment = form.schedule.find(s => s.installment_number === 1)?.amount || 0;

    if (totalComposition !== firstInstallment) {
      alert(
        `Erreur de validation : Le total de la ventilation du premier versement (${formatCurrency(
          totalComposition
        )}) doit être exactement égal au montant fixé pour le premier versement scolarité (${formatCurrency(
          firstInstallment
        )}).`
      );
      return;
    }

    // Verify total tuition matches tranches sum
    const totalTranches = form.schedule.reduce((s, t) => s + Number(t.amount), 0);
    if (totalTranches !== form.total_amount) {
      alert(
        `Erreur de validation : La somme des tranches (${formatCurrency(
          totalTranches
        )}) doit être égale au montant total annuel de la scolarité (${formatCurrency(
          form.total_amount
        )}).`
      );
      return;
    }

    try {
      await onSavePlan(form, planId);
      alert('Plan de paiement sauvegardé avec succès !');
    } catch (e: any) {
      alert(`Erreur lors de la sauvegarde : ${e.message}`);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Configuration des Tarifs</h2>
          <p className="text-sm text-slate-500">
            Ajustez les montants annuels, les échéances et les tarifs de cantine.
          </p>
        </div>
        <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-xl font-medium text-slate-500 flex items-center gap-1.5">
          <Settings size={14} /> Administration
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActivePlanTab('maternelle')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activePlanTab === 'maternelle'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Maternelle
        </button>
        <button
          onClick={() => setActivePlanTab('primaire')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activePlanTab === 'primaire'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Primaire (CP1 - CM1)
        </button>
        <button
          onClick={() => setActivePlanTab('cm2')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activePlanTab === 'cm2'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          CM2
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Scolarité & Cantine Configuration */}
          <div className="surface-card p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">1. Frais de Scolarité & Cantine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nom du Plan">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                />
              </FormField>
              <FormField label="Scolarité Totale Annuelle (FCFA)">
                <input
                  type="number"
                  value={form.total_amount}
                  onChange={e => handleFieldChange('total_amount', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                />
              </FormField>
              <FormField label="Cantine Mensuelle (FCFA, Informatique)">
                <input
                  type="number"
                  value={form.canteen_monthly}
                  onChange={e => handleFieldChange('canteen_monthly', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                />
              </FormField>
              <FormField label="Cantine Trimestrielle (FCFA, Exigible)">
                <input
                  type="number"
                  value={form.canteen_quarterly}
                  onChange={e => handleFieldChange('canteen_quarterly', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Cantine Annuelle (FCFA, Informatique)">
                  <input
                    type="number"
                    value={form.canteen_annual}
                    onChange={e => handleFieldChange('canteen_annual', parseFloat(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="surface-card p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">2. Échéances des Tranches</h3>
            <div className="space-y-4">
              {form.schedule.map((sch, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="sm:col-span-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Tranche {sch.installment_number}
                    </p>
                    <input
                      type="text"
                      value={sch.label}
                      onChange={e => handleScheduleChange(index, 'label', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Montant (FCFA)</span>
                    <input
                      type="number"
                      value={sch.amount}
                      onChange={e => handleScheduleChange(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Date d'échéance</span>
                    <input
                      type="date"
                      value={sch.due_date}
                      onChange={e => handleScheduleChange(index, 'due_date', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* First Installment Composition */}
          <div className="surface-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">3. Ventilation du 1er Versement</h3>
              <button
                type="button"
                onClick={addCompositionItem}
                className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-100 transition"
              >
                <Plus size={14} /> Ajouter un élément
              </button>
            </div>

            <div className="space-y-3">
              {form.composition.map((item, index) => (
                <div key={index} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Nom de l'élément (ex: Macaron)"
                      value={item.item_name}
                      onChange={e => handleCompositionChange(index, 'item_name', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="w-36">
                    <input
                      type="number"
                      placeholder="Frais (FCFA)"
                      value={item.amount}
                      onChange={e => handleCompositionChange(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompositionItem(index)}
                    className="rounded-xl p-2 text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assigned Levels selector */}
        <div className="space-y-6">
          <div className="surface-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">4. Niveaux assignés</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cochez les classes ou niveaux d'établissement associés à cette tarification.
            </p>
            <div className="space-y-2 border-t border-slate-100 pt-3 max-h-80 overflow-y-auto">
              {levels.map(level => {
                const isSelected = form.levels.includes(level.id);
                return (
                  <label
                    key={level.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-800 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleLevelToggle(level.id)}
                      className="hidden"
                    />
                    <div
                      className={`h-4 w-4 rounded-md border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={10} />}
                    </div>
                    {level.name}
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Sauvegarder la configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
