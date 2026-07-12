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

interface FinanceDashboardProps {
  students: any[];
  payments: any[];
  canteenPayments: any[];
  studentFees: any[];
  studentInstallments: any[];
  levels: any[];
  classes: any[];
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
}: FinanceDashboardProps) {
  // Compute tuition calculations
  const expectedTuition = useMemo(() => {
    return studentInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0);
  }, [studentInstallments]);

  const collectedTuition = useMemo(() => {
    return payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  }, [payments]);

  // Compute canteen calculations
  const canteenExpected = useMemo(() => {
    return studentFees.reduce((sum, sf) => {
      if (sf.canteen_option === 'none') return sum;
      // Get the plan of this student fee
      const plan = sf.plan;
      if (!plan) return sum;
      // Canteen is quarterly, so for a full year of 3 trimesters:
      const rate = Number(plan.canteen_quarterly || 0) * 3;
      return sum + rate;
    }, 0);
  }, [studentFees]);

  const collectedCanteen = useMemo(() => {
    return canteenPayments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  }, [canteenPayments]);

  // General aggregates
  const totalExpected = expectedTuition + canteenExpected;
  const totalCollected = collectedTuition + collectedCanteen;
  const totalRemaining = Math.max(0, totalExpected - totalCollected);
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

  // Identify overdue student accounts (students in arrears)
  const studentsInArrears = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    // Group payments by student
    const studentPaymentsMap: Record<string, number> = {};
    payments.forEach(p => {
      studentPaymentsMap[p.student_id] = (studentPaymentsMap[p.student_id] || 0) + Number(p.amount);
    });

    // Group installments by student
    const studentInstallmentsMap: Record<string, { totalExpected: number; totalDueToday: number }> = {};
    studentInstallments.forEach(inst => {
      if (!studentInstallmentsMap[inst.student_id]) {
        studentInstallmentsMap[inst.student_id] = { totalExpected: 0, totalDueToday: 0 };
      }
      studentInstallmentsMap[inst.student_id].totalExpected += Number(inst.amount);
      if (inst.due_date <= today) {
        studentInstallmentsMap[inst.student_id].totalDueToday += Number(inst.amount);
      }
    });

    const list: any[] = [];
    students.forEach(student => {
      const paid = studentPaymentsMap[student.id] || 0;
      const instData = studentInstallmentsMap[student.id];
      if (!instData) return;

      const remaining = Math.max(0, instData.totalExpected - paid);
      const isLate = paid < instData.totalDueToday;
      const delayAmount = isLate ? instData.totalDueToday - paid : 0;

      if (remaining > 0 && isLate) {
        list.push({
          ...student,
          paid,
          totalExpected: instData.totalExpected,
          remaining,
          delayAmount,
        });
      }
    });

    return list.sort((a, b) => b.delayAmount - a.delayAmount).slice(0, 5);
  }, [students, payments, studentInstallments]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<GraduationCap size={20} />}
          value={students.length}
          label="Élèves actifs"
          color="blue"
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
            <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle size={16} /> Retards de versements majeurs
            </h3>
            {studentsInArrears.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-2xl">
                🟢 Aucun élève en retard sur ses tranches exigibles !
              </div>
            ) : (
              <div className="space-y-3">
                {studentsInArrears.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-red-50/30 border border-red-100 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-slate-500 mt-1">
                        Classe : {s.class?.name || '-'} • Payé : {formatCurrency(s.paid)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700 text-sm">
                        -{formatCurrency(s.delayAmount)}
                      </p>
                      <p className="text-slate-400 mt-1">Tranche due</p>
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
