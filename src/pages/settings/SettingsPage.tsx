import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import EmptyState from '../../components/common/EmptyState';
import {
  PRIMARY_FEE_TYPE_PRESETS,
  PRIMARY_LEVEL_PRESETS,
  PRIMARY_SUBJECT_PRESETS,
  SCHOOL_ROLE_BLUEPRINTS,
  formatDate,
} from '../../lib/utils';
import {
  BookOpen,
  Coins,
  ImageIcon,
  Layers3,
  PencilLine,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  CalendarDays,
} from 'lucide-react';

type SettingsTab = 'school' | 'years' | 'levels' | 'subjects' | 'fees' | 'roles';
type LevelItem = { id: string; name: string; order_index: number };
type SubjectItem = { id: string; name: string; code: string; coefficient: number };
type FeeTypeItem = { id: string; name: string; description: string; is_recurring: boolean };
type AcademicYearItem = { id: string; name: string; start_date: string; end_date: string; active: boolean };
type YearFeeTemplateRow = { level_id: string; level_name: string; registration_amount: number; tuition_amount: number };

function normalizeFeeTypeName(value: string) {
  return value.trim().toLowerCase().replace(/[’`´]/g, '\'');
}

export default function SettingsPage() {
  const { school, refreshSchool, refreshAcademicYears } = useApp();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('school');
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    motto: '',
    logo_url: '',
    establishment_type: 'maternelle_primaire',
  });
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [yearFeeCounts, setYearFeeCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [schoolNotice, setSchoolNotice] = useState<string | null>(null);

  const [subjectModal, setSubjectModal] = useState(false);
  const [feeTypeModal, setFeeTypeModal] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [editingFeeType, setEditingFeeType] = useState<FeeTypeItem | null>(null);

  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', coefficient: 1 });
  const [feeTypeForm, setFeeTypeForm] = useState({ name: '', description: '', is_recurring: false });
  const [yearForm, setYearForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    active: true,
    registration_due_date: '',
    tuition_due_date: '',
  });
  const [yearFeeTemplates, setYearFeeTemplates] = useState<YearFeeTemplateRow[]>([]);

  const canManage = isAdmin || isSuperAdmin;
  const canCreateAcademicYear = canManage && levels.length > 0;

  useEffect(() => {
    if (!school) return;

    setSchoolForm({
      name: school.name,
      address: school.address,
      city: school.city,
      country: school.country,
      phone: school.phone,
      email: school.email,
      motto: school.motto,
      logo_url: school.logo_url,
      establishment_type: 'maternelle_primaire',
    });

    void Promise.all([
      fetchLevels(),
      fetchSubjects(),
      fetchFeeTypes(),
      fetchAcademicYearsData(),
    ]);
  }, [school]);

  useEffect(() => {
    setYearFeeTemplates(
      levels.map(level => ({
        level_id: level.id,
        level_name: level.name,
        registration_amount: 0,
        tuition_amount: 0,
      })),
    );
  }, [levels]);

  async function fetchLevels() {
    if (!school) return;
    const { data } = await supabase.from('levels').select('*').eq('school_id', school.id).order('order_index');
    setLevels((data as LevelItem[]) || []);
  }

  async function fetchSubjects() {
    if (!school) return;
    const { data } = await supabase.from('subjects').select('*').eq('school_id', school.id).order('name');
    setSubjects((data as SubjectItem[]) || []);
  }

  async function fetchFeeTypes() {
    if (!school) return;
    const { data } = await supabase.from('fee_types').select('*').eq('school_id', school.id).order('name');
    setFeeTypes((data as FeeTypeItem[]) || []);
  }

  async function fetchAcademicYearsData() {
    if (!school) return;
    const [yearRes, feeRes] = await Promise.all([
      supabase.from('academic_years').select('*').eq('school_id', school.id).order('start_date', { ascending: false }),
      supabase.from('fees').select('id, academic_year_id').eq('school_id', school.id),
    ]);

    const years = (yearRes.data as AcademicYearItem[]) || [];
    const counts: Record<string, number> = {};
    ((feeRes.data as Array<{ id: string; academic_year_id: string }>) || []).forEach(fee => {
      counts[fee.academic_year_id] = (counts[fee.academic_year_id] || 0) + 1;
    });

    setAcademicYears(years);
    setYearFeeCounts(counts);
  }

  async function saveSchool() {
    if (!school) return;
    setSaving(true);
    await supabase.from('schools').update({
      name: schoolForm.name,
      address: schoolForm.address,
      city: schoolForm.city,
      country: schoolForm.country,
      phone: schoolForm.phone,
      email: schoolForm.email,
      motto: schoolForm.motto,
      logo_url: schoolForm.logo_url,
      establishment_type: 'maternelle_primaire',
    }).eq('id', school.id);
    setSaving(false);
    await refreshSchool();
    setSchoolNotice('Informations de l’école enregistrées.');
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setSchoolNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/logo-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setSchoolForm(current => ({ ...current, logo_url: data.publicUrl }));
      await supabase.from('schools').update({ logo_url: data.publicUrl }).eq('id', school.id);
      await refreshSchool();
      setSchoolNotice('Logo mis à jour. Il sera utilisé dans les reçus et documents administratifs.');
    } catch (error) {
      setSchoolNotice("Le logo n'a pas pu être envoyé. Vérifie le bucket Supabase school-assets.");
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  }

  async function clearLogo() {
    if (!school) return;
    await supabase.from('schools').update({ logo_url: '' }).eq('id', school.id);
    setSchoolForm(current => ({ ...current, logo_url: '' }));
    await refreshSchool();
    setSchoolNotice('Logo supprimé.');
  }

  async function saveSubject() {
    if (!school) return;
    setSaving(true);

    if (editingSubject) {
      await supabase.from('subjects').update(subjectForm).eq('id', editingSubject.id);
    } else {
      await supabase.from('subjects').insert({ ...subjectForm, school_id: school.id });
    }

    setSaving(false);
    setSubjectModal(false);
    setEditingSubject(null);
    setSubjectForm({ name: '', code: '', coefficient: 1 });
    await fetchSubjects();
  }

  async function deleteSubject(subjectId: string) {
    if (!confirm('Supprimer cette matière ?')) return;
    await supabase.from('subjects').delete().eq('id', subjectId);
    await fetchSubjects();
  }

  async function saveFeeType() {
    if (!school) return;
    setSaving(true);

    if (editingFeeType) {
      await supabase.from('fee_types').update(feeTypeForm).eq('id', editingFeeType.id);
    } else {
      await supabase.from('fee_types').insert({ ...feeTypeForm, school_id: school.id });
    }

    setSaving(false);
    setFeeTypeModal(false);
    setEditingFeeType(null);
    setFeeTypeForm({ name: '', description: '', is_recurring: false });
    await fetchFeeTypes();
  }

  async function deleteFeeType(feeTypeId: string) {
    if (!confirm('Supprimer ce type de frais ?')) return;
    await supabase.from('fee_types').delete().eq('id', feeTypeId);
    await fetchFeeTypes();
  }

  async function applyPrimaryStructure() {
    if (!school) return;
    setSaving(true);

    const existingLevelNames = new Set(levels.map(level => level.name.toLowerCase()));
    const existingSubjectNames = new Set(subjects.map(subject => subject.name.toLowerCase()));
    const existingFeeTypeNames = new Set(feeTypes.map(feeType => feeType.name.toLowerCase()));

    const levelRows = PRIMARY_LEVEL_PRESETS.filter(level => !existingLevelNames.has(level.name.toLowerCase()))
      .map(level => ({ ...level, school_id: school.id }));
    const subjectRows = PRIMARY_SUBJECT_PRESETS.filter(subject => !existingSubjectNames.has(subject.name.toLowerCase()))
      .map(subject => ({ ...subject, school_id: school.id }));
    const feeTypeRows = PRIMARY_FEE_TYPE_PRESETS.filter(feeType => !existingFeeTypeNames.has(feeType.name.toLowerCase()))
      .map(feeType => ({ ...feeType, school_id: school.id }));

    await Promise.all([
      levelRows.length ? supabase.from('levels').insert(levelRows) : Promise.resolve(),
      subjectRows.length ? supabase.from('subjects').insert(subjectRows) : Promise.resolve(),
      feeTypeRows.length ? supabase.from('fee_types').insert(feeTypeRows) : Promise.resolve(),
    ]);

    setSaving(false);
    await Promise.all([fetchLevels(), fetchSubjects(), fetchFeeTypes()]);
  }

  async function removeLevel(levelId: string) {
    if (!confirm('Supprimer ce niveau et les classes associées ?')) return;
    await supabase.from('levels').delete().eq('id', levelId);
    await fetchLevels();
  }

  async function ensureCoreFeeType(name: string, description: string, isRecurring: boolean) {
    if (!school) return null;

    const existing = feeTypes.find(feeType => normalizeFeeTypeName(feeType.name) === normalizeFeeTypeName(name));
    if (existing) return existing.id;

    const { data } = await supabase
      .from('fee_types')
      .insert({
        school_id: school.id,
        name,
        description,
        is_recurring: isRecurring,
      })
      .select('id')
      .single();

    await fetchFeeTypes();
    return data?.id || null;
  }

  async function createAcademicYearWithFees() {
    if (!school) return;
    setSaving(true);

    if (yearForm.active) {
      await supabase.from('academic_years').update({ active: false }).eq('school_id', school.id);
    }

    const { data: createdYear, error } = await supabase
      .from('academic_years')
      .insert({
        school_id: school.id,
        name: yearForm.name,
        start_date: yearForm.start_date,
        end_date: yearForm.end_date,
        active: yearForm.active,
      })
      .select('*')
      .single();

    if (!error && createdYear) {
      const registrationTypeId = await ensureCoreFeeType('Frais d\'inscription', 'Paiement unique à l\'entrée', false);
      const tuitionTypeId = await ensureCoreFeeType('Frais de scolarité', 'Paiement principal de l’année académique', true);

      const registrationDueDate = yearForm.registration_due_date || yearForm.start_date;
      const tuitionDueDate = yearForm.tuition_due_date || yearForm.start_date;

      const feeRows = yearFeeTemplates.flatMap(template => {
        const rows = [];

        if (template.registration_amount > 0 && registrationTypeId) {
          rows.push({
            school_id: school.id,
            fee_type_id: registrationTypeId,
            academic_year_id: createdYear.id,
            level_id: template.level_id,
            amount: template.registration_amount,
            due_date: registrationDueDate,
            description: `Frais d’inscription ${createdYear.name} - ${template.level_name}`,
          });
        }

        if (template.tuition_amount > 0 && tuitionTypeId) {
          rows.push({
            school_id: school.id,
            fee_type_id: tuitionTypeId,
            academic_year_id: createdYear.id,
            level_id: template.level_id,
            amount: template.tuition_amount,
            due_date: tuitionDueDate,
            description: `Frais de scolarité ${createdYear.name} - ${template.level_name}`,
          });
        }

        return rows;
      });

      if (feeRows.length > 0) {
        await supabase.from('fees').insert(feeRows);
      }
    }

    setSaving(false);
    setYearModal(false);
    setYearForm({
      name: '',
      start_date: '',
      end_date: '',
      active: true,
      registration_due_date: '',
      tuition_due_date: '',
    });
    setYearFeeTemplates(
      levels.map(level => ({
        level_id: level.id,
        level_name: level.name,
        registration_amount: 0,
        tuition_amount: 0,
      })),
    );
    await Promise.all([fetchAcademicYearsData(), refreshAcademicYears()]);
  }

  function openYearModal() {
    setYearModal(true);
    setYearForm({
      name: '',
      start_date: '',
      end_date: '',
      active: true,
      registration_due_date: '',
      tuition_due_date: '',
    });
    setYearFeeTemplates(
      levels.map(level => ({
        level_id: level.id,
        level_name: level.name,
        registration_amount: 0,
        tuition_amount: 0,
      })),
    );
  }

  const availableLevels = useMemo(
    () => PRIMARY_LEVEL_PRESETS.filter(primaryLevel => !levels.some(level => level.name === primaryLevel.name)),
    [levels],
  );

  async function addPrimaryLevel(levelName: string) {
    if (!school) return;
    const preset = PRIMARY_LEVEL_PRESETS.find(level => level.name === levelName);
    if (!preset) return;
    await supabase.from('levels').insert({ ...preset, school_id: school.id });
    await fetchLevels();
  }

  const tabs = [
    { key: 'school', label: 'École', icon: ImageIcon },
    { key: 'years', label: 'Années', icon: CalendarDays },
    { key: 'levels', label: 'Niveaux', icon: Layers3 },
    { key: 'subjects', label: 'Matières', icon: BookOpen },
    { key: 'fees', label: 'Frais', icon: Coins },
    { key: 'roles', label: 'Accès', icon: ShieldCheck },
  ];

  if (!school) {
    return (
      <EmptyState
        icon={<Settings size={40} />}
        title="Configuration indisponible"
        description="L’établissement doit être chargé avant de personnaliser les niveaux, les frais et le logo."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles size={14} /> Refonte maternelle & primaire
            </span>
            <div>
              <h1 className="display-font text-3xl font-semibold text-slate-900">Pilotage de l’école</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                L’espace de configuration est maintenant centré sur une école de la Petite Section au CM2,
                avec logo institutionnel, années académiques prêtes à l’emploi et frais configurables dès la création.
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Structure recommandée</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/85 p-3">
                <p className="text-xl font-bold text-slate-900">{PRIMARY_LEVEL_PRESETS.length}</p>
                <p className="text-xs text-slate-500">Niveaux PS→CM2</p>
              </div>
              <div className="rounded-2xl bg-white/85 p-3">
                <p className="text-xl font-bold text-slate-900">{PRIMARY_SUBJECT_PRESETS.length}</p>
                <p className="text-xs text-slate-500">Matières</p>
              </div>
              <div className="rounded-2xl bg-white/85 p-3">
                <p className="text-xl font-bold text-slate-900">{PRIMARY_FEE_TYPE_PRESETS.length}</p>
                <p className="text-xs text-slate-500">Types de frais</p>
              </div>
            </div>
            <button
              onClick={() => void applyPrimaryStructure()}
              disabled={saving || !canManage}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={16} /> Préconfigurer l’école primaire
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as SettingsTab)}
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              tab === item.key
                ? 'bg-slate-900 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]'
                : 'bg-white/75 text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'school' && (
        <div className="surface-card p-6">
          <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Identité visuelle et administrative</h2>
              <p className="mt-1 text-sm text-slate-500">Le logo sera utilisé dans les reçus de paiement et les documents administratifs.</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-center">
              {schoolForm.logo_url ? (
                <img src={schoolForm.logo_url} alt={schoolForm.name} className="mx-auto h-24 w-24 rounded-3xl border border-slate-200 bg-white object-cover" />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-slate-400">
                  <ImageIcon size={28} />
                </div>
              )}
              <div className="mt-3 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">
                  <Upload size={16} />
                  {uploadingLogo ? 'Envoi...' : 'Uploader le logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {schoolForm.logo_url && (
                  <button onClick={() => void clearLogo()} className="block w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
                    Retirer le logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {schoolNotice && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {schoolNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Nom de l’école" required>
              <input type="text" value={schoolForm.name} onChange={event => setSchoolForm({ ...schoolForm, name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Cycle couvert">
              <input type="text" value="Petite Section à CM2" disabled className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500" />
            </FormField>
            <FormField label="Téléphone">
              <input type="tel" value={schoolForm.phone} onChange={event => setSchoolForm({ ...schoolForm, phone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={schoolForm.email} onChange={event => setSchoolForm({ ...schoolForm, email: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Ville">
              <input type="text" value={schoolForm.city} onChange={event => setSchoolForm({ ...schoolForm, city: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <FormField label="Pays">
              <input type="text" value={schoolForm.country} onChange={event => setSchoolForm({ ...schoolForm, country: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Adresse">
                <input type="text" value={schoolForm.address} onChange={event => setSchoolForm({ ...schoolForm, address: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Devise / signature">
                <textarea value={schoolForm.motto} onChange={event => setSchoolForm({ ...schoolForm, motto: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
              </FormField>
            </div>
          </div>

          <button onClick={() => void saveSchool()} disabled={saving || !canManage} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={16} /> Enregistrer
          </button>
        </div>
      )}

      {tab === 'years' && (
        <div className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Années académiques</h2>
              <p className="mt-1 text-sm text-slate-500">Crée une année et configure immédiatement les frais d’inscription et de scolarité par niveau.</p>
            </div>
            <button onClick={openYearModal} disabled={!canCreateAcademicYear} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} /> Nouvelle année académique
            </button>
          </div>

          {levels.length === 0 && (
            <div className="mb-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Commence d'abord par préconfigurer les niveaux PS à CM2 pour pouvoir créer une année académique avec ses frais.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {academicYears.map(year => (
              <div key={year.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      year.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {year.active ? 'Année active' : 'Archive'}
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">{year.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(year.start_date)} → {formatDate(year.end_date)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-slate-900">{yearFeeCounts[year.id] || 0}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Frais</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'levels' && (
        <div className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Niveaux autorisés</h2>
              <p className="mt-1 text-sm text-slate-500">L’école est maintenant limitée aux niveaux de la Petite Section au CM2.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {levels.map(level => (
              <div key={level.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Ordre {level.order_index}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{level.name}</h3>
                  </div>
                  <button onClick={() => void removeLevel(level.id)} className="rounded-full p-2 text-red-500 transition hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {availableLevels.length > 0 && (
            <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Ajouter un niveau primaire manquant</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableLevels.map(level => (
                  <button key={level.name} onClick={() => void addPrimaryLevel(level.name)} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                    {level.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Matières et domaines</h2>
              <p className="mt-1 text-sm text-slate-500">Maternelle, fondamentaux, ateliers et enseignements du primaire.</p>
            </div>
            <button onClick={() => setSubjectModal(true)} disabled={!canManage} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} /> Ajouter une matière
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map(subject => (
              <div key={subject.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {subject.code || 'Sans code'}
                    </p>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{subject.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">Coefficient {subject.coefficient}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingSubject(subject); setSubjectForm({ name: subject.name, code: subject.code, coefficient: subject.coefficient }); setSubjectModal(true); }} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
                      <PencilLine size={14} />
                    </button>
                    <button onClick={() => void deleteSubject(subject.id)} disabled={!canManage} className="rounded-full p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="surface-card p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Types de frais</h2>
              <p className="mt-1 text-sm text-slate-500">Inscription, scolarité, cantine, transport et autres frais récurrents ou ponctuels.</p>
            </div>
            <button onClick={() => setFeeTypeModal(true)} disabled={!canManage} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} /> Ajouter un type de frais
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {feeTypes.map(feeType => (
              <div key={feeType.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      feeType.is_recurring ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {feeType.is_recurring ? 'Récurrent' : 'Ponctuel'}
                    </p>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{feeType.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{feeType.description || 'Sans description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingFeeType(feeType); setFeeTypeForm({ name: feeType.name, description: feeType.description, is_recurring: feeType.is_recurring }); setFeeTypeModal(true); }} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
                      <PencilLine size={14} />
                    </button>
                    <button onClick={() => void deleteFeeType(feeType.id)} disabled={!canManage} className="rounded-full p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          {SCHOOL_ROLE_BLUEPRINTS.map(roleBlueprint => (
            <div key={roleBlueprint.title} className="surface-card p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="display-font text-xl font-semibold text-slate-900">{roleBlueprint.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{roleBlueprint.note}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roleBlueprint.access.map(accessItem => (
                    <div key={accessItem} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
                      {accessItem}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={subjectModal}
        onClose={() => {
          setSubjectModal(false);
          setEditingSubject(null);
          setSubjectForm({ name: '', code: '', coefficient: 1 });
        }}
        title={editingSubject ? 'Modifier la matière' : 'Nouvelle matière'}
        size="sm"
        actions={
          <>
            <button onClick={() => setSubjectModal(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void saveSubject()} disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nom" required>
            <input type="text" value={subjectForm.name} onChange={event => setSubjectForm({ ...subjectForm, name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Code">
            <input type="text" value={subjectForm.code} onChange={event => setSubjectForm({ ...subjectForm, code: event.target.value.toUpperCase() })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Coefficient">
            <input type="number" value={subjectForm.coefficient} onChange={event => setSubjectForm({ ...subjectForm, coefficient: parseInt(event.target.value, 10) || 1 })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
        </div>
      </Modal>

      <Modal
        isOpen={feeTypeModal}
        onClose={() => {
          setFeeTypeModal(false);
          setEditingFeeType(null);
          setFeeTypeForm({ name: '', description: '', is_recurring: false });
        }}
        title={editingFeeType ? 'Modifier le type de frais' : 'Nouveau type de frais'}
        size="sm"
        actions={
          <>
            <button onClick={() => setFeeTypeModal(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void saveFeeType()} disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Enregistrer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nom" required>
            <input type="text" value={feeTypeForm.name} onChange={event => setFeeTypeForm({ ...feeTypeForm, name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Description">
            <textarea value={feeTypeForm.description} onChange={event => setFeeTypeForm({ ...feeTypeForm, description: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={feeTypeForm.is_recurring} onChange={event => setFeeTypeForm({ ...feeTypeForm, is_recurring: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Ce frais revient régulièrement
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={yearModal}
        onClose={() => setYearModal(false)}
        title="Nouvelle année académique"
        size="xl"
        actions={
          <>
            <button onClick={() => setYearModal(false)} className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100">
              Annuler
            </button>
            <button onClick={() => void createAcademicYearWithFees()} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Créer l’année et les frais
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Nom de l’année" required>
              <input type="text" value={yearForm.name} onChange={event => setYearForm({ ...yearForm, name: event.target.value })} placeholder="Ex: 2026-2027" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
            <FormField label="Année active">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={yearForm.active} onChange={event => setYearForm({ ...yearForm, active: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Définir comme année académique active
              </label>
            </FormField>
            <FormField label="Date de début" required>
              <input type="date" value={yearForm.start_date} onChange={event => setYearForm({ ...yearForm, start_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
            <FormField label="Date de fin" required>
              <input type="date" value={yearForm.end_date} onChange={event => setYearForm({ ...yearForm, end_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
            <FormField label="Échéance inscription">
              <input type="date" value={yearForm.registration_due_date} onChange={event => setYearForm({ ...yearForm, registration_due_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
            <FormField label="Échéance scolarité">
              <input type="date" value={yearForm.tuition_due_date} onChange={event => setYearForm({ ...yearForm, tuition_due_date: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10" />
            </FormField>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">Préconfiguration des frais par niveau</h3>
              <p className="mt-1 text-sm text-slate-500">Saisis les montants d’inscription et de scolarité. Les lignes à zéro ne seront pas créées.</p>
            </div>
            <div className="space-y-3">
              {yearFeeTemplates.map(template => (
                <div key={template.level_id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{template.level_name}</p>
                    <p className="text-xs text-slate-500">Petite section à CM2</p>
                  </div>
                  <FormField label="Inscription">
                    <input
                      type="number"
                      value={template.registration_amount}
                      onChange={event => setYearFeeTemplates(current => current.map(item => item.level_id === template.level_id ? { ...item, registration_amount: parseFloat(event.target.value) || 0 } : item))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    />
                  </FormField>
                  <FormField label="Scolarité">
                    <input
                      type="number"
                      value={template.tuition_amount}
                      onChange={event => setYearFeeTemplates(current => current.map(item => item.level_id === template.level_id ? { ...item, tuition_amount: parseFloat(event.target.value) || 0 } : item))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                    />
                  </FormField>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
