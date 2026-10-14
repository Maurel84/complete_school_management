import { useMemo, useState } from 'react';
import DataTable from '../../../components/common/DataTable';
import type { Column } from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import FormField from '../../../components/common/FormField';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { AlertTriangle, Bell, Mail, MessageSquare, Phone, Printer, Send } from 'lucide-react';
import { buildStudentAccountStatementHtml, openPrintPreview } from '../../../lib/printableDocuments';

interface StudentDebtsProps {
  school?: any;
  academicYearName?: string;
  students: any[];
  payments: any[];
  canteenPayments: any[];
  studentFees: any[];
  studentInstallments: any[];
  classes: any[];
}

export default function StudentDebts({
  school,
  academicYearName = '2026-2027',
  students = [],
  payments = [],
  canteenPayments = [],
  studentFees = [],
  studentInstallments = [],
  classes = [],
}: StudentDebtsProps) {
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertChannel, setAlertChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [alertMessage, setAlertMessage] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  function handlePrintStatement(studentRow: any) {
    if (!school) {
      alert("Informations de l'établissement introuvables.");
      return;
    }

    // Merge payment histories chronologically
    const allPayments = [
      ...studentRow.tuitionHistory.map((p: any) => ({
        receipt_number: p.receipt_number,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        amount: Number(p.amount),
        is_canteen: false,
        description: 'Scolarité annuelle',
      })),
      ...studentRow.canteenHistory.map((p: any) => ({
        receipt_number: p.receipt_number,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        amount: Number(p.amount),
        is_canteen: true,
        description: `Cantine scolaire - Trimestre ${p.trimester}`,
      })),
    ].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

    const html = buildStudentAccountStatementHtml({
      school,
      student: {
        first_name: studentRow.first_name,
        last_name: studentRow.last_name,
        matricule: studentRow.matricule,
      },
      className: studentRow.class?.name,
      academicYearName,
      planName: studentRow.planName,
      totalExpected: studentRow.expected,
      totalPaid: studentRow.paid,
      remaining: studentRow.remaining,
      installments: studentRow.installments,
      paymentHistory: allPayments,
    });

    openPrintPreview(html);
  }

  // Process debt statistics per student
  const studentDebtsList = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    // Group payments
    const tuitionPayMap: Record<string, number> = {};
    const tuitionHistoryMap: Record<string, any[]> = {};
    payments.forEach(p => {
      tuitionPayMap[p.student_id] = (tuitionPayMap[p.student_id] || 0) + Number(p.amount);
      if (!tuitionHistoryMap[p.student_id]) tuitionHistoryMap[p.student_id] = [];
      tuitionHistoryMap[p.student_id].push(p);
    });

    const canteenPayMap: Record<string, number> = {};
    const canteenHistoryMap: Record<string, any[]> = {};
    canteenPayments.forEach(p => {
      canteenPayMap[p.student_id] = (canteenPayMap[p.student_id] || 0) + Number(p.amount);
      if (!canteenHistoryMap[p.student_id]) canteenHistoryMap[p.student_id] = [];
      canteenHistoryMap[p.student_id].push(p);
    });

    // Group installments
    const installmentsMap: Record<string, any[]> = {};
    studentInstallments.forEach(inst => {
      if (!installmentsMap[inst.student_id]) installmentsMap[inst.student_id] = [];
      installmentsMap[inst.student_id].push(inst);
    });

    // Group plan details
    const feesMap: Record<string, any> = {};
    studentFees.forEach(sf => {
      feesMap[sf.student_id] = sf;
    });

    return students.map(student => {
      const planLink = feesMap[student.id];
      const basePlanName = planLink?.plan?.name || 'Aucun plan';
      const basePlanAmount = Number(planLink?.plan?.total_amount || 0);

      const canteenOption = planLink?.canteen_option || 'none';
      const canteenRate =
        canteenOption === 'none' ? 0 : Number(planLink?.plan?.canteen_quarterly || 0) * 3;

      const discount = Number(planLink?.discount_amount || 0);

      const totalExpectedTuition = Math.max(0, basePlanAmount - discount);
      const totalExpectedCanteen = canteenRate;
      const totalExpected = totalExpectedTuition + totalExpectedCanteen;

      const paidTuition = tuitionPayMap[student.id] || 0;
      const paidCanteen = canteenPayMap[student.id] || 0;
      const totalPaid = paidTuition + paidCanteen;

      const remaining = Math.max(0, totalExpected - totalPaid);

      // Determine payment status
      let status: 'paid' | 'partial' | 'unpaid' | 'not_configured' = 'unpaid';
      if (totalExpected === 0) status = 'not_configured';
      else if (remaining === 0) status = 'paid';
      else if (totalPaid > 0) status = 'partial';

      // Check installments for delay today
      const studentInsts = (installmentsMap[student.id] || []).sort(
        (a, b) => a.installment_number - b.installment_number
      );

      let totalDueToday = 0;
      studentInsts.forEach(inst => {
        if (inst.due_date <= today) {
          totalDueToday += Number(inst.amount);
        }
      });

      // Discount deduction logic for tranches (deducted from last installment or prorated)
      const adjustedDueToday = Math.max(0, totalDueToday - discount);
      const isLate = paidTuition < adjustedDueToday;
      const delayAmount = isLate ? adjustedDueToday - paidTuition : 0;

      return {
        ...student,
        planName: basePlanName,
        expected: totalExpected,
        paid: totalPaid,
        remaining,
        status,
        delayAmount,
        installments: studentInsts,
        tuitionHistory: tuitionHistoryMap[student.id] || [],
        canteenHistory: canteenHistoryMap[student.id] || [],
        canteenOption,
        parentPhone: student.parents?.[0]?.parent?.phone || student.phone || '',
        parentName: student.parents?.[0]?.parent
          ? `${student.parents[0].parent.first_name} ${student.parents[0].parent.last_name}`
          : 'Non défini',
      };
    });
  }, [students, payments, canteenPayments, studentFees, studentInstallments]);

  // Filter students based on selection and status
  const filteredStudents = useMemo(() => {
    return studentDebtsList.filter(s => {
      const matchClass = !classFilter || s.class_id === classFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'debt' && s.remaining > 0) ||
        (statusFilter === 'late' && s.delayAmount > 0) ||
        (statusFilter === 'paid' && s.status === 'paid');
      return matchClass && matchStatus;
    });
  }, [studentDebtsList, classFilter, statusFilter]);

  function openDetails(row: any) {
    setSelectedStudent(row);
    setDetailsOpen(true);
  }

  function openAlert(row: any) {
    setSelectedStudent(row);
    const text = `Bonjour ${row.parentName}, nous vous rappelons que le versement de scolarité de l'élève ${row.first_name} ${row.last_name} présente un reste à payer de ${formatCurrency(row.remaining)}. Merci de régulariser sous peu. Groupe Scolaire La Harpe de David.`;
    setAlertMessage(text);
    setAlertOpen(true);
  }

  async function handleSendAlert() {
    setSendingAlert(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    if (alertChannel === 'whatsapp' && selectedStudent?.parentPhone) {
      const url = `https://web.whatsapp.com/send?phone=${selectedStudent.parentPhone.replace(
        /\s+/g,
        ''
      )}&text=${encodeURIComponent(alertMessage)}`;
      window.open(url, '_blank');
    } else {
      alert(`Notification simulée envoyée avec succès par ${alertChannel.toUpperCase()} !`);
    }

    setSendingAlert(false);
    setAlertOpen(false);
  }

  const columns: Column<any>[] = [
    {
      key: 'identity',
      label: 'Élève',
      render: row => (
        <div>
          <p className="font-semibold text-slate-900">
            {row.first_name} {row.last_name}
          </p>
          <p className="text-xs text-slate-500">{row.matricule}</p>
        </div>
      ),
    },
    { key: 'class', label: 'Classe', render: row => row.class?.name || '-' },
    { key: 'planName', label: 'Cycle / Plan' },
    { key: 'expected', label: 'Attendu', render: row => formatCurrency(row.expected) },
    { key: 'paid', label: 'Payé', render: row => formatCurrency(row.paid) },
    { key: 'remaining', label: 'Reste', render: row => formatCurrency(row.remaining) },
    {
      key: 'delayAmount',
      label: 'En Retard',
      render: row =>
        row.delayAmount > 0 ? (
          <span className="font-bold text-red-600">{formatCurrency(row.delayAmount)}</span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: row => {
        if (row.status === 'not_configured') {
          return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">⚪ Non configuré</span>;
        } else if (row.status === 'paid') {
          return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">🟢 Payé</span>;
        } else if (row.status === 'partial') {
          return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">🟠 Partiel</span>;
        }
        return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">🔴 Impayé</span>;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePrintStatement(row)}
            title="Imprimer le relevé de compte complet de l'élève"
            className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-50 transition border border-emerald-200/60 bg-emerald-50/30"
          >
            <Printer size={15} />
          </button>
          <button
            onClick={() => openDetails(row)}
            className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition border border-blue-200/60 bg-blue-50/20"
          >
            Détails
          </button>
          <button
            onClick={() => openAlert(row)}
            title="Relancer le parent"
            className="rounded-xl p-2 text-amber-600 hover:bg-amber-50 transition"
          >
            <Bell size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-900">Suivi des Dettes & Relevés Financiers</h2>
          <p className="text-sm text-slate-500">
            Détails des tranches de scolarité, retards exigibles, cantine et relevés de compte individuels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value="all">Tous les états</option>
            <option value="debt">Avec Reste à payer (Dette)</option>
            <option value="late">En Retard exigible</option>
            <option value="paid">Soldés (Payés)</option>
          </select>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredStudents}
        searchPlaceholder="Rechercher par nom ou matricule..."
        searchKeys={['first_name', 'last_name', 'matricule']}
      />

      {/* Details Modal */}
      {selectedStudent && (
        <Modal
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={`Compte financier - ${selectedStudent.first_name} ${selectedStudent.last_name}`}
          size="lg"
          actions={
            <div className="flex justify-between w-full items-center">
              <button
                type="button"
                onClick={() => handlePrintStatement(selectedStudent)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
              >
                <Printer size={15} /> Imprimer Relevé Officiel
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Fermer
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-xs text-slate-500">Total Attendu</p>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {formatCurrency(selectedStudent.expected)}
                </p>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-xs text-emerald-600">Total Encaissé</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {formatCurrency(selectedStudent.paid)}
                </p>
              </div>
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4">
                <p className="text-xs text-red-600">Solde Restant</p>
                <p className="text-lg font-bold text-red-700 mt-1">
                  {formatCurrency(selectedStudent.remaining)}
                </p>
              </div>
            </div>

            {/* Installment Breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Échéancier des tranches</h4>
              {selectedStudent.installments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune échéance générée.</p>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.installments.map((inst: any) => {
                    const isPassed = new Date(inst.due_date) < new Date();
                    return (
                      <div
                        key={inst.id}
                        className="flex justify-between items-center p-3.5 bg-white border border-slate-200 rounded-2xl text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            Tranche {inst.installment_number} : {inst.label}
                          </p>
                          <p className="text-slate-500 mt-1">
                            Échéance : {formatDate(inst.due_date)}{' '}
                            {isPassed && (
                              <span className="text-red-500 font-medium">(Exigible)</span>
                            )}
                          </p>
                        </div>
                        <p className="font-bold text-slate-800">{formatCurrency(inst.amount)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Historique des versements</h4>
              {selectedStudent.tuitionHistory.length === 0 &&
              selectedStudent.canteenHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun versement enregistré.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {selectedStudent.tuitionHistory.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 bg-emerald-50/20 border border-emerald-100/60 rounded-xl text-xs"
                    >
                      <div>
                        <p className="font-medium text-emerald-800">Scolarité - Reçu {p.receipt_number}</p>
                        <p className="text-slate-400 mt-1">{formatDate(p.payment_date)}</p>
                      </div>
                      <span className="font-bold text-emerald-700">+{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                  {selectedStudent.canteenHistory.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 bg-amber-50/20 border border-amber-100/60 rounded-xl text-xs"
                    >
                      <div>
                        <p className="font-medium text-amber-800">
                          Cantine Trimestre {p.trimester} - Reçu {p.receipt_number}
                        </p>
                        <p className="text-slate-400 mt-1">{formatDate(p.payment_date)}</p>
                      </div>
                      <span className="font-bold text-amber-700">+{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Alert Modal */}
      {selectedStudent && (
        <Modal
          isOpen={alertOpen}
          onClose={() => setAlertOpen(false)}
          title="Relance de paiement"
          size="md"
          actions={
            <>
              <button
                onClick={() => setAlertOpen(false)}
                className="rounded-2xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={handleSendAlert}
                disabled={sendingAlert}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <Send size={14} /> {sendingAlert ? 'Envoi...' : 'Envoyer la relance'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAlertChannel('whatsapp')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                  alertChannel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <MessageSquare size={20} />
                <span className="text-xs">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setAlertChannel('sms')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                  alertChannel === 'sms'
                    ? 'border-blue-500 bg-blue-50/40 text-blue-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Phone size={20} />
                <span className="text-xs">SMS</span>
              </button>
              <button
                type="button"
                onClick={() => setAlertChannel('email')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition ${
                  alertChannel === 'email'
                    ? 'border-slate-900 bg-slate-900/5 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Mail size={20} />
                <span className="text-xs">Email</span>
              </button>
            </div>

            <FormField label="Destinataire (Parent)">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 leading-5">
                <p>
                  Nom : <strong>{selectedStudent.parentName}</strong>
                </p>
                <p className="mt-1">
                  Téléphone : <strong>{selectedStudent.parentPhone || 'Non renseigné'}</strong>
                </p>
              </div>
            </FormField>

            <FormField label="Message de relance" required>
              <textarea
                value={alertMessage}
                onChange={e => setAlertMessage(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:border-emerald-500"
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
