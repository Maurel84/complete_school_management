import { ChangeEvent, useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import FormField from '../../../components/common/FormField';
import { supabase } from '../../../lib/supabase';
import { SEX_OPTIONS, STATUS_OPTIONS } from '../../../lib/utils';
import { sanitizeDocumentName } from '../../../lib/printableDocuments';
import { Camera, ImageOff, Upload, UserCheck } from 'lucide-react';
import type { Class, Student } from '../../../types';
import type { StudentFormInput } from '../../../hooks/useStudents';

const EMPTY_STUDENT_FORM: StudentFormInput = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  sex: 'M',
  birth_place: '',
  nationality: '',
  photo_url: '',
  address: '',
  phone: '',
  email: '',
  class_id: '',
  status: 'active',
  medical_info: '',
  previous_school: '',
  parent_mode: 'existing',
  selected_parent_id: '',
  relationship: 'Père/Mère',
  new_parent_first_name: '',
  new_parent_last_name: '',
  new_parent_phone: '',
  new_parent_email: '',
  new_parent_profession: '',
};

interface ParentWithChildren {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  profession?: string;
  student_parents?: {
    student?: {
      first_name: string;
      last_name: string;
    };
  }[];
}

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schoolId: string;
  classes: Class[];
  onSave: (form: StudentFormInput) => Promise<void>;
  saving: boolean;
}

export default function StudentFormModal({
  isOpen,
  onClose,
  student,
  schoolId,
  classes,
  onSave,
  saving,
}: StudentFormModalProps) {
  const [form, setForm] = useState<StudentFormInput>(EMPTY_STUDENT_FORM);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [parentsList, setParentsList] = useState<ParentWithChildren[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  useEffect(() => {
    if (!isOpen || !schoolId) return;

    let mounted = true;
    async function fetchParentsWithChildren() {
      setLoadingParents(true);
      try {
        const { data, error } = await supabase
          .from('parents')
          .select('*, student_parents(student:students(first_name, last_name))')
          .eq('school_id', schoolId)
          .order('last_name');

        if (!error && data && mounted) {
          setParentsList(data as any);
        }
      } catch (err) {
        console.error('Error fetching parents:', err);
      } finally {
        if (mounted) setLoadingParents(false);
      }
    }

    void fetchParentsWithChildren();

    return () => {
      mounted = false;
    };
  }, [isOpen, schoolId]);

  useEffect(() => {
    if (student) {
      setForm({
        first_name: student.first_name || '',
        last_name: student.last_name || '',
        date_of_birth: student.date_of_birth || '',
        sex: student.sex || 'M',
        birth_place: student.birth_place || '',
        nationality: student.nationality || '',
        photo_url: student.photo_url || '',
        address: student.address || '',
        phone: student.phone || '',
        email: student.email || '',
        class_id: student.class_id || '',
        status: student.status || 'active',
        medical_info: student.medical_info || '',
        previous_school: student.previous_school || '',
        parent_mode: 'existing',
        selected_parent_id: '',
        relationship: 'Père/Mère',
        new_parent_first_name: '',
        new_parent_last_name: '',
        new_parent_phone: '',
        new_parent_email: '',
        new_parent_profession: '',
      });

      // Try fetching linked primary parent for existing student
      supabase
        .from('student_parents')
        .select('parent_id, relationship')
        .eq('student_id', student.id)
        .order('is_primary', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setForm(current => ({
              ...current,
              parent_mode: 'existing',
              selected_parent_id: data[0].parent_id,
              relationship: data[0].relationship || 'Père/Mère',
            }));
          }
        });
    } else {
      setForm(EMPTY_STUDENT_FORM);
    }
    setNotice(null);
  }, [student, isOpen]);

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setNotice(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const baseName = sanitizeDocumentName(file.name.replace(/\.[^.]+$/, '')) || 'photo-eleve';
      const path = `${schoolId}/students/photos/${baseName}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('student-media').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (error) throw error;

      const { data } = supabase.storage.from('student-media').getPublicUrl(path);
      setForm(current => ({ ...current, photo_url: data.publicUrl }));
      setNotice('Photo enregistrée. Elle sera visible dans le dossier et sur la carte scolaire.');
    } catch (error: any) {
      console.error(error);
      setNotice("La photo n'a pas pu être envoyée. Vérifie la migration du bucket student-media.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  }

  const [localSaving, setLocalSaving] = useState(false);

  async function handleSubmit() {
    setLocalSaving(true);
    setNotice(null);
    try {
      await onSave(form);
    } catch (error: any) {
      setNotice(error.message || "Une erreur est survenue lors de l'enregistrement de l'élève.");
    } finally {
      setLocalSaving(false);
    }
  }

  function handleFormChange(key: keyof StudentFormInput, value: any) {
    setForm(current => ({ ...current, [key]: value }));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? "Modifier l'élève" : 'Nouvel élève'}
      size="xl"
      actions={
        <>
          <button
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={saving || localSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving || localSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Prénom" required>
            <input
              type="text"
              value={form.first_name}
              onChange={e => handleFormChange('first_name', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Nom" required>
            <input
              type="text"
              value={form.last_name}
              onChange={e => handleFormChange('last_name', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Date de naissance" required>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => handleFormChange('date_of_birth', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Sexe" required>
            <select
              value={form.sex}
              onChange={e => handleFormChange('sex', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            >
              {SEX_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Lieu de naissance">
            <input
              type="text"
              value={form.birth_place}
              onChange={e => handleFormChange('birth_place', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Nationalité">
            <input
              type="text"
              value={form.nationality}
              onChange={e => handleFormChange('nationality', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Classe">
            <select
              value={form.class_id}
              onChange={e => handleFormChange('class_id', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Statut">
            <select
              value={form.status}
              onChange={e => handleFormChange('status', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Téléphone">
            <input
              type="tel"
              value={form.phone}
              onChange={e => handleFormChange('phone', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={form.email}
              onChange={e => handleFormChange('email', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Adresse">
              <input
                type="text"
                value={form.address}
                onChange={e => handleFormChange('address', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="École précédente">
              <input
                type="text"
                value={form.previous_school}
                onChange={e => handleFormChange('previous_school', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </FormField>
          </div>
          <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                    <UserCheck size={18} className="text-blue-600" />
                    Rattachement du Parent / Tuteur Légal
                  </h4>
                  <p className="text-xs text-blue-700/80">
                    Rattachez directement cet élève à un parent existant ou créez un nouveau parent.
                  </p>
                </div>

                {/* Toggle Mode Buttons */}
                <div className="inline-flex rounded-xl bg-white p-1 border border-blue-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => handleFormChange('parent_mode', 'existing')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      form.parent_mode === 'existing' || !form.parent_mode
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Parent Existant
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormChange('parent_mode', 'new')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      form.parent_mode === 'new'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Nouveau Parent
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormChange('parent_mode', 'none')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      form.parent_mode === 'none'
                        ? 'bg-slate-700 text-white font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Plus tard
                  </button>
                </div>
              </div>

              {/* Mode 1: Parent Existant */}
              {(form.parent_mode === 'existing' || !form.parent_mode) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Sélectionner le Parent dans l'établissement">
                    <select
                      value={form.selected_parent_id || ''}
                      onChange={e => handleFormChange('selected_parent_id', e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                    >
                      <option value="">
                        {loadingParents
                          ? 'Chargement des parents...'
                          : `-- Choisir un parent (${parentsList.length} enregistrés) --`}
                      </option>
                      {parentsList.map(p => {
                        const childrenNames = (p.student_parents || [])
                          .map(sp => (sp.student ? `${sp.student.first_name} ${sp.student.last_name}` : ''))
                          .filter(Boolean)
                          .join(', ');

                        return (
                          <option key={p.id} value={p.id}>
                            {p.last_name.toUpperCase()} {p.first_name} {p.phone ? `(📞 ${p.phone})` : ''}{' '}
                            {childrenNames ? `— Enfants: [${childrenNames}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </FormField>

                  <FormField label="Lien de Parenté">
                    <select
                      value={form.relationship || 'Père/Mère'}
                      onChange={e => handleFormChange('relationship', e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                    >
                      <option value="Père">Père</option>
                      <option value="Mère">Mère</option>
                      <option value="Tuteur Légal">Tuteur Légal</option>
                      <option value="Autre">Autre Parent</option>
                    </select>
                  </FormField>
                </div>
              )}

              {/* Mode 2: Nouveau Parent */}
              {form.parent_mode === 'new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Prénom du parent" required>
                    <input
                      type="text"
                      value={form.new_parent_first_name || ''}
                      onChange={e => handleFormChange('new_parent_first_name', e.target.value)}
                      placeholder="Ex: Jean"
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </FormField>
                  <FormField label="Nom du parent" required>
                    <input
                      type="text"
                      value={form.new_parent_last_name || ''}
                      onChange={e => handleFormChange('new_parent_last_name', e.target.value)}
                      placeholder="Ex: KOUASSI"
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </FormField>
                  <FormField label="Téléphone Contact" required>
                    <input
                      type="tel"
                      value={form.new_parent_phone || ''}
                      onChange={e => handleFormChange('new_parent_phone', e.target.value)}
                      placeholder="Ex: 0708091011"
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </FormField>
                  <FormField label="Lien de Parenté">
                    <select
                      value={form.relationship || 'Père/Mère'}
                      onChange={e => handleFormChange('relationship', e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Père">Père</option>
                      <option value="Mère">Mère</option>
                      <option value="Tuteur Légal">Tuteur Légal</option>
                      <option value="Autre">Autre Parent</option>
                    </select>
                  </FormField>
                  <FormField label="Email parent (Optionnel)">
                    <input
                      type="email"
                      value={form.new_parent_email || ''}
                      onChange={e => handleFormChange('new_parent_email', e.target.value)}
                      placeholder="Ex: parent@email.com"
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </FormField>
                  <FormField label="Profession (Optionnel)">
                    <input
                      type="text"
                      value={form.new_parent_profession || ''}
                      onChange={e => handleFormChange('new_parent_profession', e.target.value)}
                      placeholder="Ex: Commerçant, Enseignant..."
                      className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <FormField label="Infos médicales">
              <textarea
                value={form.medical_info}
                onChange={e => handleFormChange('medical_info', e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </FormField>
          </div>
        </div>

        <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Photo élève</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Utilisée dans le dossier, les impressions et la carte scolaire.
          </p>

          <div className="mt-4 flex justify-center">
            {form.photo_url ? (
              <img
                src={form.photo_url}
                alt="Photo élève"
                className="h-44 w-44 rounded-[28px] border border-slate-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-44 w-44 flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white text-slate-400">
                <Camera size={28} />
                <p className="mt-3 text-sm">Aucune photo</p>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700">
              <Upload size={16} />
              {uploadingPhoto ? 'Envoi...' : 'Charger une photo'}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            {form.photo_url && (
              <button
                onClick={() => handleFormChange('photo_url', '')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <ImageOff size={16} /> Retirer la photo
              </button>
            )}
          </div>

          {notice && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
