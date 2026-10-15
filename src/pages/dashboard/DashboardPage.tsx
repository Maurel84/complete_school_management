import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency } from '../../lib/utils';
import { resolveStudentFinance } from '../../lib/financePlanResolver';
import {
  GraduationCap, Users, BookOpen, DollarSign, Wallet,
  AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';

const COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export default function DashboardPage() {
  const { profile } = useAuth();
  const { school, academicYear } = useApp();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalActiveStudents: 0,
    totalInactiveStudents: 0,
    totalBoys: 0,
    totalGirls: 0,
    totalTeachers: 0,
    totalParents: 0,
    totalExpectedFees: 0,
    totalPayments: 0,
    totalUnpaid: 0,
    cashBalance: 0,
    recentExpenses: 0,
    paidStudentsCount: 0,
    partialStudentsCount: 0,
    unpaidStudentsCount: 0,
    studentsWithPayment: 0,
    studentsWithoutPayment: 0,
    recoveryRate: 0,
    studentPaymentRate: 0,
  });
  const [paymentByMonth, setPaymentByMonth] = useState<{name: string; montant: number}[]>([]);
  const [studentsByLevel, setStudentsByLevel] = useState<{name: string; value: number}[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<{name: string; value: number}[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{type: string; message: string; date: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (school) fetchDashboardData();
    else setLoading(false);
  }, [school, academicYear]);

  async function fetchDashboardData() {
    setLoading(true);
    const schoolId = school!.id;

    const [
      studentsRes,
      studentFeesRes,
      studentInstallmentsRes,
      teachersRes,
      parentsRes,
      paymentsRes,
      canteenPaymentsRes,
      expensesRes,
      cashRes,
      plansRes,
      levelsRes,
      classesRes,
    ] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name, matricule, sex, class_id, status')
        .eq('school_id', schoolId),
      supabase
        .from('student_fees')
        .select('*, plan:payment_plans(*)')
        .eq('school_id', schoolId),
      supabase
        .from('student_installments')
        .select('*')
        .eq('school_id', schoolId),
      supabase.from('teachers').select('id').eq('school_id', schoolId).eq('status', 'active'),
      supabase.from('parents').select('id').eq('school_id', schoolId),
      supabase.from('payments').select('id, amount, payment_date, status, payment_method, student_id, receipt_number').eq('school_id', schoolId),
      supabase.from('canteen_payments').select('id, amount, payment_date, student_id, receipt_number').eq('school_id', schoolId),
      supabase.from('expenses').select('amount, expense_date, payment_method, status').eq('school_id', schoolId),
      supabase.from('cash_transactions').select('type, amount, validated').eq('school_id', schoolId),
      supabase.from('payment_plans').select('*, levels:payment_plan_levels(level_id)').eq('school_id', schoolId),
      supabase.from('levels').select('id, name').eq('school_id', schoolId),
      supabase.from('classes').select('id, level_id, name').eq('school_id', schoolId),
    ]);

    const allStudents = studentsRes.data || [];
    const studentFees = studentFeesRes.data || [];
    const studentInstallments = studentInstallmentsRes.data || [];
    const activeStudents = allStudents.filter(s => s.status === 'active');
    const inactiveStudents = allStudents.filter(s => s.status !== 'active');
    const totalStudents = allStudents.length;
    const totalActiveStudents = activeStudents.length;
    const totalInactiveStudents = inactiveStudents.length;

    const payments = paymentsRes.data || [];
    const canteenPayments = canteenPaymentsRes.data || [];
    const expenses = expensesRes.data || [];
    const cashTx = cashRes.data || [];
    const plans = plansRes.data || [];
    const levels = levelsRes.data || [];
    const classes = classesRes.data || [];

    const totalBoys = activeStudents.filter(s => s.sex === 'M').length;
    const totalGirls = activeStudents.filter(s => s.sex === 'F').length;
    const totalTeachers = (teachersRes.data || []).length;
    const totalParents = (parentsRes.data || []).length;

    // Index payments by student for accurate, high-performance financial resolution
    const paymentsByStudent: Record<string, any[]> = {};
    payments.forEach((p: any) => {
      if (!paymentsByStudent[p.student_id]) paymentsByStudent[p.student_id] = [];
      paymentsByStudent[p.student_id].push(p);
    });

    const canteenByStudent: Record<string, any[]> = {};
    canteenPayments.forEach((cp: any) => {
      if (!canteenByStudent[cp.student_id]) canteenByStudent[cp.student_id] = [];
      canteenByStudent[cp.student_id].push(cp);
    });

    let totalExpectedFees = 0;
    let totalUnpaid = 0;
    let paidStudentsCount = 0;
    let partialStudentsCount = 0;
    let unpaidStudentsCount = 0;

    activeStudents.forEach((student: any) => {
      const studentPayments = paymentsByStudent[student.id] || [];
      const studentCanteenPayments = canteenByStudent[student.id] || [];

      // Resolve student finance with class/level fallback matching the rest of the application
      const fin = resolveStudentFinance({
        student,
        plans,
        studentFees,
        studentInstallments,
        tuitionPayments: studentPayments,
        canteenPayments: studentCanteenPayments,
        classes,
      });

      totalExpectedFees += fin.totalExpected;
      totalUnpaid += fin.remaining;

      if (fin.status === 'paid') {
        paidStudentsCount++;
      } else if (fin.status === 'partial') {
        partialStudentsCount++;
      } else {
        unpaidStudentsCount++;
      }
    });

    // Actual collected sums from payments table and canteen_payments table
    const totalPaidTuition = payments
      .filter((p: any) => p.status === 'paid' || !p.status)
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const totalPaidCanteen = canteenPayments
      .reduce((sum: number, cp: any) => sum + Number(cp.amount || 0), 0);

    const totalPayments = totalPaidTuition + totalPaidCanteen;

    // Recovery rate based on realistic total expected fees across the student body
    const recoveryRate = totalExpectedFees > 0 ? Math.round((totalPayments / totalExpectedFees) * 100) : 0;
    const studentsWithPayment = paidStudentsCount + partialStudentsCount;
    const studentsWithoutPayment = unpaidStudentsCount;
    const studentPaymentRate = totalActiveStudents > 0 ? Math.round((studentsWithPayment / totalActiveStudents) * 100) : 0;

    // Expenses: all registered expenses for the establishment (validated, approved, paid or untagged)
    const totalExpenses = expenses
      .filter((e: any) => !e.status || e.status === 'validated' || e.status === 'approved' || e.status === 'paid')
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    // Cash Balance: from cash register transactions
    const cashIn = cashTx.filter((t: any) => t.type === 'in').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const cashOut = cashTx.filter((t: any) => t.type === 'out').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    let cashBalance = cashIn - cashOut;

    // Fallback if no cash register movements recorded yet:
    // Take cash payments (tuition + canteen) minus expenses
    if (cashIn === 0 && cashOut === 0) {
      const cashPayments = payments
        .filter((p: any) => {
          if (p.status === 'cancelled') return false;
          const method = (p.payment_method || '').toLowerCase().trim();
          return !method || method === 'cash' || method === 'especes' || method === 'espèces';
        })
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0) + totalPaidCanteen;
      cashBalance = Math.max(0, cashPayments - totalExpenses);
    }

    setStats({
      totalStudents,
      totalActiveStudents,
      totalInactiveStudents,
      totalBoys,
      totalGirls,
      totalTeachers,
      totalParents,
      totalExpectedFees,
      totalPayments,
      totalUnpaid,
      cashBalance,
      recentExpenses: totalExpenses,
      paidStudentsCount,
      partialStudentsCount,
      unpaidStudentsCount,
      studentsWithPayment,
      studentsWithoutPayment,
      recoveryRate,
      studentPaymentRate,
    });

    // Payments by month (Tuition + Canteen)
    const monthMap: Record<string, number> = {};
    const allValidatedPayments = [
      ...payments.filter((p: any) => p.status === 'paid' || !p.status),
      ...canteenPayments
    ];
    allValidatedPayments.forEach((p: any) => {
      const dateVal = p.payment_date || p.created_at;
      if (!dateVal) return;
      const month = new Date(dateVal).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      monthMap[month] = (monthMap[month] || 0) + Number(p.amount || 0);
    });
    setPaymentByMonth(Object.entries(monthMap).map(([name, montant]) => ({ name, montant })));

    // Students by level (active students)
    const levelStudents = levels.map(l => {
      const levelClasses = classes.filter(c => c.level_id === l.id);
      const count = activeStudents.filter(s => levelClasses.some(c => c.id === s.class_id)).length;
      return { name: l.name, value: count };
    }).filter(l => l.value > 0);
    setStudentsByLevel(levelStudents);

    // Payment status distribution
    setPaymentStatus([
      { name: 'Soldé', value: paidStudentsCount },
      { name: 'Partiel', value: partialStudentsCount },
      { name: 'Impayé', value: unpaidStudentsCount },
    ].filter(s => s.value > 0));

    // Recent payments
    const { data: recentData } = await supabase
      .from('payments')
      .select('*, student:students(first_name, last_name, matricule)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentPayments(recentData || []);

    // Alerts
    const alertList: {type: string; message: string; date: string}[] = [];
    if (totalUnpaid > 0) alertList.push({ type: 'warning', message: `Montant des impayés de scolarité : ${formatCurrency(totalUnpaid)}`, date: new Date().toISOString() });
    if (totalStudents === 0) alertList.push({ type: 'info', message: 'Aucun élève inscrit pour le moment', date: new Date().toISOString() });
    setAlerts(alertList);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!school) {
    return (
      <EmptyState
        icon={<AlertTriangle size={40} />}
        title="Configuration incomplète"
        description="Le compte est connecté, mais aucun profil établissement exploitable n'a été chargé. Vérifiez les tables roles, schools, profiles et academic_years dans Supabase."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de {school?.name || 'votre établissement'}</p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
              a.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <AlertTriangle size={16} />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Premium Financial Summary & Tuition Fee Recovery Ratio */}
      <div className="surface-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div>
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full border border-indigo-500/30 uppercase tracking-wider">
              Ratio & Suivi Financier
            </span>
            <h2 className="text-xl font-bold text-white mt-2">Recouvrement des Frais de Scolarité</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-left md:text-right">
              <p className="text-xs text-slate-400">Taux de Recouvrement (Montant)</p>
              <p className="text-3xl font-extrabold text-emerald-400">{stats.recoveryRate}%</p>
            </div>
            <div className="text-left md:text-right border-l border-slate-700 pl-6">
              <p className="text-xs text-slate-400">Élèves Ayant Versé</p>
              <p className="text-3xl font-extrabold text-teal-300">{stats.studentPaymentRate}%</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-300">
            <span>Déjà Encaissé : <strong className="text-emerald-400">{formatCurrency(stats.totalPayments)}</strong></span>
            <span>Total Attendu : <strong className="text-white">{formatCurrency(stats.totalExpectedFees)}</strong></span>
          </div>
          <div className="w-full h-3 bg-slate-700/80 rounded-full overflow-hidden p-0.5 border border-slate-600/50">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.recoveryRate)}%` }}
            />
          </div>
        </div>

        {/* Key Ratios Breakdown Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
            <p className="text-xs text-slate-400">Total Exigible (Frais)</p>
            <p className="text-base font-bold text-white mt-1">{formatCurrency(stats.totalExpectedFees)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Budget scolarité attendu</p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
            <p className="text-xs text-slate-400">Paiements Encaissés</p>
            <p className="text-base font-bold text-emerald-400 mt-1">{formatCurrency(stats.totalPayments)}</p>
            <p className="text-[11px] text-emerald-300/80 mt-1">{stats.recoveryRate}% du budget perçu</p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
            <p className="text-xs text-slate-400">Reste à Percevoir</p>
            <p className="text-base font-bold text-rose-400 mt-1">{formatCurrency(stats.totalUnpaid)}</p>
            <p className="text-[11px] text-rose-300/80 mt-1">Reliquat des créances</p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
            <p className="text-xs text-slate-400">Répartition Élèves</p>
            <p className="text-base font-bold text-amber-300 mt-1">{stats.studentsWithPayment} / {stats.totalActiveStudents} élèves actifs</p>
            <p className="text-[11px] text-slate-300 mt-1">
              {stats.totalInactiveStudents > 0
                ? `${stats.totalInactiveStudents} archivé(s)/transféré(s) • ${stats.studentsWithoutPayment} sans versement`
                : `${stats.studentsWithoutPayment} n'ont rien versé`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<GraduationCap size={20} />}
          value={stats.totalActiveStudents}
          label="Élèves inscrits actifs"
          color="blue"
          subLabel={stats.totalInactiveStudents > 0 ? `${stats.totalStudents} au total • ${stats.totalInactiveStudents} archivé` : undefined}
          trend={stats.totalInactiveStudents > 0 ? { value: stats.totalStudents, up: true, label: `${stats.totalStudents} total` } : { value: 12, up: true }}
        />
        <StatCard icon={<Users size={20} />} value={`${stats.totalBoys} / ${stats.totalGirls}`} label="Garçons / Filles" color="teal" />
        <StatCard icon={<BookOpen size={20} />} value={stats.totalTeachers} label="Enseignants" color="green" />
        <StatCard icon={<Users size={20} />} value={stats.totalParents} label="Parents" color="slate" />
        <StatCard icon={<DollarSign size={20} />} value={formatCurrency(stats.totalPayments)} label="Paiements encaissés" color="green" trend={{ value: 8, up: true }} />
        <StatCard icon={<AlertTriangle size={20} />} value={formatCurrency(stats.totalUnpaid)} label="Impayés" color="red" />
        <StatCard icon={<Wallet size={20} />} value={formatCurrency(stats.cashBalance)} label="Solde de caisse" color="blue" />
        <StatCard icon={<TrendingUp size={20} />} value={formatCurrency(stats.recentExpenses)} label="Dépenses totales" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="surface-card lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Paiements mensuels</h3>
          {paymentByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={paymentByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                <Area type="monotone" dataKey="montant" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée de paiement</div>
          )}
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Statut des paiements</h3>
          {paymentStatus.some(s => s.value > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(((percent ?? 0) * 100)).toFixed(0)}%`}>
                {paymentStatus.map((entry, i) => {
                  const colors: Record<string, string> = {
                    'Payé': '#059669',
                    'Partiel': '#f59e0b',
                    'Impayé': '#ef4444'
                  };
                  return <Cell key={i} fill={colors[entry.name] || '#64748b'} />;
                })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Élèves par niveau</h3>
          {studentsByLevel.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={studentsByLevel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Aucun élève inscrit</div>
          )}
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Paiements récents</h3>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {(p.student || p.students)?.first_name} {(p.student || p.students)?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{p.receipt_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-500">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Aucun paiement récent</div>
          )}
        </div>
      </div>
    </div>
  );
}
