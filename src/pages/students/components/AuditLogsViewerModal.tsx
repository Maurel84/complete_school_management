import { useState, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { formatDate, formatCurrency } from '../../../lib/utils';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  CreditCard,
  Trash2,
  Edit,
  Printer,
  FileText,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface AuditLogsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
}

export default function AuditLogsViewerModal({
  isOpen,
  onClose,
  schoolId,
}: AuditLogsViewerModalProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'payments' | 'edits' | 'deletes' | 'prints'>('all');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit_logs_viewer', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) {
        console.error('Failed to fetch audit logs', error);
        return [];
      }
      return data || [];
    },
    enabled: isOpen && !!schoolId,
    refetchInterval: isOpen ? 10000 : false, // Auto-refresh every 10 seconds when open
  });

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const details = log.details || {};
      const action = log.action || '';
      const actorName = (details.actor_name || details.user_name || '').toLowerCase();
      const actorEmail = (details.actor_email || details.user_email || '').toLowerCase();
      const studentName = (details.student_name || details.matricule || '').toLowerCase();
      const receiptNo = (details.receipt_number || '').toLowerCase();
      const term = search.trim().toLowerCase();

      // Search match
      const matchSearch =
        !term ||
        actorName.includes(term) ||
        actorEmail.includes(term) ||
        studentName.includes(term) ||
        receiptNo.includes(term) ||
        action.toLowerCase().includes(term);

      // Category filter match
      let matchFilter = true;
      if (filterType === 'payments') {
        matchFilter =
          action.includes('payment_tuition') ||
          action.includes('payment_canteen') ||
          action === 'payment_created';
      } else if (filterType === 'edits') {
        matchFilter =
          action.includes('updated') ||
          action.includes('family_links_saved') ||
          action.includes('edited');
      } else if (filterType === 'deletes') {
        matchFilter =
          action.includes('deleted') ||
          action.includes('archived') ||
          action.includes('removed');
      } else if (filterType === 'prints') {
        matchFilter = action.includes('printed') || action.includes('downloaded');
      }

      return matchSearch && matchFilter;
    });
  }, [logs, search, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const paymentsCount = logs.filter((l: any) =>
      (l.action || '').includes('payment_tuition') || (l.action || '').includes('payment_canteen')
    ).length;
    const editsCount = logs.filter((l: any) => (l.action || '').includes('updated')).length;
    const deletesCount = logs.filter((l: any) =>
      (l.action || '').includes('deleted') || (l.action || '').includes('archived')
    ).length;

    return { total, paymentsCount, editsCount, deletesCount };
  }, [logs]);

  function formatTime(isoString: string) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  }

  function getActionBadge(action: string) {
    if (action.includes('deleted') || action.includes('archived')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
          <Trash2 size={12} /> Suppression
        </span>
      );
    }
    if (action.includes('updated') || action.includes('edited')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
          <Edit size={12} /> Modification
        </span>
      );
    }
    if (action.includes('payment_tuition') || action.includes('payment_canteen')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          <CreditCard size={12} /> Encaissement
        </span>
      );
    }
    if (action.includes('printed')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
          <Printer size={12} /> Impression
        </span>
      );
    }
    if (action.includes('student_created')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
          Inscription élève
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
        Action
      </span>
    );
  }

  function renderActionDetails(log: any) {
    const action = log.action || '';
    const d = log.details || {};

    if (action === 'payment_updated') {
      return (
        <div>
          <p className="font-semibold text-slate-800">
            Correction versement N° <span className="font-mono text-amber-800">{d.receipt_number || '-'}</span>
          </p>
          <div className="flex flex-wrap gap-x-3 text-xs text-slate-600 mt-0.5">
            <span>Ancien : <strong className="text-slate-500 line-through">{formatCurrency(d.old_amount || 0)}</strong></span>
            <span>Nouveau : <strong className="text-emerald-700 font-bold">{formatCurrency(d.new_amount || 0)}</strong></span>
            {d.old_method !== d.new_method && (
              <span>Mode : {d.old_method} ➔ <strong>{d.new_method}</strong></span>
            )}
          </div>
          {d.notes && <p className="text-xs text-slate-500 italic mt-0.5">Motif : « {d.notes} »</p>}
        </div>
      );
    }

    if (action === 'payment_deleted') {
      return (
        <div>
          <p className="font-semibold text-red-700">
            Annulation versement N° <span className="font-mono">{d.receipt_number || '-'}</span>
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Montant supprimé : <strong className="text-red-700 font-bold">{formatCurrency(d.deleted_amount || d.amount || 0)}</strong> ({d.is_canteen ? 'Cantine' : 'Scolarité'})
          </p>
        </div>
      );
    }

    if (action.includes('payment_tuition_created') || action === 'payment_tuition_created') {
      return (
        <div>
          <p className="font-semibold text-emerald-800">
            Paiement Scolarité : <strong className="text-emerald-700">+{formatCurrency(d.amount || 0)}</strong>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Reçu N° <span className="font-mono font-bold text-slate-700">{d.receipt_number || '-'}</span>
            {d.student_name ? ` • Élève : ${d.student_name}` : ''}
            {d.payment_method ? ` • Mode : ${d.payment_method}` : ''}
          </p>
        </div>
      );
    }

    if (action.includes('payment_canteen_created') || action === 'payment_canteen_created') {
      return (
        <div>
          <p className="font-semibold text-teal-800">
            Paiement Cantine : <strong className="text-teal-700">+{formatCurrency(d.amount || 0)}</strong>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Reçu N° <span className="font-mono font-bold text-slate-700">{d.receipt_number || '-'}</span>
            {d.trimester ? ` • Trimestre ${d.trimester}` : ''}
            {d.student_name ? ` • Élève : ${d.student_name}` : ''}
          </p>
        </div>
      );
    }

    if (action === 'statement_printed') {
      return (
        <div>
          <p className="font-medium text-slate-800">
            Édition du relevé financier officiel
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Élève : <strong>{d.student_name || '-'}</strong> ({d.matricule || ''})
          </p>
        </div>
      );
    }

    if (action === 'receipt_printed') {
      return (
        <div>
          <p className="font-medium text-slate-800">
            Impression du reçu N° <span className="font-mono">{d.receipt_number || '-'}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Élève : {d.student_name || '-'} • Montant : {formatCurrency(d.amount || 0)}
          </p>
        </div>
      );
    }

    if (action === 'student_created' || action === 'student_updated' || action === 'student_archived') {
      const labels: Record<string, string> = {
        student_created: 'Nouvelle inscription élève',
        student_updated: 'Mise à jour dossier élève',
        student_archived: 'Archivage dossier élève',
      };
      return (
        <div>
          <p className="font-semibold text-slate-800">{labels[action] || action}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Matricule : <strong>{d.matricule || '-'}</strong>
            {d.first_name || d.last_name ? ` • Nom : ${d.last_name || ''} ${d.first_name || ''}` : ''}
          </p>
        </div>
      );
    }

    return (
      <div className="text-xs text-slate-600">
        <p className="font-medium text-slate-800">{action}</p>
        <p className="text-slate-400 mt-0.5">{JSON.stringify(d)}</p>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Journal d'Audit & Contrôle des Actions Utilisateurs"
      size="xl"
      actions={
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Surveillance active en temps réel</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Fermer
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Subtitle & KPI Cards */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Total Actions</p>
            <p className="text-xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-[11px] font-bold text-emerald-700 uppercase">Encaissements</p>
            <p className="text-xl font-black text-emerald-800 mt-1">{stats.paymentsCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-[11px] font-bold text-amber-700 uppercase">Rectifications</p>
            <p className="text-xl font-black text-amber-800 mt-1">{stats.editsCount}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-[11px] font-bold text-red-700 uppercase">Suppressions</p>
            <p className="text-xl font-black text-red-800 mt-1">{stats.deletesCount}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher collaborateur, élève, reçu..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Tous ({logs.length})
            </button>
            <button
              onClick={() => setFilterType('payments')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterType === 'payments'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Paiements
            </button>
            <button
              onClick={() => setFilterType('edits')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterType === 'edits'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Modifications
            </button>
            <button
              onClick={() => setFilterType('deletes')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterType === 'deletes'
                  ? 'bg-red-700 text-white'
                  : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
              }`}
            >
              Suppressions
            </button>
            <button
              onClick={() => setFilterType('prints')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterType === 'prints'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              Impressions
            </button>

            <button
              onClick={() => void refetch()}
              title="Rafraîchir les logs"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* Logs Table / List */}
        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <RefreshCw className="animate-spin inline-block mr-2 text-slate-400" size={16} />
              Chargement du journal d'audit...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              Aucune action enregistrée ne correspond à vos critères de recherche.
            </div>
          ) : (
            filteredLogs.map((log: any) => {
              const d = log.details || {};
              const actorName = d.actor_name || d.user_name || 'Collaborateur';
              const actorRole = d.actor_role || d.user_role || 'Staff';
              const actorEmail = d.actor_email || d.user_email || '';

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-2xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                        <User size={13} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">{actorName}</span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                            {actorRole}
                          </span>
                        </div>
                        {actorEmail && <span className="text-[10px] text-slate-400 block">{actorEmail}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        <Clock size={11} />
                        <span>{formatDate(log.created_at)} à {formatTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-0.5 pl-9">
                    {renderActionDetails(log)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
