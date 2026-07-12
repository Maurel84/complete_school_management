import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import FormField from '../../../components/common/FormField';
import { RELATIONSHIP_OPTIONS } from '../../../lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import type { Parent, Student } from '../../../types';
import type { FamilyLinkInput } from '../../../hooks/useStudents';

const EMPTY_LINK_FORM: FamilyLinkInput = {
  parent_id: '',
  relationship: 'pere',
  is_primary: false,
  is_billing_contact: false,
  is_pickup_authorized: true,
  emergency_priority: 1,
  notes: '',
};

const relationshipLabels: Record<string, string> = {
  pere: 'Père',
  mere: 'Mère',
  tuteur: 'Tuteur',
  autre: 'Autre',
};

interface FamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  familyLinks: any[];
  availableParents: Parent[];
  onSaveLinks: (familyLinks: any[], linkForm: FamilyLinkInput) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
  saving: boolean;
}

export default function FamilyModal({
  isOpen,
  onClose,
  student,
  familyLinks,
  availableParents,
  onSaveLinks,
  onRemoveLink,
  saving,
}: FamilyModalProps) {
  const [links, setLinks] = useState<any[]>([]);
  const [linkForm, setLinkForm] = useState<FamilyLinkInput>(EMPTY_LINK_FORM);

  useEffect(() => {
    setLinks(
      familyLinks.map(link => ({
        ...link,
      }))
    );
    setLinkForm(EMPTY_LINK_FORM);
  }, [familyLinks, isOpen]);

  function handleLinkFieldChange(index: number, key: string, value: any) {
    const updated = [...links];
    updated[index] = { ...updated[index], [key]: value };
    setLinks(updated);
  }

  function handleNewLinkFieldChange(key: keyof FamilyLinkInput, value: any) {
    setLinkForm(current => ({ ...current, [key]: value }));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Gérer la famille - ${student.first_name} ${student.last_name}`}
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
            onClick={() => void onSaveLinks(links, linkForm)}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Parents rattachés</h4>
          {links.length === 0 ? (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
              Aucun parent n'est actuellement lié à cet élève.
            </p>
          ) : (
            <div className="space-y-4">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className="grid gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 items-end"
                >
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                      Parent
                    </span>
                    <span className="font-semibold text-slate-800">
                      {link.parent
                        ? `${link.parent.first_name} ${link.parent.last_name}`
                        : 'Parent'}
                    </span>
                  </div>
                  <div>
                    <FormField label="Relation">
                      <select
                        value={link.relationship}
                        onChange={e => handleLinkFieldChange(index, 'relationship', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {RELATIONSHIP_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={link.is_primary}
                        onChange={e => handleLinkFieldChange(index, 'is_primary', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Contact principal
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={link.is_billing_contact}
                        onChange={e =>
                          handleLinkFieldChange(index, 'is_billing_contact', e.target.checked)
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Contact financier
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={link.is_pickup_authorized}
                        onChange={e =>
                          handleLinkFieldChange(index, 'is_pickup_authorized', e.target.checked)
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Récupération
                    </label>
                    <button
                      type="button"
                      onClick={() => void onRemoveLink(link.id)}
                      className="rounded-xl p-2.5 text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Lier un nouveau parent</h4>
          <div className="grid gap-4 rounded-[22px] border border-emerald-100 bg-emerald-50/20 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Sélectionner le parent">
              <select
                value={linkForm.parent_id}
                onChange={e => handleNewLinkFieldChange('parent_id', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                <option value="">Sélectionner un parent</option>
                {availableParents.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.first_name} {parent.last_name} ({parent.phone})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Relation">
              <select
                value={linkForm.relationship}
                onChange={e => handleNewLinkFieldChange('relationship', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                {RELATIONSHIP_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Priorité d'urgence">
              <input
                type="number"
                min={1}
                value={linkForm.emergency_priority}
                onChange={e => handleNewLinkFieldChange('emergency_priority', Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              />
            </FormField>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={linkForm.is_primary}
                  onChange={e => handleNewLinkFieldChange('is_primary', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Définir comme responsable principal
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={linkForm.is_billing_contact}
                  onChange={e => handleNewLinkFieldChange('is_billing_contact', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Définir comme responsable de paiement (financier)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={linkForm.is_pickup_authorized}
                  onChange={e => handleNewLinkFieldChange('is_pickup_authorized', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Autoriser la récupération de l'élève
              </label>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <FormField label="Notes / Autorisations particulières">
                <input
                  type="text"
                  value={linkForm.notes}
                  onChange={e => handleNewLinkFieldChange('notes', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  placeholder="Ex: Autorisé à récupérer l'enfant uniquement le vendredi après-midi."
                />
              </FormField>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
