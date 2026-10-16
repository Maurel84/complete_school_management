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
  MessageSquare,
  FileText,
  FileCheck,
  Palette,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import { THEME_PRESETS, ThemePresetOption, SchoolTheme, getDarkMode, setDarkMode } from '../../lib/schoolTheme';

type SettingsTab = 'school' | 'theme' | 'years' | 'levels' | 'subjects' | 'fees' | 'roles' | 'notifications';
type LevelItem = { id: string; name: string; order_index: number };
type SubjectItem = { id: string; name: string; code: string; coefficient: number };
type FeeTypeItem = { id: string; name: string; description: string; is_recurring: boolean };
type AcademicYearItem = { id: string; name: string; start_date: string; end_date: string; active: boolean };
type YearFeeTemplateRow = { level_id: string; level_name: string; registration_amount: number; tuition_amount: number };

function normalizeFeeTypeName(value: string) {
  return value.trim().toLowerCase().replace(/[’`´]/g, '\'');
}

export default function SettingsPage() {
  const { school, refreshSchool, refreshAcademicYears, theme, updateTheme } = useApp();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('school');
  const [selectedPreset, setSelectedPreset] = useState<string>(theme?.presetId || 'emerald');
  const [customPrimary, setCustomPrimary] = useState<string>(theme?.primary || '#059669');
  const [customAccent, setCustomAccent] = useState<string>(theme?.accent || '#d97706');
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => getDarkMode());

  useEffect(() => {
    if (theme) {
      setSelectedPreset(theme.presetId);
      setCustomPrimary(theme.primary);
      setCustomAccent(theme.accent);
    }
  }, [theme]);
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    motto: '',
    logo_url: '',
    facade_url: '',
    students_uniform_url: '',
    stamp_url: '',
    signature_url: '',
    director_name: 'JEAN KRAZLIN',
    establishment_type: 'maternelle_primaire',
  });
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [yearFeeCounts, setYearFeeCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFacade, setUploadingFacade] = useState(false);
  const [uploadingUniform, setUploadingUniform] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [schoolNotice, setSchoolNotice] = useState<string | null>(null);
  const [yearNotice, setYearNotice] = useState<string | null>(null);

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

  const [waProvider, setWaProvider] = useState(() => localStorage.getItem('wa_provider') || 'green-api');
  const [waToken, setWaToken] = useState(() => localStorage.getItem('wa_token') || '');
  const [waInstance, setWaInstance] = useState(() => localStorage.getItem('wa_instance') || '');
  const [receiptText, setReceiptText] = useState(() => localStorage.getItem('receipt_text') || 'Bonjour, nous vous confirmons le règlement de scolarité de {student_name} d\'un montant de {amount} FCFA. Solde restant : {remaining} FCFA. Merci.');

  function saveNotificationConfig() {
    localStorage.setItem('wa_provider', waProvider);
    localStorage.setItem('wa_token', waToken);
    localStorage.setItem('wa_instance', waInstance);
    localStorage.setItem('receipt_text', receiptText);
    alert('Paramètres de notification WhatsApp enregistrés !');
  }

  const canManage = isAdmin || isSuperAdmin;
  const canCreateAcademicYear = canManage && levels.length > 0;

  useEffect(() => {
    if (!school) return;

    let cachedBranding: any = {};
    try {
      const cachedBrandingStr = localStorage.getItem(`school_branding_${school.id}`);
      if (cachedBrandingStr) cachedBranding = JSON.parse(cachedBrandingStr);
    } catch {}

    setSchoolForm({
      name: school.name,
      address: school.address,
      city: school.city,
      country: school.country,
      phone: school.phone,
      email: school.email,
      motto: school.motto,
      logo_url: school.logo_url || cachedBranding.logo_url || '',
      facade_url: school.facade_url || '',
      students_uniform_url: school.students_uniform_url || '',
      stamp_url: school.stamp_url || cachedBranding.stamp_url || '',
      signature_url: school.signature_url || cachedBranding.signature_url || '',
      director_name: school.director_name || cachedBranding.director_name || 'JEAN KRAZLIN',
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

    const brandingPayload: any = {
      name: schoolForm.name,
      address: schoolForm.address,
      city: schoolForm.city,
      country: schoolForm.country,
      phone: schoolForm.phone,
      email: schoolForm.email,
      motto: schoolForm.motto,
      logo_url: schoolForm.logo_url,
      facade_url: schoolForm.facade_url,
      students_uniform_url: schoolForm.students_uniform_url,
      establishment_type: 'maternelle_primaire',
    };
    if (schoolForm.stamp_url !== undefined) brandingPayload.stamp_url = schoolForm.stamp_url;
    if (schoolForm.signature_url !== undefined) brandingPayload.signature_url = schoolForm.signature_url;
    if (schoolForm.director_name !== undefined) brandingPayload.director_name = schoolForm.director_name;

    try {
      localStorage.setItem(`school_branding_${school.id}`, JSON.stringify({
        stamp_url: schoolForm.stamp_url,
        signature_url: schoolForm.signature_url,
        director_name: schoolForm.director_name,
        logo_url: schoolForm.logo_url,
      }));
    } catch {}

    try {
      await supabase.from('schools').update(brandingPayload).eq('id', school.id);
    } catch {
      delete brandingPayload.stamp_url;
      delete brandingPayload.signature_url;
      delete brandingPayload.director_name;
      await supabase.from('schools').update(brandingPayload).eq('id', school.id);
    }

    setSaving(false);
    await refreshSchool();
    setSchoolNotice('Informations de l’école et paramètres des cartes scolaires enregistrés avec succès.');
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

  async function handleFacadeUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFacade(true);
    setSchoolNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/facade-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setSchoolForm(current => ({ ...current, facade_url: data.publicUrl }));
      await supabase.from('schools').update({ facade_url: data.publicUrl }).eq('id', school.id);
      await refreshSchool();
      setSchoolNotice('Image de la façade mise à jour.');
    } catch (error) {
      setSchoolNotice("L'image n'a pas pu être envoyée. Vérifie le bucket Supabase school-assets.");
    } finally {
      setUploadingFacade(false);
      event.target.value = '';
    }
  }

  async function clearFacade() {
    if (!school) return;
    await supabase.from('schools').update({ facade_url: '' }).eq('id', school.id);
    setSchoolForm(current => ({ ...current, facade_url: '' }));
    await refreshSchool();
    setSchoolNotice('Image de la façade retirée.');
  }

  async function handleUniformUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingUniform(true);
    setSchoolNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/uniform-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setSchoolForm(current => ({ ...current, students_uniform_url: data.publicUrl }));
      await supabase.from('schools').update({ students_uniform_url: data.publicUrl }).eq('id', school.id);
      await refreshSchool();
      setSchoolNotice('Image des élèves en tenue mise à jour.');
    } catch (error) {
      setSchoolNotice("L'image n'a pas pu être envoyée. Vérifie le bucket Supabase school-assets.");
    } finally {
      setUploadingUniform(false);
      event.target.value = '';
    }
  }

  async function clearUniform() {
    if (!school) return;
    await supabase.from('schools').update({ students_uniform_url: '' }).eq('id', school.id);
    setSchoolForm(current => ({ ...current, students_uniform_url: '' }));
    await refreshSchool();
    setSchoolNotice('Image des élèves en tenue retirée.');
  }

  async function handleStampUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingStamp(true);
    setSchoolNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/stamp-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setSchoolForm(current => ({ ...current, stamp_url: data.publicUrl }));

      try {
        localStorage.setItem(`school_branding_${school.id}`, JSON.stringify({
          ...JSON.parse(localStorage.getItem(`school_branding_${school.id}`) || '{}'),
          stamp_url: data.publicUrl,
        }));
      } catch {}

      try {
        await supabase.from('schools').update({ stamp_url: data.publicUrl }).eq('id', school.id);
      } catch {}

      await refreshSchool();
      setSchoolNotice('Cachet officiel de l\'école mis à jour. Il apparaîtra au verso des cartes scolaires.');
    } catch (error) {
      setSchoolNotice("Le cachet n'a pas pu être envoyé. Vérifie le bucket Supabase school-assets.");
    } finally {
      setUploadingStamp(false);
      event.target.value = '';
    }
  }

  async function clearStamp() {
    if (!school) return;
    try {
      await supabase.from('schools').update({ stamp_url: '' }).eq('id', school.id);
    } catch {}
    try {
      localStorage.setItem(`school_branding_${school.id}`, JSON.stringify({
        ...JSON.parse(localStorage.getItem(`school_branding_${school.id}`) || '{}'),
        stamp_url: '',
      }));
    } catch {}
    setSchoolForm(current => ({ ...current, stamp_url: '' }));
    await refreshSchool();
    setSchoolNotice('Cachet officiel retiré.');
  }

  async function handleSignatureUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!school) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingSignature(true);
    setSchoolNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/signature-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      setSchoolForm(current => ({ ...current, signature_url: data.publicUrl }));

      try {
        localStorage.setItem(`school_branding_${school.id}`, JSON.stringify({
          ...JSON.parse(localStorage.getItem(`school_branding_${school.id}`) || '{}'),
          signature_url: data.publicUrl,
        }));
      } catch {}

      try {
        await supabase.from('schools').update({ signature_url: data.publicUrl }).eq('id', school.id);
      } catch {}

      await refreshSchool();
      setSchoolNotice('Signature numérique mise à jour. Elle apparaîtra sur les cartes scolaires et certificats.');
    } catch (error) {
      setSchoolNotice("La signature n'a pas pu être envoyée. Vérifie le bucket Supabase school-assets.");
    } finally {
      setUploadingSignature(false);
      event.target.value = '';
    }
  }

  async function clearSignature() {
    if (!school) return;
    try {
      await supabase.from('schools').update({ signature_url: '' }).eq('id', school.id);
    } catch {}
    try {
      localStorage.setItem(`school_branding_${school.id}`, JSON.stringify({
        ...JSON.parse(localStorage.getItem(`school_branding_${school.id}`) || '{}'),
        signature_url: '',
      }));
    } catch {}
    setSchoolForm(current => ({ ...current, signature_url: '' }));
    await refreshSchool();
    setSchoolNotice('Signature numérique retirée.');
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
    setYearNotice(null);

    if (yearForm.active) {
      const { error: deactivateError } = await supabase.from('academic_years').update({ active: false }).eq('school_id', school.id);
      if (deactivateError) {
        setYearNotice(deactivateError.message);
        setSaving(false);
        return;
      }
    }

    try {
      const { data: createdYear, error } = await supabase
        .from('academic_years')
        .insert({
          school_id: school.id,
          name: yearForm.name,
          start_date: yearForm.start_date || null,
          end_date: yearForm.end_date || null,
          active: yearForm.active,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!createdYear) throw new Error("Impossible de créer l'année académique.");

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
            due_date: registrationDueDate || null,
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
            due_date: tuitionDueDate || null,
            description: `Frais de scolarité ${createdYear.name} - ${template.level_name}`,
          });
        }

        return rows;
      });

      if (feeRows.length > 0) {
        const { error: feeError } = await supabase.from('fees').insert(feeRows);
        if (feeError) throw feeError;
      }

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
    } catch (err: any) {
      console.error(err);
      setYearNotice(err.message || "Une erreur est survenue lors de la création de l'année.");
    } finally {
      setSaving(false);
    }
  }

  function openYearModal() {
    setYearNotice(null);
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
    { key: 'theme', label: '🎨 Thème & Couleurs', icon: Palette },
    { key: 'years', label: 'Années', icon: CalendarDays },
    { key: 'levels', label: 'Niveaux', icon: Layers3 },
    { key: 'subjects', label: 'Matières', icon: BookOpen },
    { key: 'fees', label: 'Frais', icon: Coins },
    { key: 'roles', label: 'Accès', icon: ShieldCheck },
    { key: 'notifications', label: 'Notifications', icon: MessageSquare },
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
          <div className="mb-6">
            <div>
              <h2 className="display-font text-xl font-semibold text-slate-900">Identité visuelle et administrative</h2>
              <p className="mt-1 text-sm text-slate-500">Configurez le logo, l'image de la façade et la tenue scolaire de votre établissement.</p>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {/* Logo Card */}
              <div className="surface-card p-5 border border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-between text-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Logo de l'école</h3>
                  <p className="text-xs text-slate-400 mt-1">Utilisé sur les reçus, bulletins et documents officiels.</p>
                </div>
                <div className="my-5">
                  {schoolForm.logo_url ? (
                    <img src={schoolForm.logo_url} alt="Logo" className="mx-auto h-24 w-24 rounded-3xl border border-slate-100 object-cover shadow-md" />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 shadow-inner">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                    <Upload size={14} />
                    {uploadingLogo ? 'Envoi...' : 'Uploader le logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {schoolForm.logo_url && (
                    <button onClick={() => void clearLogo()} className="w-full rounded-2xl border border-slate-200 py-2 text-xs text-rose-600 font-semibold transition hover:bg-rose-50">
                      Retirer
                    </button>
                  )}
                </div>
              </div>

              {/* Facade Card */}
              <div className="surface-card p-5 border border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-between text-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Façade de l'école</h3>
                  <p className="text-xs text-slate-400 mt-1">Affichée en fond sur la page de connexion.</p>
                </div>
                <div className="my-5">
                  {schoolForm.facade_url ? (
                    <img src={schoolForm.facade_url} alt="Façade" className="mx-auto h-24 w-24 rounded-3xl border border-slate-100 object-cover shadow-md" />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 shadow-inner">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800">
                    <Upload size={14} />
                    {uploadingFacade ? 'Envoi...' : 'Uploader la façade'}
                    <input type="file" accept="image/*" onChange={handleFacadeUpload} className="hidden" />
                  </label>
                  {schoolForm.facade_url && (
                    <button onClick={() => void clearFacade()} className="w-full rounded-2xl border border-slate-200 py-2 text-xs text-rose-600 font-semibold transition hover:bg-rose-50">
                      Retirer
                    </button>
                  )}
                </div>
              </div>

              {/* Uniform Card */}
              <div className="surface-card p-5 border border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-between text-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Élèves en tenue</h3>
                  <p className="text-xs text-slate-400 mt-1">Illustration pour le portail d'accueil.</p>
                </div>
                <div className="my-5">
                  {schoolForm.students_uniform_url ? (
                    <img src={schoolForm.students_uniform_url} alt="Tenue scolaire" className="mx-auto h-24 w-24 rounded-3xl border border-slate-100 object-cover shadow-md" />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 shadow-inner">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800">
                    <Upload size={14} />
                    {uploadingUniform ? 'Envoi...' : 'Uploader la tenue'}
                    <input type="file" accept="image/*" onChange={handleUniformUpload} className="hidden" />
                  </label>
                  {schoolForm.students_uniform_url && (
                    <button onClick={() => void clearUniform()} className="w-full rounded-2xl border border-slate-200 py-2 text-xs text-rose-600 font-semibold transition hover:bg-rose-50">
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Dedicated Official Cards Section: Stamp & Signature */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={20} />
                <h3 className="text-base font-bold text-slate-900">Authentification & Cartes Scolaires (Cachet & Signature)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Téléversez le cachet officiel de l'école et la signature numérique du directeur pour qu'ils s'affichent automatiquement au verso des cartes d'élèves et sur les reçus officiels.
              </p>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {/* Stamp Card */}
                <div className="surface-card p-5 border border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-between text-center">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Cachet / Tampon Officiel de l'Établissement</h4>
                    <p className="text-xs text-slate-400 mt-1">Apposé sur le visa au verso des cartes scolaires (PNG fond transparent recommandé).</p>
                  </div>
                  <div className="my-5">
                    {schoolForm.stamp_url ? (
                      <img src={schoolForm.stamp_url} alt="Cachet officiel" className="mx-auto h-24 w-24 rounded-2xl border border-slate-100 object-contain p-2 bg-slate-50 shadow-sm" />
                    ) : (
                      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 shadow-inner">
                        <FileCheck size={28} />
                      </div>
                    )}
                  </div>
                  <div className="w-full space-y-2">
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                      <Upload size={14} />
                      {uploadingStamp ? 'Envoi...' : 'Uploader le cachet'}
                      <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                    </label>
                    {schoolForm.stamp_url && (
                      <button onClick={() => void clearStamp()} className="w-full rounded-2xl border border-slate-200 py-2 text-xs text-rose-600 font-semibold transition hover:bg-rose-50">
                        Retirer le cachet
                      </button>
                    )}
                  </div>
                </div>

                {/* Signature Card */}
                <div className="surface-card p-5 border border-slate-200 bg-white rounded-3xl flex flex-col items-center justify-between text-center">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Signature Numérique du Directeur</h4>
                    <p className="text-xs text-slate-400 mt-1">Apposée à côté du cachet sur les cartes d'élèves et attestations (PNG transparent recommandé).</p>
                  </div>
                  <div className="my-5">
                    {schoolForm.signature_url ? (
                      <img src={schoolForm.signature_url} alt="Signature numérique" className="mx-auto h-24 w-36 rounded-2xl border border-slate-100 object-contain p-2 bg-slate-50 shadow-sm" />
                    ) : (
                      <div className="mx-auto flex h-24 w-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 shadow-inner">
                        <FileText size={28} />
                      </div>
                    )}
                  </div>
                  <div className="w-full space-y-2">
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                      <Upload size={14} />
                      {uploadingSignature ? 'Envoi...' : 'Uploader la signature'}
                      <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                    </label>
                    {schoolForm.signature_url && (
                      <button onClick={() => void clearSignature()} className="w-full rounded-2xl border border-slate-200 py-2 text-xs text-rose-600 font-semibold transition hover:bg-rose-50">
                        Retirer la signature
                      </button>
                    )}
                  </div>
                </div>
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
            <FormField label="Chef d'Établissement (Directeur)">
              <input type="text" value={schoolForm.director_name} onChange={event => setSchoolForm({ ...schoolForm, director_name: event.target.value })} placeholder="Ex: JEAN KRAZLIN" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
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

      {tab === 'theme' && (
        <div className="surface-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Palette size={20} />
                </span>
                <h2 className="display-font text-xl font-semibold text-slate-900">
                  Thème & Charte Graphique de l'Établissement
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 max-w-2xl">
                Adaptez instantanément l'apparence visuelle de la plateforme aux couleurs de votre établissement,
                de votre logo et de l'uniforme scolaire des élèves.
              </p>
            </div>

            {themeNotice && (
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in">
                <CheckCircle2 size={16} className="text-emerald-600" />
                {themeNotice}
              </div>
            )}
          </div>

          {/* PALETTES PRÉDÉFINIES */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              1. Choisissez une Palette Académique Institutionnelle (1 Clic)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Des combinaisons harmonieuses soigneusement calibrées pour les établissements d'enseignement scolaire.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {THEME_PRESETS.map(preset => {
                const isActive = selectedPreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setCustomPrimary(preset.primary);
                      setCustomAccent(preset.accent);
                      const newTh: SchoolTheme = {
                        presetId: preset.id,
                        primary: preset.primary,
                        primaryHover: preset.primaryHover,
                        primaryLight: preset.primaryLight,
                        accent: preset.accent,
                        accentLight: preset.accentLight,
                        name: preset.name,
                      };
                      void updateTheme(newTh);
                      setThemeNotice(`Thème "${preset.name}" activé !`);
                      setTimeout(() => setThemeNotice(null), 3000);
                    }}
                    className={`cursor-pointer rounded-3xl p-5 border-2 transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-slate-900 bg-white shadow-md ring-4 ring-slate-900/5'
                        : 'border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      {/* Color circles */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full shadow-sm border-2 border-white ring-1 ring-slate-200"
                            style={{ backgroundColor: preset.primary }}
                            title="Couleur Primaire"
                          />
                          <div
                            className="w-8 h-8 rounded-full shadow-sm border-2 border-white ring-1 ring-slate-200"
                            style={{ backgroundColor: preset.accent }}
                            title="Couleur Accent"
                          />
                        </div>

                        {isActive && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-900 text-white flex items-center gap-1">
                            <CheckCircle2 size={12} /> Actif
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{preset.name}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{preset.tagline}</p>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{preset.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400 font-mono text-[11px]">{preset.primary} • {preset.accent}</span>
                      <span className="text-slate-700 underline text-xs">Appliquer</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SÉLECTEUR DE COULEURS SUR-MESURE */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              2. Ou définissez vos propres couleurs sur-mesure (Charte de l'école)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Saisissez les codes Hexadécimaux (#) de votre école pour un affichage sur-mesure à 100%.
            </p>

            <div className="grid gap-4 md:grid-cols-2 bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80">
              {/* Primary Color Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Couleur Principale (Boutons, Menus, En-têtes)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={e => setCustomPrimary(e.target.value)}
                    className="w-12 h-12 rounded-2xl cursor-pointer border border-slate-200 p-1 bg-white shadow-2xs"
                  />
                  <input
                    type="text"
                    value={customPrimary}
                    onChange={e => setCustomPrimary(e.target.value)}
                    placeholder="#059669"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 font-bold focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Accent Color Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Couleur d'Accentuation (Badges, Alertes, Éléments de mise en valeur)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customAccent}
                    onChange={e => setCustomAccent(e.target.value)}
                    className="w-12 h-12 rounded-2xl cursor-pointer border border-slate-200 p-1 bg-white shadow-2xs"
                  />
                  <input
                    type="text"
                    value={customAccent}
                    onChange={e => setCustomAccent(e.target.value)}
                    placeholder="#D97706"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 font-bold focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setThemeSaving(true);
                    try {
                      const newTh: SchoolTheme = {
                        presetId: 'custom',
                        primary: customPrimary,
                        primaryHover: customPrimary,
                        primaryLight: customPrimary + '15',
                        accent: customAccent,
                        accentLight: customAccent + '20',
                        name: 'Charte sur-mesure',
                      };
                      await updateTheme(newTh);
                      setSelectedPreset('custom');
                      setThemeNotice('Couleurs personnalisées enregistrées et appliquées avec succès !');
                      setTimeout(() => setThemeNotice(null), 3000);
                    } finally {
                      setThemeSaving(false);
                    }
                  }}
                  disabled={themeSaving}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                >
                  <Save size={16} />
                  {themeSaving ? 'Application...' : 'Appliquer et Enregistrer les Couleurs'}
                </button>
              </div>
            </div>
          </div>

          {/* STUDIO DE PRÉVISUALISATION EN DIRECT */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              3. Aperçu en Direct des Composants Graphiques
            </h3>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  style={{ backgroundColor: customPrimary }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-sm flex items-center gap-2"
                >
                  <Sparkles size={14} /> Bouton Principal de l'École
                </button>

                <button
                  type="button"
                  style={{ backgroundColor: customAccent }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-sm flex items-center gap-2"
                >
                  Bouton d'Action Secondaire
                </button>

                <span
                  style={{ color: customPrimary, backgroundColor: customPrimary + '18', borderColor: customPrimary + '40' }}
                  className="px-3 py-1 rounded-full text-xs font-extrabold border"
                >
                  Badge Inscription Validée
                </span>

                <span
                  style={{ color: customAccent, backgroundColor: customAccent + '18', borderColor: customAccent + '40' }}
                  className="px-3 py-1 rounded-full text-xs font-extrabold border"
                >
                  Notification Frais de Scolarité
                </span>
              </div>

              {/* Sample Card Accent Bar */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Bandeau décoratif de Carte Scolaire & Documents :
                </p>
                <div className="w-full h-3 rounded-full overflow-hidden flex shadow-inner">
                  <div style={{ backgroundColor: customPrimary }} className="flex-1 transition-all" />
                  <div style={{ backgroundColor: customAccent }} className="flex-1 transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. GESTION MODE CLAIR / SOMBRE */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-1 dark:text-white">
              4. Mode d'Affichage de l'Interface (Jour / Nuit)
            </h3>
            <p className="text-xs text-slate-500 mb-4 dark:text-slate-400">
              Basculez entre le thème clair (optimisé pour le jour et les impressions) et le thème sombre (confort visuel et repos oculaire).
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setDarkMode(false);
                  setIsDark(false);
                  setThemeNotice('Mode Clair activé !');
                  setTimeout(() => setThemeNotice(null), 3000);
                }}
                className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between text-left ${
                  !isDark
                    ? 'border-slate-900 bg-white shadow-md ring-4 ring-slate-900/5 dark:bg-slate-800'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Sun size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Thème Clair (Jour)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fond blanc pur, contrastes nets, idéal pour bureaux</p>
                  </div>
                </div>
                {!isDark && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-900 text-white flex items-center gap-1 dark:bg-white dark:text-slate-900">
                    <CheckCircle2 size={12} /> Actif
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setDarkMode(true);
                  setIsDark(true);
                  setThemeNotice('Mode Sombre activé !');
                  setTimeout(() => setThemeNotice(null), 3000);
                }}
                className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between text-left ${
                  isDark
                    ? 'border-emerald-500 bg-slate-900 text-white shadow-md ring-4 ring-emerald-500/10'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-950 text-amber-300">
                    <Moon size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Thème Sombre (Nuit)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Élégant, reposant pour les yeux et économe en énergie</p>
                  </div>
                </div>
                {isDark && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                    <CheckCircle2 size={12} /> Actif
                  </span>
                )}
              </button>
            </div>
          </div>
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
      {tab === 'notifications' && (
        <div className="surface-card p-6 space-y-6">
          <div>
            <h2 className="display-font text-xl font-semibold text-slate-900">Notifications & Alertes API</h2>
            <p className="mt-1 text-sm text-slate-500">Configurez vos accès API pour l'envoi automatique de reçus de paiement et relances de scolarité via WhatsApp.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Fournisseur d'API" required>
              <select value={waProvider} onChange={e => setWaProvider(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none">
                <option value="green-api">Green-API (Recommandé pour WhatsApp en Afrique)</option>
                <option value="twilio">Twilio SMS / WhatsApp Business</option>
                <option value="simulation">Mode Simulation (Affichage en direct)</option>
              </select>
            </FormField>

            <FormField label="ID Instance (Green-API uniquement)">
              <input type="text" value={waInstance} onChange={e => setWaInstance(e.target.value)} placeholder="Ex: 1101859384" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none" />
            </FormField>

            <FormField label="Clé API / Token d'accès">
              <input type="password" value={waToken} onChange={e => setWaToken(e.target.value)} placeholder="Clé d'authentification ou Token" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none" />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Modèle de message pour reçu de scolarité">
                <textarea value={receiptText} onChange={e => setReceiptText(e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none" placeholder="Bonjour..." />
                <p className="mt-1.5 text-xs text-slate-400">Variables utilisables : <code>{'{student_name}'}</code>, <code>{'{amount}'}</code>, <code>{'{remaining}'}</code></p>
              </FormField>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button onClick={saveNotificationConfig} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Save size={16} /> Enregistrer la configuration
            </button>
          </div>
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
          {yearNotice && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800 font-medium animate-in">
              {yearNotice}
            </div>
          )}
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
