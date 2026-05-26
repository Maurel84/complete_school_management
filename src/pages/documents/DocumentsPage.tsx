import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../lib/utils';
import type { Document } from '../../types';
import { Download, FileText, ImageIcon, Receipt } from 'lucide-react';

export default function DocumentsPage() {
  const { school } = useApp();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school) return;
    void fetchDocuments();
  }, [school]);

  async function fetchDocuments() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').eq('school_id', school.id).order('created_at', { ascending: false });
    setDocuments((data as Document[]) || []);
    setLoading(false);
  }

  const docTypeLabels: Record<string, string> = {
    certificate: 'Certificat de scolarité',
    receipt: 'Reçu de paiement',
    report_card: 'Bulletin',
    student_card: 'Carte scolaire',
    class_list: 'Liste de classe',
    financial_report: 'Rapport financier',
    hr_report: 'Rapport RH',
    other: 'Autre',
  };

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'document_type', label: 'Type', render: (document: Document) => docTypeLabels[document.document_type] || document.document_type },
    { key: 'entity_type', label: 'Catégorie', render: (document: Document) => <span className="capitalize">{document.entity_type}</span> },
    { key: 'created_at', label: 'Date', render: (document: Document) => formatDate(document.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      render: (document: Document) => document.file_url ? (
        <a href={document.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200">
          <Download size={14} /> Télécharger
        </a>
      ) : (
        <span className="text-sm text-slate-400">-</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="display-font text-3xl font-semibold text-slate-900">Documents & pièces éditables</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Les reçus, cartes scolaires, attestations et documents administratifs reprennent l’identité visuelle de l’école.
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Aperçu d’en-tête document</p>
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                {school?.logo_url ? (
                  <img src={school.logo_url} alt={school.name} className="h-14 w-14 rounded-2xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div>
                  <p className="display-font text-lg font-semibold text-slate-900">{school?.name || 'École primaire'}</p>
                  <p className="text-xs text-slate-500">Logo utilisé pour les reçus et documents officiels</p>
                </div>
              </div>
              <div className="mt-4 flex gap-3 text-sm text-slate-500">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                  <Receipt size={14} /> Reçu
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                  <FileText size={14} /> Attestation
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                  <FileText size={14} /> Carte scolaire
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Certificats de scolarité', count: documents.filter(document => document.document_type === 'certificate').length, color: 'blue' as const },
          { label: 'Reçus de paiement', count: documents.filter(document => document.document_type === 'receipt').length, color: 'green' as const },
          { label: 'Cartes scolaires', count: documents.filter(document => document.document_type === 'student_card').length, color: 'amber' as const },
          { label: 'Bulletins', count: documents.filter(document => document.document_type === 'report_card').length, color: 'teal' as const },
        ].map(item => (
          <div key={item.label} className="surface-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <FileText size={18} />
              </div>
              <div>
                <p className="display-font text-2xl font-semibold text-slate-900">{item.count}</p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && !loading ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="Aucun document généré"
          description="Dès que les reçus, cartes scolaires, bulletins ou attestations seront générés, ils apparaîtront ici avec le logo de l’école."
        />
      ) : (
        <DataTable columns={columns} data={documents as any[]} searchKeys={['title', 'document_type']} searchPlaceholder="Rechercher un document..." loading={loading} />
      )}
    </div>
  );
}
