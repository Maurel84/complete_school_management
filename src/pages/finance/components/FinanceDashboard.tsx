import { useMemo } from 'react';
import StatCard from '../../../components/common/StatCard';
import { formatCurrency } from '../../../lib/utils';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Coins,
  DollarSign,
  GraduationCap,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { resolveStudentFinance } from '../../../lib/financePlanResolver';

interface FinanceDashboardProps {
  students: any[];
  payments: any[];
  canteenPayments: any[];
  studentFees: any[];
  studentInstallments: any[];
  levels: any[];
  classes: any[];
  plans?: any[];
}

const COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export default function FinanceDashboard({
  students = [],
  payments = [],
  canteenPayments = [],
  studentFees = [],
  studentInstallments = [],
  levels = [],
  classes = [],
  plans = [],
}: FinanceDashboardProps) {
  // Compute finances per student according to their class/level configuration
  const studentFinances = useMemo(() => {
    return students.map(s =>
      resolveStudentFinance({
        student: s,
        plans,
        studentFees,
        studentInstallments,
        tuitionPayments: payments,
        canteenPayments,
        classes,
      })
    );
  }, [students, plans, studentFees, studentInstallments, payments, canteenPayments, classes]);

  const activeStudents = useMemo(() => students.filter(s => s.status === 'active'), [students]);
  const inactiveStudents = useMemo(() => students.filter(s => s.status !== 'active'), [students]);

  // Compute tuition calculations
  const expectedTuition = useMemo(() => {
    return studentFinances.reduce((sum, sf) => sum + sf.totalExpectedTuition, 0);
  }, [studentFinances]);

  const collectedTuition = useMemo(() => {
    return payments
      .filter((pay: any) => pay.status !== 'cancelled')
      .reduce((sum, pay) => sum + Number(pay.amount), 0);
  }, [payments]);

  // Compute canteen calculations
  const canteenExpected = useMemo(() => {
    return studentFinances.reduce((sum, sf) => sum + sf.totalExpectedCanteen, 0);
  }, [studentFinances]);

  const collectedCanteen = useMemo(() => {
    return canteenPayments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  }, [canteenPayments]);

  // General aggregates
  const totalExpected = expectedTuition + canteenExpected;
  const totalCollected = collectedTuition + collectedCanteen;
  // Accurately sum individual student debts (matches Suivi des dettes exactly)
  const totalRemaining = useMemo(() => {
    return studentFinances.reduce((sum, sf) => sum + sf.remaining, 0);
  }, [studentFinances]);
  const recoveryRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  // Revenues by level
  const levelRevenues = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach(p => {
      const levelId = p.student?.class?.level_id;
      const levelName = levels.find(l => l.id === levelId)?.name || 'Inconnu';
      map[levelName] = (map[levelName] || 0) + Number(p.amount);
    });
    canteenPayments.forEach(p => {
      const levelId = p.student?.class?.level_id;
      const levelName = levels.find(l => l.id === levelId)?.name || 'Inconnu';
      map[levelName] = (map[levelName] || 0) + Number(p.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [payments, canteenPayments, levels]);

  // Revenues by class
  const classRevenues = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach(p => {
      const className = p.student?.class?.name || 'Inconnu';
      map[className] = (map[className] || 0) + Number(p.amount);
    });
    canteenPayments.forEach(p => {
      const className = p.student?.class?.name || 'Inconnu';
      map[className] = (map[className] || 0) + Number(p.amount);
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [payments, canteenPayments]);

  // Monthly trends (tuition + canteen)
  const monthlyRevenues = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach(p => {
      const month = new Date(p.payment_date).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });
      map[month] = (map[month] || 0) + Number(p.amount);
    });
    canteenPayments.forEach(p => {
      const month = new Date(p.payment_date).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });
      map[month] = (map[month] || 0) + Number(p.amount);
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount }));
  }, [payments, canteenPayments]);

  // Identify overdue student accounts (students in arrears or with unpaid balance)
  const studentsInArrears = useMemo(() => {
    const list: any[] = [];
    students.forEach((student, index) => {
      const sf = studentFinances[index];
      if (!sf) return;

      const hasOverdueInstallment = sf.delayAmount > 0;
      const hasDebt = sf.remaining > 0;

      if (hasOverdueInstallment || hasDebt) {
        list.push({
          ...student,
          paid: sf.totalPaid,
          paidTuition: sf.paidTuition,
          paidCanteen: sf.paidCanteen,
          totalExpected: sf.totalExpected,
          remaining: sf.remaining,
          delayAmount: sf.delayAmount > 0 ? sf.delayAmount : sf.remaining,
          isOverdueInstallment: hasOverdueInstallment,
          status: sf.status,
        });
      }
    });

    // Sort by largest overdue installment amount first, then largest remaining debt
    return list
      .sort((a, b) => {
        if (b.isOverdueInstallment !== a.isOverdueInstallment) {
          return b.isOverdueInstallment ? 1 : -1;
        }
        return (b.delayAmount || b.remaining) - (a.delayAmount || a.remaining);
      })
      .slice(0, 6);
  }, [students, studentFinances]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<GraduationCap size={20} />}
          value={activeStudents.length}
          label="Élèves inscrits actifs"
          color="blue"
          subLabel={inactiveStudents.length > 0 ? `${students.length} au total • ${inactiveStudents.length} archivé` : undefined}
          trend={inactiveStudents.length > 0 ? { value: students.length, up: true, label: `${students.length} total` } : undefined}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          value={formatCurrency(totalExpected)}
          label="Recettes attendues"
          color="slate"
        />
        <StatCard
          icon={<DollarSign size={20} />}
          value={formatCurrency(totalCollected)}
          label="Recettes encaissées"
          color="green"
          trend={{ value: Number(recoveryRate.toFixed(1)), up: true }}
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          value={formatCurrency(totalRemaining)}
          label="Solde restant"
          color="red"
        />
      </div>

      {/* Canteen Stats & Recovery Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="surface-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              Taux de recouvrement
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{recoveryRate.toFixed(1)}%</span>
              <span className="text-sm text-slate-500">global scolarité + cantine</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3.5 my-6 overflow-hidden">
            <div
              className="bg-emerald-600 h-3.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, recoveryRate)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
            <div>
              <p className="text-slate-500">Total payé</p>
              <p className="font-semibold text-slate-800 text-sm mt-1">
                {formatCurrency(totalCollected)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Reste à recouvrer</p>
              <p className="font-semibold text-red-600 text-sm mt-1">
                {formatCurrency(totalRemaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Statistiques Cantine
            </h3>
            <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <Utensils size={14} /> La Harpe de David
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500">Attendu cantine</p>
              <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(canteenExpected)}</p>
            </div>
            <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100">
              <p className="text-xs text-emerald-600">Encaissé cantine</p>
              <p className="text-lg font-bold text-emerald-700 mt-2">{formatCurrency(collectedCanteen)}</p>
            </div>
            <div className="bg-red-50/40 rounded-2xl p-4 border border-red-100">
              <p className="text-xs text-red-600">Reste cantine</p>
              <p className="text-lg font-bold text-red-700 mt-2">
                {formatCurrency(Math.max(0, canteenExpected - collectedCanteen))}
              </p>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500 leading-5">
            💡 *Note relative aux règles d'établissement* : Les paiements de cantine sont enregistrés uniquement par trimestre (Maternelle: 21 000 FCFA, Primaire: 24 000 FCFA). Les tarifs mensuels et annuels sont consultables à titre administratif.
          </div>
        </div>
      </div>

      {/* Interactive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="surface-card lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Évolution Mensuelle des Recettes
          </h3>
          {monthlyRevenues.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenues}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={value => formatCurrency(Number(value || 0))} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.1}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Aucun versement enregistré sur cette période
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Recettes par Cycle Scolaire
          </h3>
          {levelRevenues.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={levelRevenues}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {levelRevenues.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => formatCurrency(Number(value || 0))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Aucune recette
            </div>
          )}
        </div>
      </div>

      {/* Recettes par Classe & Alertes Retards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Top Recettes par Classe
          </h3>
          {classRevenues.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={classRevenues}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={value => formatCurrency(Number(value || 0))} />
                <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Aucune classe enregistrée
            </div>
          )}
        </div>

        <div className="surface-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={16} /> Retards de versements majeurs
              </h3>
              {studentsInArrears.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                  {studentsInArrears.length} élève(s) prioritaire(s)
                </span>
              )}
            </div>
            {studentsInArrears.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-2xl">
                🟢 Aucun élève en retard sur ses tranches exigibles !
              </div>
            ) : (
              <div className="space-y-3">
                {studentsInArrears.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-red-50/40 border border-red-100 text-xs hover:bg-red-50/70 transition"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-slate-500 mt-1">
                        Classe : <span className="font-medium text-slate-700">{s.class?.name || '-'}</span> • Payé : <span className="text-emerald-700 font-semibold">{formatCurrency(s.paid)}</span> sur {formatCurrency(s.totalExpected)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700 text-sm">
                        -{formatCurrency(s.delayAmount)}
                      </p>
                      <p className="text-red-500 text-[11px] font-medium mt-0.5">
                        {s.isOverdueInstallment ? 'Tranche échue en retard' : 'Reste à solder'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500 text-center">
            Les détails exhaustifs d'échéances et l'envoi de relances WhatsApp se font depuis l'onglet **Suivi des dettes**.
          </div>
        </div>
      </div>
    </div>
  );
}
