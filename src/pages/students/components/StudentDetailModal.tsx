import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import { formatDate } from '../../../lib/utils';
import { Download, Link2, Printer } from 'lucide-react';
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
  academicYear,
  school,
}: StudentDetailModalProps) {
  if (!student) return null;

  const billingOrPrimaryGuardian =
    familyLinks.find(link => link.is_billing_contact)?.parent ||
    familyLinks.find(link => link.is_primary)?.parent ||
    familyLinks[0]?.parent;

  const guardianName = billingOrPrimaryGuardian
    ? `${billingOrPrimaryGuardian.first_name} ${billingOrPrimaryGuardian.last_name}`
    : 'Non défini';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fiche élève" size="xl">
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
                    <p className="mt-1 text-sm text-slate-500">Matricule: {student.matricule}</p>
                    <div className="mt-3">
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
                  <span className="text-slate-500">Téléphone :</span>{' '}
                  <span className="font-medium text-slate-800">{student.phone || '-'}</span>
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

              {student.medical_info && (
                <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Informations médicales</p>
                  <p className="mt-2 text-sm leading-6 text-amber-700">{student.medical_info}</p>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-800 p-5 text-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45)] animate-in">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/70">Carte scolaire</p>
                  <h3 className="display-font mt-2 text-xl font-semibold">Édition premium</h3>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Année</p>
                  <p className="text-sm font-semibold">{academicYear?.name || 'En cours'}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-white p-4 text-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Identité</p>
                    <h4 className="display-font mt-2 line-clamp-1 text-lg font-semibold">
                      {student.first_name} {student.last_name}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">{student.matricule}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {(student as any).class?.name || 'Classe'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {academicYear?.name || 'Année active'}
                      </span>
                    </div>
                  </div>
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.first_name}
                      className="h-20 w-20 rounded-[22px] border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-slate-100 text-xs font-bold text-slate-400">
                      PHOTO
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Responsable principal</p>
                  <p className="mt-2 text-sm font-semibold">{guardianName}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => onStudentCardAction('print')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  <Printer size={16} /> Imprimer
                </button>
                <button
                  onClick={() => onStudentCardAction('download')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  <Download size={16} /> Télécharger
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
