import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import DataTable from '../../components/common/DataTable';
import { formatDate } from '../../lib/utils';
import type { Document } from '../../types';
import { FileText, Download, Upload } from 'lucide-react';

export default function DocumentsPage() {
  const { school } = useApp();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (school) fetchDocuments(); }, [school]);

  async function fetchDocuments() {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').eq('school_id', school!.id).order('created_at', { ascending: false });
    setDocuments((data as Document[]) || []);
    setLoading(false);
  }

  const docTypeLabels: Record<string, string> = {
    certificate: 'Certificat de scolarité',
    receipt: 'Reçu de paiement',
    report_card: 'Bulletin',
    class_list: 'Liste de classe',
    financial_report: 'Rapport financier',
    hr_report: 'Rapport RH',
    other: 'Autre',
  };

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'document_type', label: 'Type', render: (d: Document) => docTypeLabels[d.document_type] || d.document_type },
    { key: 'entity_type', label: 'Catégorie', render: (d: Document) => (
      <span className="capitalize">{d.entity_type}</span>
    )},
    { key: 'created_at', label: 'Date', render: (d: Document) => formatDate(d.created_at) },
    { key: 'actions', label: 'Actions', render: (d: Document) => d.file_url ? (
      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-100 rounded inline-flex items-center gap-1 text-blue-600 text-sm">
        <Download size={14} /> Télécharger
      </a>
    ) : <span className="text-gray-400 text-sm">-</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">Certificats, reçus, bulletins et exports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Certificats de scolarité', count: documents.filter(d => d.document_type === 'certificate').length, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'Reçus de paiement', count: documents.filter(d => d.document_type === 'receipt').length, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Bulletins', count: documents.filter(d => d.document_type === 'report_card').length, color: 'bg-teal-50 text-teal-600 border-teal-100' },
        ].map((item, i) => (
          <div key={i} className={`p-5 rounded-xl border ${item.color}`}>
            <div className="flex items-center gap-3">
              <FileText size={20} />
              <div>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm opacity-70">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={documents as any[]} searchKeys={['title', 'document_type']} searchPlaceholder="Rechercher un document..." loading={loading} />
    </div>
  );
}
