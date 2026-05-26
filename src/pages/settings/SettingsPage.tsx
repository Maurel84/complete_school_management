import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { Settings, School, BookOpen, Plus, Edit, Save } from 'lucide-react';

export default function SettingsPage() {
  const { school } = useApp();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'school' | 'levels' | 'subjects' | 'fees' | 'roles'>('school');
  const [schoolForm, setSchoolForm] = useState({ name: '', address: '', city: '', phone: '', email: '', motto: '' });
  const [levels, setLevels] = useState<{id: string; name: string; order_index: number}[]>([]);
  const [subjects, setSubjects] = useState<{id: string; name: string; code: string; coefficient: number}[]>([]);
  const [feeTypes, setFeeTypes] = useState<{id: string; name: string; description: string}[]>([]);
  const [levelModal, setLevelModal] = useState(false);
  const [subjectModal, setSubjectModal] = useState(false);
  const [feeTypeModal, setFeeTypeModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [levelForm, setLevelForm] = useState({ name: '', order_index: 0 });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', coefficient: 1 });
  const [feeTypeForm, setFeeTypeForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (school) {
      setSchoolForm({ name: school.name, address: school.address, city: school.city, phone: school.phone, email: school.email, motto: school.motto });
      fetchLevels(); fetchSubjects(); fetchFeeTypes();
    }
  }, [school]);

  async function fetchLevels() {
    const { data } = await supabase.from('levels').select('*').eq('school_id', school!.id).order('order_index');
    setLevels(data || []);
  }

  async function fetchSubjects() {
    const { data } = await supabase.from('subjects').select('*').eq('school_id', school!.id);
    setSubjects(data || []);
  }

  async function fetchFeeTypes() {
    const { data } = await supabase.from('fee_types').select('*').eq('school_id', school!.id);
    setFeeTypes(data || []);
  }

  async function saveSchool() {
    setSaving(true);
    await supabase.from('schools').update(schoolForm).eq('id', school!.id);
    setSaving(false);
  }

  async function saveLevel() {
    setSaving(true);
    await supabase.from('levels').insert({ ...levelForm, school_id: school!.id });
    setSaving(false); setLevelModal(false); fetchLevels();
  }

  async function saveSubject() {
    setSaving(true);
    await supabase.from('subjects').insert({ ...subjectForm, school_id: school!.id });
    setSaving(false); setSubjectModal(false); fetchSubjects();
  }

  async function saveFeeType() {
    setSaving(true);
    await supabase.from('fee_types').insert({ ...feeTypeForm, school_id: school!.id });
    setSaving(false); setFeeTypeModal(false); fetchFeeTypes();
  }

  const tabs = [
    { key: 'school', label: 'Établissement', icon: School },
    { key: 'levels', label: 'Niveaux', icon: School },
    { key: 'subjects', label: 'Matières', icon: BookOpen },
    { key: 'fees', label: 'Types de frais', icon: Settings },
    { key: 'roles', label: 'Rôles & Permissions', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Configuration de l'établissement</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'school' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de l'établissement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nom"><input type="text" value={schoolForm.name} onChange={e => setSchoolForm({...schoolForm, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <FormField label="Téléphone"><input type="tel" value={schoolForm.phone} onChange={e => setSchoolForm({...schoolForm, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <FormField label="Email"><input type="email" value={schoolForm.email} onChange={e => setSchoolForm({...schoolForm, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <FormField label="Ville"><input type="text" value={schoolForm.city} onChange={e => setSchoolForm({...schoolForm, city: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            <div className="md:col-span-2">
              <FormField label="Adresse"><input type="text" value={schoolForm.address} onChange={e => setSchoolForm({...schoolForm, address: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Devise"><input type="text" value={schoolForm.motto} onChange={e => setSchoolForm({...schoolForm, motto: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
            </div>
          </div>
          <button onClick={saveSchool} disabled={saving} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <Save size={16} /> Enregistrer
          </button>
        </div>
      )}

      {tab === 'levels' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Niveaux</h3>
            <button onClick={() => setLevelModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={16} /> Ajouter</button>
          </div>
          <div className="space-y-2">
            {levels.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-gray-500">Ordre : {l.order_index}</span>
              </div>
            ))}
            {levels.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun niveau configuré</p>}
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Matières</h3>
            <button onClick={() => setSubjectModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={16} /> Ajouter</button>
          </div>
          <div className="space-y-2">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div><span className="text-sm font-medium">{s.name}</span><span className="text-xs text-gray-500 ml-2">({s.code || '-'})</span></div>
                <span className="text-xs text-gray-500">Coeff. {s.coefficient}</span>
              </div>
            ))}
            {subjects.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucune matière configurée</p>}
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Types de frais</h3>
            <button onClick={() => setFeeTypeModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={16} /> Ajouter</button>
          </div>
          <div className="space-y-2">
            {feeTypes.map(ft => (
              <div key={ft.id} className="p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{ft.name}</span>
                {ft.description && <p className="text-xs text-gray-500 mt-0.5">{ft.description}</p>}
              </div>
            ))}
            {feeTypes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun type de frais configuré</p>}
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rôles & Permissions</h3>
          <div className="space-y-2">
            {['Super Administrateur', 'Administrateur', 'Directeur', 'Comptable', 'Caissier', 'Surveillant', 'Enseignant', 'Parent', 'Élève'].map((role, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{role}</span>
                <span className="text-xs text-gray-500">Accès configuré</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={levelModal} onClose={() => setLevelModal(false)} title="Nouveau niveau" size="sm"
        actions={<>
          <button onClick={() => setLevelModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={saveLevel} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Nom" required><input type="text" value={levelForm.name} onChange={e => setLevelForm({...levelForm, name: e.target.value})} placeholder="Ex: 6ème" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Ordre"><input type="number" value={levelForm.order_index} onChange={e => setLevelForm({...levelForm, order_index: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={subjectModal} onClose={() => setSubjectModal(false)} title="Nouvelle matière" size="sm"
        actions={<>
          <button onClick={() => setSubjectModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={saveSubject} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Nom" required><input type="text" value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} placeholder="Ex: Mathématiques" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Code"><input type="text" value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} placeholder="Ex: MATH" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Coefficient"><input type="number" value={subjectForm.coefficient} onChange={e => setSubjectForm({...subjectForm, coefficient: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>

      <Modal isOpen={feeTypeModal} onClose={() => setFeeTypeModal(false)} title="Nouveau type de frais" size="sm"
        actions={<>
          <button onClick={() => setFeeTypeModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={saveFeeType} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Nom" required><input type="text" value={feeTypeForm.name} onChange={e => setFeeTypeForm({...feeTypeForm, name: e.target.value})} placeholder="Ex: Frais d'inscription" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Description"><textarea value={feeTypeForm.description} onChange={e => setFeeTypeForm({...feeTypeForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
