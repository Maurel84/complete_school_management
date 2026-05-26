import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency } from '../../lib/utils';
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
    totalStudents: 0, totalBoys: 0, totalGirls: 0,
    totalTeachers: 0, totalParents: 0,
    totalPayments: 0, totalUnpaid: 0,
    cashBalance: 0, recentExpenses: 0,
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
    const yearId = academicYear?.id;

    const [studentsRes, teachersRes, parentsRes, paymentsRes, feesRes, expensesRes, cashRes] = await Promise.all([
      supabase.from('students').select('id, sex, class_id').eq('school_id', schoolId).eq('status', 'active'),
      supabase.from('teachers').select('id').eq('school_id', schoolId).eq('status', 'active'),
      supabase.from('parents').select('id').eq('school_id', schoolId),
      supabase.from('payments').select('amount, payment_date, status').eq('school_id', schoolId),
      supabase.from('fees').select('amount, id').eq('school_id', schoolId),
      supabase.from('expenses').select('amount, expense_date').eq('school_id', schoolId).eq('status', 'validated'),
      supabase.from('cash_transactions').select('type, amount, validated').eq('school_id', schoolId).eq('validated', true),
    ]);

    const students = studentsRes.data || [];
    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];
    const cashTx = cashRes.data || [];

    const totalStudents = students.length;
    const totalBoys = students.filter(s => s.sex === 'M').length;
    const totalGirls = students.filter(s => s.sex === 'F').length;
    const totalTeachers = (teachersRes.data || []).length;
    const totalParents = (parentsRes.data || []).length;
    const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const cashIn = cashTx.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
    const cashOut = cashTx.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const cashBalance = cashIn - cashOut;

    const totalFees = (feesRes.data || []).reduce((s, f) => s + Number(f.amount), 0) * totalStudents;
    const totalUnpaid = Math.max(0, totalFees - totalPayments);

    setStats({ totalStudents, totalBoys, totalGirls, totalTeachers, totalParents, totalPayments, totalUnpaid, cashBalance, recentExpenses: totalExpenses });

    // Payments by month
    const monthMap: Record<string, number> = {};
    payments.forEach(p => {
      const month = new Date(p.payment_date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      monthMap[month] = (monthMap[month] || 0) + Number(p.amount);
    });
    setPaymentByMonth(Object.entries(monthMap).map(([name, montant]) => ({ name, montant })));

    // Students by level
    const levelRes = await supabase.from('levels').select('id, name').eq('school_id', schoolId);
    const classRes = await supabase.from('classes').select('id, level_id, name').eq('school_id', schoolId);
    const levels = levelRes.data || [];
    const classes = classRes.data || [];
    const levelStudents = levels.map(l => {
      const levelClasses = classes.filter(c => c.level_id === l.id);
      const count = students.filter(s => levelClasses.some(c => c.id === s.class_id)).length;
      return { name: l.name, value: count };
    }).filter(l => l.value > 0);
    setStudentsByLevel(levelStudents);

    // Payment status
    const paidCount = payments.filter(p => p.status === 'paid').length;
    const partialCount = payments.filter(p => p.status === 'partial').length;
    const unpaidCount = Math.max(0, totalStudents - paidCount - partialCount);
    setPaymentStatus([
      { name: 'Payé', value: paidCount },
      { name: 'Partiel', value: partialCount },
      { name: 'Impayé', value: unpaidCount },
    ]);

    // Recent payments
    const { data: recentData } = await supabase
      .from('payments')
      .select('*, students(first_name, last_name, matricule)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentPayments(recentData || []);

    // Alerts
    const alertList: {type: string; message: string; date: string}[] = [];
    if (totalUnpaid > 0) alertList.push({ type: 'warning', message: `${totalUnpaid > 100000 ? 'Montant important d\'impayés : ' : 'Impayés : '}${formatCurrency(totalUnpaid)}`, date: new Date().toISOString() });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<GraduationCap size={20} />} value={stats.totalStudents} label="Élèves inscrits" color="blue" trend={{ value: 12, up: true }} />
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
                {paymentStatus.map((_, i) => (
                  <Cell key={i} fill={['#059669', '#f59e0b', '#ef4444'][i] || COLORS[i]} />
                ))}
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
                    <p className="text-sm font-medium text-gray-700">{p.students?.first_name} {p.students?.last_name}</p>
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
