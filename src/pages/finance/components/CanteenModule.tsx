import DataTable from '../../../components/common/DataTable';
import type { Column } from '../../../components/common/DataTable';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Download, Printer, Utensils } from 'lucide-react';

interface CanteenModuleProps {
  canteenPayments: any[];
  onPrintReceipt: (payment: any) => void;
}

export default function CanteenModule({
  canteenPayments = [],
  onPrintReceipt,
}: CanteenModuleProps) {
  const columns: Column<any>[] = [
    { key: 'receipt_number', label: 'Reçu' },
    {
      key: 'student',
      label: 'Élève',
      render: row => (row.student ? `${row.student.first_name} ${row.student.last_name}` : '-'),
    },
    {
      key: 'class',
      label: 'Classe',
      render: row => row.student?.class?.name || '-',
    },
    {
      key: 'trimester',
      label: 'Trimestre',
      render: row => `Trimestre ${row.trimester}`,
    },
    { key: 'amount', label: 'Montant', render: row => formatCurrency(Number(row.amount)) },
    {
      key: 'payment_method',
      label: 'Mode',
      render: row => row.payment_method === 'cash' ? 'Espèces' : row.payment_method,
    },
    { key: 'payment_date', label: 'Date', render: row => formatDate(row.payment_date) },
    {
      key: 'processor',
      label: 'Caissier',
      render: row => (row.processor ? `${row.processor.first_name} ${row.processor.last_name}` : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <button
          onClick={() => onPrintReceipt(row)}
          className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 transition"
        >
          <Printer size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Maternelle Rates */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-800 mb-4">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Utensils size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Tarifs Maternelle</h4>
                <p className="text-xs text-slate-500">Cycles Maternelle</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center my-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400">Mensuel</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{formatCurrency(7000)}</p>
              </div>
              <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                <p className="text-emerald-700 font-semibold">Trimestriel</p>
                <p className="font-bold text-emerald-800 text-sm mt-1">{formatCurrency(21000)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400">Annuel</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{formatCurrency(56000)}</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-3">
            *Rappel La Harpe de David* : L'enregistrement n'autorise que les montants trimestriels exigibles de 21 000 FCFA.
          </p>
        </div>

        {/* Primare Rates */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-800 mb-4">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-600">
                <Utensils size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Tarifs Primaire</h4>
                <p className="text-xs text-slate-500">Cycles CP1 à CM2</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center my-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400">Mensuel</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{formatCurrency(8000)}</p>
              </div>
              <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                <p className="text-emerald-700 font-semibold">Trimestriel</p>
                <p className="font-bold text-emerald-800 text-sm mt-1">{formatCurrency(24000)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-slate-400">Annuel</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{formatCurrency(64000)}</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-3">
            *Rappel La Harpe de David* : L'enregistrement n'autorise que les montants trimestriels exigibles de 24 000 FCFA.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 text-lg">Paiements de cantine</h3>
        <DataTable
          columns={columns}
          data={canteenPayments}
          searchPlaceholder="Rechercher un paiement de cantine..."
          searchKeys={['receipt_number', 'notes']}
        />
      </div>
    </div>
  );
}
