import { useState, useEffect } from 'react';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import { formatDate, formatCurrency, parsePhoneNumbers } from '../../../lib/utils';
import { Download, Link2, Printer, CreditCard, Utensils, FileText, Edit, Trash2, Check, X, Phone, MessageCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { IVORY_COAST_COAT_OF_ARMS_BASE64 } from '../../../lib/armoirieBase64';
import type { AcademicYear, Class, School, Student } from '../../../types';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  familyLinks: any[];
  loading: boolean;
  canManageStudents: boolean;
  onManageFamilyClick: () => void;
  onStudentCardAction: (mode: 'print' | 'download') => void;
  onMakePayment?: (student: any, type: 'tuition' | 'canteen') => void;
  onPrintStatement?: (student: any) => void;
  onPrintReceipt?: (payment: any, isCanteen: boolean) => void;
  onEditPayment?: (payment: any, isCanteen: boolean) => void;
  onDeletePayment?: (payment: any, isCanteen: boolean) => void;
  onUpdateMatricule?: (studentId: string, newMatricule: string) => Promise<void>;
  isGeneralAdmin?: boolean;
  academicYear: AcademicYear | null;
  school: School | null;
}

const statusLabels: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  transferred: 'Transféré',
  graduated: 'Diplômé',
};

const relationshipLabels: Record<string, string> = {
  pere: 'Père',
  mere: 'Mère',
  tuteur: 'Tuteur',
  autre: 'Autre',
};

export default function StudentDetailModal({
  isOpen,
  onClose,
  student,
  familyLinks,
  loading,
  canManageStudents,
  onManageFamilyClick,
  onStudentCardAction,
  onMakePayment,
  onPrintStatement,
  onPrintReceipt,
  onEditPayment,
  onDeletePayment,
  onUpdateMatricule,
  isGeneralAdmin,
  academicYear,
  school,
}: StudentDetailModalProps) {
  if (!student) return null;

  const [localMatricule, setLocalMatricule] = useState(student.matricule || '');
  const [isEditingMatricule, setIsEditingMatricule] = useState(false);
  const [inputMatricule, setInputMatricule] = useState(student.matricule || '');
  const [savingMatricule, setSavingMatricule] = useState(false);
  const [matriculeError, setMatriculeError] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setLocalMatricule(student.matricule || '');
      setInputMatricule(student.matricule || '');
      setIsEditingMatricule(false);
      setMatriculeError(null);
    }
  }, [student]);

  async function handleSaveMatricule() {
    const clean = inputMatricule.trim().toUpperCase();
    if (!clean) {
      setMatriculeError('Le numéro matricule ne peut pas être vide');
      return;
    }

    setSavingMatricule(true);
    setMatriculeError(null);

    try {
      const { error } = await supabase
        .from('students')
        .update({ matricule: clean })
        .eq('id', student?.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Ce matricule "${clean}" est déjà attribué à un autre élève.`);
        }
        throw error;
      }

      setLocalMatricule(clean);
      if (student) {
        student.matricule = clean;
      }
      setIsEditingMatricule(false);

      if (onUpdateMatricule && student?.id) {
        await onUpdateMatricule(student.id, clean);
      }
    } catch (err: any) {
      setMatriculeError(err.message || 'Erreur lors de la mise à jour du matricule');
    } finally {
      setSavingMatricule(false);
    }
  }

  const billingOrPrimaryGuardian =
    familyLinks.find(link => link.is_billing_contact)?.parent ||
    familyLinks.find(link => link.is_primary)?.parent ||
    familyLinks[0]?.parent;

  const guardianName = billingOrPrimaryGuardian
    ? `${billingOrPrimaryGuardian.first_name} ${billingOrPrimaryGuardian.last_name}`
    : (student as any).parent_name || 'Non renseigné';

  const guardianPhone = billingOrPrimaryGuardian?.phone || (student as any).parent_phone || 'Non renseigné';
  const parsedGuardian = parsePhoneNumbers(guardianPhone);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fiche élève & Guichet d'actions" size="xl">
      {loading ? (
        <div className="py-14 text-center text-sm text-slate-500">Chargement du dossier élève...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={`${student.first_name} ${student.last_name}`}
                      className="h-24 w-24 rounded-[28px] border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-100 text-2xl font-bold text-emerald-700">
                      {student.first_name?.[0]}
                      {student.last_name?.[0]}
                    </div>
                  )}
                  <div>
                    <h3 className="display-font text-2xl font-semibold text-slate-900">
                      {student.first_name} {student.last_name}
                    </h3>

                    {/* Zone Matricule Modifiable (National Ministère ou Scolaire) */}
                    <div className="mt-1">
                      {isEditingMatricule ? (
                        <div className="flex items-center gap-1.5 bg-blue-50 p-1.5 rounded-xl border border-blue-200 mt-1">
                          <input
                            type="text"
                            value={inputMatricule}
                            onChange={e => setInputMatricule(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-blue-300 text-xs font-mono font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Matricule National CP1+"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveMatricule}
                            disabled={savingMatricule}
                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs"
                            title="Valider le matricule"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingMatricule(false);
                              setInputMatricule(localMatricule);
                              setMatriculeError(null);
                            }}
                            className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                            title="Annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                            Matricule: {localMatricule}
                          </span>
                          {canManageStudents && (
                            <button
                              onClick={() => {
                                setInputMatricule(localMatricule);
                                setIsEditingMatricule(true);
                                setMatriculeError(null);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                              title="Modifier le matricule (ex: attribuer le matricule national du Ministère)"
                            >
                              <Edit size={12} /> Modifier (National CP1+)
                            </button>
                          )}
                        </div>
                      )}
                      {matriculeError && (
                        <p className="text-xs text-red-600 font-semibold mt-1">{matriculeError}</p>
                      )}
                    </div>

                    <div className="mt-2.5">
                      <Badge status={student.status} label={statusLabels[student.status] || student.status} />
                    </div>
                  </div>
                </div>

                {canManageStudents && (
                  <button
                    onClick={onManageFamilyClick}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Link2 size={16} /> Gérer la famille
                  </button>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <span className="text-slate-500">Sexe :</span>{' '}
                  <span className="font-medium text-slate-800">
                    {student.sex === 'M' ? 'Masculin' : 'Féminin'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Date de naissance :</span>{' '}
                  <span className="font-medium text-slate-800">
                    {student.date_of_birth ? formatDate(student.date_of_birth) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Classe :</span>{' '}
                  <span className="font-medium text-slate-800">
                    {(student as any).class?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Lieu :</span>{' '}
                  <span className="font-medium text-slate-800">{student.birth_place || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Nationalité :</span>{' '}
                  <span className="font-medium text-slate-800">{student.nationality || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Téléphone contact :</span>{' '}
                  <span className="font-medium text-slate-800">
                    {student.phone ? (
                      (() => {
                        const p = parsePhoneNumbers(student.phone);
                        if (p.isSingleNumber) return `📞 ${p.mainPhone} (Numéro unique)`;
                        return `📞 ${p.mainPhone}${p.whatsappPhone ? ` | 💬 WA: ${p.whatsappPhone}` : ''}`;
                      })()
                    ) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Email :</span>{' '}
                  <span className="font-medium text-slate-800">{student.email || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Adresse :</span>{' '}
                  <span className="font-medium text-slate-800">{student.address || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">École précédente :</span>{' '}
                  <span className="font-medium text-slate-800">{student.previous_school || '-'}</span>
                </div>
              </div>

              {/* Point Financier / Guichet Unique */}
              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/60 pb-3">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Guichet Financier &amp; Facturation</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cycle / Plan : <strong className="text-slate-800">{(student as any).financial_plan_name || (student as any).class?.name || 'Standard'}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {onMakePayment && (
                      <>
                        <button
                          type="button"
                          onClick={() => onMakePayment(student, 'tuition')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          <CreditCard size={14} /> Payer Scolarité
                        </button>
                        <button
                          type="button"
                          onClick={() => onMakePayment(student, 'canteen')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition"
                        >
                          <Utensils size={14} /> Payer Cantine
                        </button>
                      </>
                    )}
                    {onPrintStatement && (
                      <button
                        type="button"
                        onClick={() => onPrintStatement(student)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                        title="Imprimer le relevé de compte officiel de l'élève"
                      >
                        <FileText size={14} /> Relevé Financier
                      </button>
                    )}
                  </div>
                </div>

                {/* KPI stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Attendu</p>
                    <p className="text-base font-bold text-slate-900 mt-1">
                      {formatCurrency((student as any).financial_expected || 0)}
                    </p>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 shadow-xs">
                    <p className="text-[10px] text-emerald-700 uppercase font-semibold">Total Encaissé</p>
                    <p className="text-base font-bold text-emerald-700 mt-1">
                      {formatCurrency((student as any).financial_paid || 0)}
                    </p>
                  </div>
                  <div className="bg-red-50/60 border border-red-100 rounded-2xl p-3 shadow-xs">
                    <p className="text-[10px] text-red-700 uppercase font-semibold">Solde Restant</p>
                    <p className={`text-base font-bold mt-1 ${(student as any).financial_remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatCurrency((student as any).financial_remaining || 0)}
                    </p>
                  </div>
                </div>

                {/* Historique des versements de l'élève */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-700">Historique des versements :</p>
                    {(((student as any).payments?.length || 0) + ((student as any).canteen_payments?.length || 0) > 0) && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {((student as any).payments?.length || 0) + ((student as any).canteen_payments?.length || 0)} versement(s)
                      </span>
                    )}
                  </div>
                  {(((student as any).payments && (student as any).payments.length > 0) ||
                    ((student as any).canteen_payments && (student as any).canteen_payments.length > 0)) ? (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {((student as any).payments || []).map((pay: any) => (
                        <div
                          key={pay.id || pay.receipt_number}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">Scolarité - Reçu N° {pay.receipt_number}</span>
                            <span className="text-slate-400 ml-2">{pay.payment_date ? formatDate(pay.payment_date) : '-'}</span>
                            <span className="text-slate-500 ml-2 italic">({pay.payment_method})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-700">+{formatCurrency(pay.amount)}</span>
                            {onPrintReceipt && (
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(pay, false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition border border-transparent hover:border-emerald-200"
                                title="Imprimer le reçu officiel"
                              >
                                <Printer size={14} />
                              </button>
                            )}
                            {isGeneralAdmin && onEditPayment && (
                              <button
                                type="button"
                                onClick={() => onEditPayment(pay, false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition border border-transparent hover:border-amber-200"
                                title="Modifier ce versement (Correction)"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {isGeneralAdmin && onDeletePayment && (
                              <button
                                type="button"
                                onClick={() => onDeletePayment(pay, false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                                title="Supprimer ce versement erroné"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {((student as any).canteen_payments || []).map((cp: any) => (
                        <div
                          key={cp.id || cp.receipt_number}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-teal-100 text-xs shadow-2xs"
                        >
                          <div>
                            <span className="font-semibold text-teal-800">Cantine T{cp.trimester} - Reçu N° {cp.receipt_number}</span>
                            <span className="text-slate-400 ml-2">{cp.payment_date ? formatDate(cp.payment_date) : '-'}</span>
                            <span className="text-slate-500 ml-2 italic">({cp.payment_method})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-teal-700">+{formatCurrency(cp.amount)}</span>
                            {onPrintReceipt && (
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(cp, true)}
                                className="p-1 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition border border-transparent hover:border-teal-200"
                                title="Imprimer le reçu cantine"
                              >
                                <Printer size={14} />
                              </button>
                            )}
                            {isGeneralAdmin && onEditPayment && (
                              <button
                                type="button"
                                onClick={() => onEditPayment(cp, true)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition border border-transparent hover:border-amber-200"
                                title="Modifier ce paiement de cantine"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {isGeneralAdmin && onDeletePayment && (
                              <button
                                type="button"
                                onClick={() => onDeletePayment(cp, true)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                                title="Supprimer ce versement cantine erroné"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-400 italic">
                      Aucun versement n'a encore été enregistré pour cet élève. Utilisez les boutons ci-dessus pour encaisser.
                    </div>
                  )}
                </div>
              </div>

              {student.medical_info && (
                <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Informations médicales</p>
                  <p className="mt-2 text-sm leading-6 text-amber-700">{student.medical_info}</p>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 p-5 text-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45)] animate-in space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/70 font-semibold">Carte scolaire officielle</p>
                  <h3 className="display-font mt-1 text-lg font-bold">Modèle Officiel Recto Unique (CR80)</h3>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-1.5 text-right border border-white/15">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300 font-bold">Format PVC</p>
                  <p className="text-xs font-bold text-white">86 × 54 mm</p>
                </div>
              </div>

              {/* SINGLE-FACED APPROVED CARD PREVIEW */}
              <div className="max-w-md mx-auto w-full">
                <div className="relative rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-xl overflow-hidden aspect-[86/54] flex flex-col justify-between p-2.5 select-none">
                  
                  {/* Background Artwork: Orange top-left, Green bottom-right watercolor splashes */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 860 540" fill="none">
                    <defs>
                      <radialGradient id="modalOrangeGlow" cx="0" cy="0" r="480" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FF6F00" stopOpacity="0.95" />
                        <stop offset="35%" stopColor="#FF9100" stopOpacity="0.80" />
                        <stop offset="65%" stopColor="#FFB300" stopOpacity="0.45" />
                        <stop offset="85%" stopColor="#FFD54F" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#FFF8E1" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="modalGreenGlow" cx="860" cy="540" r="500" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#00695C" stopOpacity="0.95" />
                        <stop offset="30%" stopColor="#00897B" stopOpacity="0.8" />
                        <stop offset="60%" stopColor="#009E60" stopOpacity="0.5" />
                        <stop offset="80%" stopColor="#4DB6AC" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#E0F2F1" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="860" height="540" fill="#FCFCFD" />
                    <path d="M-20 -20 L380 -20 C320 30 260 65 180 85 C110 102 50 145 -20 180 Z" fill="url(#modalOrangeGlow)" />
                    <path d="M-10 0 C80 15 220 10 390 45 C450 60 520 80 560 110 C500 125 430 115 360 105 C260 90 140 85 -10 65 Z" fill="#E65100" opacity="0.75" />
                    <path d="M880 560 L480 560 C530 500 580 450 670 420 C750 395 810 350 880 310 Z" fill="url(#modalGreenGlow)" />
                    <path d="M870 540 C770 515 640 500 480 470 C420 455 350 430 300 390 C360 380 430 395 510 410 C620 430 740 445 870 470 Z" fill="#00796B" opacity="0.8" />
                  </svg>

                  {/* Watermark Coat of Arms */}
                  <img
                    src={IVORY_COAST_COAT_OF_ARMS_BASE64}
                    alt="Armoiries"
                    className="absolute right-4 top-8 h-28 w-auto opacity-15 pointer-events-none z-1"
                  />

                  {/* Top Header */}
                  <div className="relative z-10 text-center pr-8 pl-1">
                    <p className="text-[7.5px] font-black uppercase text-slate-900 tracking-tight leading-none font-sans">
                      MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION
                    </p>
                    <div className="flex h-[2px] w-36 mx-auto my-0.5 border border-slate-900 overflow-hidden">
                      <div className="flex-1 bg-[#FF7900]" />
                      <div className="flex-1 bg-[#FFFFFF]" />
                      <div className="flex-1 bg-[#009E60]" />
                    </div>
                    <p className="text-[6.8px] font-bold uppercase text-slate-900 tracking-wider leading-none">
                      {((student as any).class?.name && /section|maternelle|creche|garderie|petite/i.test((student as any).class?.name))
                        ? 'CENTRE DE PROTECTION DE LA PETITE ENFANCE'
                        : 'ÉTABLISSEMENT D’ENSEIGNEMENT SCOLAIRE'}
                    </p>
                    <p className="text-[8.5px] font-black uppercase text-slate-950 tracking-tight leading-tight mt-0.5">
                      {school?.name || 'GROUPE SCOLAIRE LA HARPE DE DAVID'}
                    </p>
                  </div>

                  {/* Top-Right Circular Seal */}
                  <div className="absolute top-2 right-2.5 h-8 w-8 rounded-full border border-red-700 bg-white flex items-center justify-center shadow-xs overflow-hidden z-20">
                    {school?.logo_url ? (
                      <img src={school.logo_url} alt={school.name} className="h-full w-full object-contain rounded-full" />
                    ) : (
                      <div className="text-[7px] font-bold text-amber-700">★</div>
                    )}
                  </div>

                  {/* Card Body: Photo (Left) + Details (Right) */}
                  <div className="relative z-10 flex gap-2.5 items-stretch flex-1 mt-1">
                    
                    {/* Left: Photo & Direction Signature */}
                    <div className="w-24 flex flex-col justify-between flex-shrink-0">
                      <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs bg-slate-100 relative">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-[7px] font-bold text-slate-400">
                            PHOTO
                          </div>
                        )}
                      </div>

                      <div className="mt-0.5">
                        <p className="text-[6.5px] font-bold italic underline text-slate-900 leading-none">Signature de la Direction</p>
                        <div className="h-5 flex items-center gap-1 mt-0.5">
                          {school?.stamp_url || school?.signature_url ? (
                            <div className="flex items-center h-full">
                              {school?.stamp_url && <img src={school.stamp_url} alt="Cachet" className="h-5 max-w-[20px] object-contain" />}
                              {school?.signature_url && <img src={school.signature_url} alt="Signature" className="h-4 max-w-[28px] object-contain -ml-1" />}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="h-4 w-4 rounded-full border border-dashed border-blue-600 flex items-center justify-center text-[4px] font-black text-blue-700">DIR</div>
                              <span className="text-[8px] font-serif italic text-blue-800 font-bold">Direction</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Student Information */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 pr-1">
                      <div>
                        <p className="text-[6.5px] italic text-slate-800 leading-none">Nom</p>
                        <p className="text-[11px] font-black text-black uppercase leading-tight tracking-tight truncate">{student.last_name}</p>
                      </div>

                      <div className="mt-0.5">
                        <p className="text-[6.5px] italic text-slate-800 leading-none">Prénom(s)</p>
                        <p className="text-[9.5px] font-extrabold text-black uppercase leading-tight tracking-tight truncate">{student.first_name}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mt-0.5">
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">Date de Naissance</p>
                          <p className="text-[8.5px] font-bold text-black leading-tight">
                            {student.date_of_birth ? formatDate(student.date_of_birth) : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">Sexe</p>
                          <p className="text-[8.5px] font-bold text-black leading-tight">{student.sex || 'F'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mt-0.5">
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">Lieu de Naissance</p>
                          <p className="text-[8px] font-bold text-black uppercase leading-tight truncate">
                            {(student as any).place_of_birth || student.birth_place || 'ADIAKE (CIV)'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">N° d'urgence</p>
                          <p className="text-[8.5px] font-bold text-black font-mono leading-tight truncate">
                            {parsedGuardian.mainPhone || guardianPhone || '0709176869'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-0.5">
                        <p className="text-[6px] italic text-slate-800 leading-none">Classe</p>
                        <p className="text-[10px] font-black text-black uppercase leading-tight tracking-tight">
                          {(student as any).class?.name || 'PETITE SECTION'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mt-0.5">
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">Année Scolaire</p>
                          <p className="text-[8.5px] font-bold text-black leading-tight">{academicYear?.name || '2025-2026'}</p>
                        </div>
                        <div>
                          <p className="text-[6px] italic text-slate-800 leading-none">Matricule</p>
                          <p className="text-[8px] font-bold text-black font-mono leading-tight">{localMatricule}</p>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => onStudentCardAction('print')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-slate-900 transition hover:bg-slate-100 shadow-sm"
                >
                  <Printer size={15} /> Imprimer la Carte
                </button>
                <button
                  onClick={() => onStudentCardAction('download')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  <Download size={15} /> Télécharger HTML
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm animate-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="display-font text-xl font-semibold text-slate-900">Famille rattachée</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Responsables légaux, contact principal, contact financier et autorisations.
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {familyLinks.length} lien(s)
              </div>
            </div>

            {familyLinks.length === 0 ? (
              <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                Aucun parent n'est encore rattaché à cet élève.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {familyLinks.map(link => (
                  <div key={link.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {link.parent
                            ? `${link.parent.first_name} ${link.parent.last_name}`
                            : 'Parent'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {relationshipLabels[link.relationship] || link.relationship}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {link.is_primary && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                            Principal
                          </span>
                        )}
                        {link.is_billing_contact && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Paiement
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 text-xs text-slate-500">
                      <div>
                        Tél : <span className="font-medium text-slate-700">{link.parent?.phone || '-'}</span>
                      </div>
                      <div>
                        Email :{' '}
                        <span className="font-medium text-slate-700">{link.parent?.email || '-'}</span>
                      </div>
                      <div className="col-span-2">
                        Récupération autorisée :{' '}
                        <span
                          className={`font-semibold ${
                            link.is_pickup_authorized ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {link.is_pickup_authorized ? 'Oui' : 'Non'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
