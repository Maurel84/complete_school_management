import { useMemo, useState } from 'react';
import DataTable from '../../../components/common/DataTable';
import type { Column } from '../../../components/common/DataTable';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Download, FileText, Printer, ShieldAlert } from 'lucide-react';
import { openPrintPreview } from '../../../lib/printableDocuments';

interface FinanceReportsProps {
  students: any[];
  payments: any[];
  canteenPayments: any[];
  studentFees: any[];
  studentInstallments: any[];
  levels: any[];
  classes: any[];
}

export default function FinanceReports({
  students = [],
  payments = [],
  canteenPayments = [],
  studentFees = [],
  studentInstallments = [],
  levels = [],
  classes = [],
}: FinanceReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'journal' | 'class' | 'student' | 'balance'>('journal');

  // 1. Journal de Caisse (Combined Tuition and Canteen ledger)
  const cashJournal = useMemo(() => {
    const tuitionList = payments.map(p => ({
      id: p.id,
      date: p.payment_date,
      receipt: p.receipt_number,
      studentName: p.student ? `${p.student.last_name} ${p.student.first_name}` : 'Inconnu',
      className: p.student?.class?.name || '-',
      type: 'Scolarité',
      amount: Number(p.amount),
      method: p.payment_method,
    }));

    const canteenList = canteenPayments.map(p => ({
      id: p.id,
      date: p.payment_date,
      receipt: p.receipt_number,
      studentName: p.student ? `${p.student.last_name} ${p.student.first_name}` : 'Inconnu',
      className: p.student?.class?.name || '-',
      type: `Cantine (T${p.trimester})`,
      amount: Number(p.amount),
      method: p.payment_method,
    }));

    return [...tuitionList, ...canteenList].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [payments, canteenPayments]);

  // Helper maps for aggregations
  const studentFinancialsMap = useMemo(() => {
    // Group payments
    const tuitionMap: Record<string, number> = {};
    payments.forEach(p => {
      tuitionMap[p.student_id] = (tuitionMap[p.student_id] || 0) + Number(p.amount);
    });

    const canteenMap: Record<string, number> = {};
    canteenPayments.forEach(p => {
      canteenMap[p.student_id] = (canteenMap[p.student_id] || 0) + Number(p.amount);
    });

    // Group installments
    const installmentsMap: Record<string, number> = {};
    studentInstallments.forEach(inst => {
      installmentsMap[inst.student_id] = (installmentsMap[inst.student_id] || 0) + Number(inst.amount);
    });

    // Group plan details
    const feesMap: Record<string, any> = {};
    studentFees.forEach(sf => {
      feesMap[sf.student_id] = sf;
    });

    const map: Record<string, any> = {};
    students.forEach(s => {
      const planLink = feesMap[s.id];
      const basePlanAmount = Number(planLink?.plan?.total_amount || 0);
      const discount = Number(planLink?.discount_amount || 0);
      const canteenOption = planLink?.canteen_option || 'none';
      const canteenRate =
        canteenOption === 'none' ? 0 : Number(planLink?.plan?.canteen_quarterly || 0) * 3;

      const tExpected = Math.max(0, basePlanAmount - discount);
      const cExpected = canteenRate;
      const tPaid = tuitionMap[s.id] || 0;
      const cPaid = canteenMap[s.id] || 0;

      map[s.id] = {
        studentId: s.id,
        name: `${s.last_name} ${s.first_name}`,
        matricule: s.matricule,
        classId: s.class_id,
        className: s.class?.name || '-',
        levelId: s.class?.level_id || '-',
        tExpected,
        tPaid,
        tRemaining: Math.max(0, tExpected - tPaid),
        cExpected,
        cPaid,
        cRemaining: Math.max(0, cExpected - cPaid),
        totalExpected: tExpected + cExpected,
        totalPaid: tPaid + cPaid,
        totalRemaining: Math.max(0, tExpected + cExpected - (tPaid + cPaid)),
      };
    });

    return map;
  }, [students, payments, canteenPayments, studentFees, studentInstallments]);

  // 2. Situation par classe
  const classFinancials = useMemo(() => {
    const map: Record<string, any> = {};
    classes.forEach(c => {
      map[c.id] = {
        className: c.name,
        studentsCount: 0,
        tExpected: 0,
        tPaid: 0,
        tRemaining: 0,
        cExpected: 0,
        cPaid: 0,
        cRemaining: 0,
        totalExpected: 0,
        totalPaid: 0,
        totalRemaining: 0,
      };
    });

    Object.values(studentFinancialsMap).forEach((f: any) => {
      const classData = map[f.classId];
      if (!classData) return;

      classData.studentsCount += 1;
      classData.tExpected += f.tExpected;
      classData.tPaid += f.tPaid;
      classData.tRemaining += f.tRemaining;
      classData.cExpected += f.cExpected;
      classData.cPaid += f.cPaid;
      classData.cRemaining += f.cRemaining;
      classData.totalExpected += f.totalExpected;
      classData.totalPaid += f.totalPaid;
      classData.totalRemaining += f.totalRemaining;
    });

    return Object.values(map);
  }, [classes, studentFinancialsMap]);

  // 3. Situation par élève list
  const studentFinancialsList = useMemo(() => {
    return Object.values(studentFinancialsMap);
  }, [studentFinancialsMap]);

  // 4. Situation Balance Générale
  const balanceAggregates = useMemo(() => {
    let tExpected = 0,
      tPaid = 0,
      cExpected = 0,
      cPaid = 0;

    Object.values(studentFinancialsMap).forEach((f: any) => {
      tExpected += f.tExpected;
      tPaid += f.tPaid;
      cExpected += f.cExpected;
      cPaid += f.cPaid;
    });

    return {
      tExpected,
      tPaid,
      tRemaining: Math.max(0, tExpected - tPaid),
      cExpected,
      cPaid,
      cRemaining: Math.max(0, cExpected - cPaid),
      totalExpected: tExpected + cExpected,
      totalPaid: tPaid + cPaid,
      totalRemaining: Math.max(0, tExpected + cExpected - (tPaid + cPaid)),
      tuitionRate: tExpected > 0 ? (tPaid / tExpected) * 100 : 0,
      canteenRate: cExpected > 0 ? (cPaid / cExpected) : 0,
    };
  }, [studentFinancialsMap]);

  // CSV Export functions
  function handleExportCSV() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = '';

    if (activeReportTab === 'journal') {
      headers = ['Date', 'Reçu', 'Élève', 'Classe', 'Frais', 'Montant', 'Mode'];
      rows = cashJournal.map(item => [
        item.date,
        item.receipt,
        item.studentName,
        item.className,
        item.type,
        String(item.amount),
        item.method,
      ]);
      fileName = 'journal_caisse.csv';
    } else if (activeReportTab === 'class') {
      headers = ['Classe', 'Effectif', 'Scolarité Attendue', 'Scolarité Encaissée', 'Reste Scolarité', 'Cantine Attendue', 'Cantine Encaissée', 'Reste Cantine'];
      rows = classFinancials.map(item => [
        item.className,
        String(item.studentsCount),
        String(item.tExpected),
        String(item.tPaid),
        String(item.tRemaining),
        String(item.cExpected),
        String(item.cPaid),
        String(item.cRemaining),
      ]);
      fileName = 'situation_classes.csv';
    } else {
      headers = ['Nom & Prénom', 'Matricule', 'Classe', 'Attendu Total', 'Payé Total', 'Solde Dû'];
      rows = studentFinancialsList.map(item => [
        item.name,
        item.matricule,
        item.className,
        String(item.totalExpected),
        String(item.totalPaid),
        String(item.totalRemaining),
      ]);
      fileName = 'situation_eleves.csv';
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrintReport() {
    let title = '';
    let tableHtml = '';

    if (activeReportTab === 'journal') {
      title = 'Journal de caisse général';
      tableHtml = `
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; font-size: 11px;">
          <thead>
            <tr>
              <th>Date</th><th>Reçu</th><th>Élève</th><th>Classe</th><th>Type</th><th>Montant</th><th>Mode</th>
            </tr>
          </thead>
          <tbody>
            ${cashJournal
              .map(
                x =>
                  `<tr><td>${formatDate(x.date)}</td><td>${x.receipt}</td><td>${x.studentName}</td><td>${x.className}</td><td>${x.type}</td><td>${formatCurrency(x.amount)}</td><td>${x.method}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else if (activeReportTab === 'class') {
      title = 'Situation financière par classe';
      tableHtml = `
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; font-size: 11px;">
          <thead>
            <tr>
              <th>Classe</th><th>Élèves</th><th>Scol. Attendue</th><th>Scol. Encaissée</th><th>Cantine Attendue</th><th>Cantine Encaissée</th><th>Reste Dû</th>
            </tr>
          </thead>
          <tbody>
            ${classFinancials
              .map(
                x =>
                  `<tr><td>${x.className}</td><td>${x.studentsCount}</td><td>${formatCurrency(x.tExpected)}</td><td>${formatCurrency(x.tPaid)}</td><td>${formatCurrency(x.cExpected)}</td><td>${formatCurrency(x.cPaid)}</td><td>${formatCurrency(x.totalRemaining)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else {
      title = 'Situation financière par élève';
      tableHtml = `
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; font-size: 11px;">
          <thead>
            <tr>
              <th>Nom & Prénoms</th><th>Matricule</th><th>Classe</th><th>Total Attendu</th><th>Total Encaissé</th><th>Solde Restant</th>
            </tr>
          </thead>
          <tbody>
            ${studentFinancialsList
              .map(
                x =>
                  `<tr><td>${x.name}</td><td>${x.matricule}</td><td>${x.className}</td><td>${formatCurrency(x.totalExpected)}</td><td>${formatCurrency(x.totalPaid)}</td><td>${formatCurrency(x.totalRemaining)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    }

    const fullHtml = `
      <html>
        <head>
          <title>${title}</title>
          <style>body { font-family: sans-serif; padding: 20px; } h2 { margin-bottom: 20px; }</style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</p>
          ${tableHtml}
        </body>
      </html>
    `;
    openPrintPreview(fullHtml);
  }

  const journalColumns: Column<any>[] = [
    { key: 'date', label: 'Date', render: row => formatDate(row.date) },
    { key: 'receipt', label: 'Reçu' },
    { key: 'studentName', label: 'Élève' },
    { key: 'className', label: 'Classe' },
    { key: 'type', label: 'Frais' },
    { key: 'amount', label: 'Montant', render: row => formatCurrency(row.amount) },
    { key: 'method', label: 'Mode' },
  ];

  const classColumns: Column<any>[] = [
    { key: 'className', label: 'Classe' },
    { key: 'studentsCount', label: 'Effectif' },
    { key: 'tExpected', label: 'Attendu Scol.', render: row => formatCurrency(row.tExpected) },
    { key: 'tPaid', label: 'Encaissé Scol.', render: row => formatCurrency(row.tPaid) },
    { key: 'cExpected', label: 'Attendu Cantine', render: row => formatCurrency(row.cExpected) },
    { key: 'cPaid', label: 'Encaissé Cantine', render: row => formatCurrency(row.cPaid) },
    { key: 'totalRemaining', label: 'Reste Total', render: row => formatCurrency(row.totalRemaining) },
  ];

  const studentColumns: Column<any>[] = [
    { key: 'name', label: 'Élève' },
    { key: 'matricule', label: 'Matricule' },
    { key: 'className', label: 'Classe' },
    { key: 'totalExpected', label: 'Attendu', render: row => formatCurrency(row.totalExpected) },
    { key: 'totalPaid', label: 'Encaissé', render: row => formatCurrency(row.totalPaid) },
    { key: 'totalRemaining', label: 'Solde Dû', render: row => formatCurrency(row.totalRemaining) },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Rapports & Balance</h2>
          <p className="text-sm text-slate-500">
            Générez des extraits de caisse et exportez vos états comptables.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={14} /> Export Excel (CSV)
          </button>
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            <Printer size={14} /> Imprimer l'état
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveReportTab('journal')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activeReportTab === 'journal'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Journal de Caisse
        </button>
        <button
          onClick={() => setActiveReportTab('class')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activeReportTab === 'class'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Situation par Classe
        </button>
        <button
          onClick={() => setActiveReportTab('student')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activeReportTab === 'student'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Situation par Élève
        </button>
        <button
          onClick={() => setActiveReportTab('balance')}
          className={`pb-3 text-sm font-semibold border-b-2 px-2 transition ${
            activeReportTab === 'balance'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Balance Générale
        </button>
      </div>

      {/* Report view panels */}
      {activeReportTab === 'journal' && (
        <DataTable
          columns={journalColumns}
          data={cashJournal}
          searchPlaceholder="Rechercher dans le journal..."
          searchKeys={['receipt', 'studentName']}
        />
      )}

      {activeReportTab === 'class' && (
        <DataTable
          columns={classColumns}
          data={classFinancials}
          searchPlaceholder="Rechercher par classe..."
          searchKeys={['className']}
        />
      )}

      {activeReportTab === 'student' && (
        <DataTable
          columns={studentColumns}
          data={studentFinancialsList}
          searchPlaceholder="Rechercher par élève..."
          searchKeys={['name', 'matricule']}
        />
      )}

      {activeReportTab === 'balance' && (
        <div className="surface-card p-6 space-y-6">
          <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Balance générale comptable
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="border border-slate-200 rounded-[24px] p-5 space-y-3">
              <h4 className="font-bold text-slate-900">Total Scolarité (Annuel)</h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Facturé (Attendu) :</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(balanceAggregates.tExpected)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recouvré (Encaissé) :</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(balanceAggregates.tPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-red-600">
                <span>Reste à recouvrer :</span>
                <span>{formatCurrency(balanceAggregates.tRemaining)}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-[24px] p-5 space-y-3">
              <h4 className="font-bold text-slate-900">Total Cantine (Annuel)</h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Attendu total :</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(balanceAggregates.cExpected)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Encaissé total :</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(balanceAggregates.cPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-red-600">
                <span>Reste à recouvrer :</span>
                <span>{formatCurrency(balanceAggregates.cRemaining)}</span>
              </div>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/20 rounded-[24px] p-5 space-y-3">
              <h4 className="font-bold text-slate-900">Synthèse Générale</h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Total facturé :</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(balanceAggregates.totalExpected)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total encaissé :</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(balanceAggregates.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-emerald-100 pt-2 font-bold text-red-600">
                <span>Solde débiteur global :</span>
                <span>{formatCurrency(balanceAggregates.totalRemaining)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
