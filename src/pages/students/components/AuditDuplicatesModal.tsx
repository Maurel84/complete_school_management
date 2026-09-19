import { useState } from 'react';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import { AlertTriangle, Trash2, Eye, CheckCircle2, Copy, Users } from 'lucide-react';
import type { Student } from '../../../types';

interface AuditDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  byMatricule: { key: string; list: any[] }[];
  byName: { key: string; list: any[] }[];
  onDeleteStudent: (id: string) => Promise<void>;
  onSelectStudent: (student: Student) => void;
}

export default function AuditDuplicatesModal({
  isOpen,
  onClose,
  byMatricule,
  byName,
  onDeleteStudent,
  onSelectStudent,
}: AuditDuplicatesModalProps) {
  const [tab, setTab] = useState<'name' | 'matricule'>('name');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalDuplicateGroups = byName.length + byMatricule.length;

  async function handleDelete(student: any) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer/archiver l'élève doublon ${student.first_name} ${student.last_name} (${student.matricule}) ?`)) {
      return;
    }
    setDeletingId(student.id);
    try {
      await onDeleteStudent(student.id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vérification & Audit des Doublons Élèves"
      size="lg"
    >
      <div className="space-y-5">
        {/* Header summary banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${totalDuplicateGroups > 0 ? 'bg-amber-50/80 border-amber-200 text-amber-950' : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'}`}>
          <div className="flex items-center gap-3">
            {totalDuplicateGroups > 0 ? (
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-sm">
                {totalDuplicateGroups > 0
                  ? `${totalDuplicateGroups} groupe(s) de doublons potentiel(s) détecté(s)`
                  : 'Aucun doublon détecté dans la base d\'élèves'}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {totalDuplicateGroups > 0
                  ? 'Examinez les doublons par nom/prénom ou matricule et supprimez l\'entrée superflue.'
                  : 'Tous les élèves enregistrés ont des matricules et identités uniques.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('name')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${tab === 'name' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white/80 text-slate-700 hover:bg-white'}`}
            >
              Par Nom & Prénom ({byName.length})
            </button>
            <button
              onClick={() => setTab('matricule')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${tab === 'matricule' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white/80 text-slate-700 hover:bg-white'}`}
            >
              Par Matricule ({byMatricule.length})
            </button>
          </div>
        </div>

        {/* Tab content: Name duplicates */}
        {tab === 'name' && (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {byName.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                <Users size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                Aucun doublon de nom et prénom détecté.
              </div>
            ) : (
              byName.map((group, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Copy size={16} className="text-amber-500" />
                      {group.key}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {group.list.length} entrées identiques
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.list.map((student: any) => (
                      <div key={student.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {student.last_name.toUpperCase()} {student.first_name}
                          </p>
                          <p className="text-slate-500 font-mono">
                            Matricule : <strong className="text-slate-700">{student.matricule || '-'}</strong> | Classe : <strong className="text-slate-700">{student.class?.name || 'Non affecté'}</strong> | Sexe : {student.sex || '-'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => onSelectStudent(student)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-1 transition"
                            title="Voir la fiche"
                          >
                            <Eye size={13} /> Fiche
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            disabled={deletingId === student.id}
                            className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold flex items-center gap-1 transition disabled:opacity-50"
                            title="Supprimer ce doublon"
                          >
                            <Trash2 size={13} /> {deletingId === student.id ? '...' : 'Supprimer'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab content: Matricule duplicates */}
        {tab === 'matricule' && (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {byMatricule.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                Aucun doublon de matricule détecté. Tous les matricules sont uniques.
              </div>
            ) : (
              byMatricule.map((group, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-sm font-mono flex items-center gap-2">
                      <Copy size={16} className="text-amber-500" />
                      Matricule : {group.key}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {group.list.length} élèves partagent ce matricule
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.list.map((student: any) => (
                      <div key={student.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {student.last_name.toUpperCase()} {student.first_name}
                          </p>
                          <p className="text-slate-500 font-mono">
                            Classe : <strong className="text-slate-700">{student.class?.name || 'Non affecté'}</strong> | Sexe : {student.sex || '-'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => onSelectStudent(student)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-1 transition"
                          >
                            <Eye size={13} /> Fiche
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            disabled={deletingId === student.id}
                            className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold flex items-center gap-1 transition disabled:opacity-50"
                          >
                            <Trash2 size={13} /> {deletingId === student.id ? '...' : 'Supprimer'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
