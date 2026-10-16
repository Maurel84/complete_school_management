import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency } from '../../lib/utils';
import { resolveStudentFinance } from '../../lib/financePlanResolver';
import { resolveTeacherClass, resolveParentChildren } from '../../lib/roleDataResolver';
import {
  GraduationCap, Users, BookOpen, DollarSign, Wallet,
  AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight,
  CalendarCheck, ClipboardList, MessageSquare, Printer, CheckCircle2, Mail, Sparkles, Phone
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';

const COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile, isTeacher, isParent, role } = useAuth();
  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const isParentUser = isParent || role === 'parent' || (profile?.role as any)?.name === 'parent' || profile?.account_type === 'parent';

  // Teacher State
  const [teacherClass, setTeacherClass] = useState<any>(null);
  const [teacherRoleLabel, setTeacherRoleLabel] = useState<string>('Enseignante Stagiaire');
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);
  const [teacherAttendanceStats, setTeacherAttendanceStats] = useState({
    recorded: false,
    present: 0,
    absent: 0,
    late: 0,
    total: 0,
    rate: 100,
  });
  const [teacherAbsentsToday, setTeacherAbsentsToday] = useState<any[]>([]);
  const [teacherRecentGrades, setTeacherRecentGrades] = useState<any[]>([]);

  // Parent State
  const [parentRecord, setParentRecord] = useState<any>(null);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [parentFinances, setParentFinances] = useState<{
    totalExpected: number;
    totalPaid: number;
    totalRemaining: number;
    payments: any[];
    byChild: Record<string, { expected: number; paid: number; remaining: number; status?: string; planName?: string; schedule?: any[] }>;
  }>({
    totalExpected: 0,
    totalPaid: 0,
    totalRemaining: 0,
    payments: [],
    byChild: {},
  });
  const [parentRecentGrades, setParentRecentGrades] = useState<any[]>([]);
  const [parentAttendanceStats, setParentAttendanceStats] = useState<{
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate: number;
  }>({
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    attendanceRate: 100,
  });

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

    if (isTeacherUser) {
      try {
        const { assignedClass, roleLabel } = await resolveTeacherClass(schoolId, profile);
        setTeacherClass(assignedClass);
        if (roleLabel) setTeacherRoleLabel(roleLabel);

        if (assignedClass) {
          const { data: sData } = await supabase
            .from('students')
            .select('*, parents:student_parents(parent:parents(*))')
            .eq('school_id', schoolId)
            .eq('class_id', assignedClass.id)
            .eq('status', 'active')
            .order('last_name');

          const classStudentsList = sData || [];
          setTeacherStudents(classStudentsList);

          const todayStr = new Date().toISOString().split('T')[0];
          const { data: attData } = await supabase
            .from('attendance')
            .select('*, student:students(*)')
            .eq('school_id', schoolId)
            .eq('class_id', assignedClass.id)
            .eq('date', todayStr);

          let pres = 0;
          let abs = 0;
          let lte = 0;
          const absents: any[] = [];
          (attData || []).forEach(a => {
            if (a.status === 'present') pres++;
            else if (a.status === 'absent') {
              abs++;
              absents.push(a);
            } else if (a.status === 'late') {
              lte++;
              absents.push(a);
            }
          });

          setTeacherAttendanceStats({
            recorded: (attData || []).length > 0,
            present: pres,
            absent: abs,
            late: lte,
            total: classStudentsList.length,
            rate: classStudentsList.length > 0
              ? Math.round(((pres + lte * 0.5) / classStudentsList.length) * 100)
              : 100,
          });
          setTeacherAbsentsToday(absents);

          const { data: gData } = await supabase
            .from('grades')
            .select('*, subject:subjects(*), student:students(first_name, last_name)')
            .eq('school_id', schoolId)
            .eq('class_id', assignedClass.id)
            .order('date', { ascending: false })
            .limit(10);

          setTeacherRecentGrades(gData || []);
        }
      } catch (err) {
        console.error('Teacher dashboard loading error:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isParentUser) {
      try {
        const { parentRecord: pRec, children, childrenIds } = await resolveParentChildren(schoolId, profile);
        setParentRecord(pRec);
        setParentChildren(children);

        if (childrenIds.length > 0) {
          // Fetch personal fees & payments ONLY for their own children + payment plans and classes
          const [feesRes, payRes, canteenPayRes, gradesRes, attRes, plansRes, clsRes] = await Promise.all([
            supabase.from('student_fees').select('*, fee_type:fee_types(*)').in('student_id', childrenIds),
            supabase.from('payments').select('*, receipts(*)').in('student_id', childrenIds).order('payment_date', { ascending: false }),
            supabase.from('canteen_payments').select('*').in('student_id', childrenIds),
            supabase.from('grades').select('*, subject:subjects(*), student:students(first_name, last_name)').in('student_id', childrenIds).order('date', { ascending: false }).limit(10),
            supabase.from('attendance').select('*, student:students(first_name, last_name)').in('student_id', childrenIds).order('date', { ascending: false }).limit(50),
            supabase.from('payment_plans').select('*, levels:payment_plan_levels(*), schedule:payment_plan_schedules(*), composition:payment_plan_compositions(*)').eq('school_id', schoolId),
            supabase.from('classes').select('*, level:levels(*)').eq('school_id', schoolId),
          ]);

          const allFees = feesRes.data || [];
          const allPayments = payRes.data || [];
          const allCanteen = canteenPayRes.data || [];
          const allPlans = plansRes.data || [];
          const allClasses = clsRes.data || [];

          let totalExpected = 0;
          let totalPaid = 0;
          const byChild: Record<string, { expected: number; paid: number; remaining: number; status?: string; planName?: string; schedule?: any[] }> = {};

          children.forEach(child => {
            const childFin = resolveStudentFinance({
              student: child,
              plans: allPlans,
              studentFees: allFees,
              tuitionPayments: allPayments,
              canteenPayments: allCanteen,
              classes: allClasses,
            });

            totalExpected += childFin.totalExpected;
            totalPaid += childFin.totalPaid;

            byChild[child.id] = {
              expected: childFin.totalExpected,
              paid: childFin.totalPaid,
              remaining: childFin.remaining,
              status: childFin.status,
              planName: childFin.planName,
              schedule: childFin.schedule,
            };
          });

          setParentFinances({
            totalExpected,
            totalPaid,
            totalRemaining: Math.max(0, totalExpected - totalPaid),
            payments: allPayments,
            byChild,
          });

          setParentRecentGrades(gradesRes.data || []);

          const attList = attRes.data || [];
          let pres = 0;
          let abs = 0;
          let lte = 0;
          attList.forEach((a: any) => {
            if (a.status === 'present') pres++;
            else if (a.status === 'absent') abs++;
            else if (a.status === 'late') lte++;
          });

          const totalAtt = pres + abs + lte;
          setParentAttendanceStats({
            presentCount: pres,
            absentCount: abs,
            lateCount: lte,
            attendanceRate: totalAtt > 0 ? Math.round(((pres + lte * 0.5) / totalAtt) * 100) : 100,
          });
        }
      } catch (err) {
        console.error('Parent dashboard loading error:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

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

    allStudents.forEach((student: any) => {
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

      if (student.status === 'active') {
        if (fin.status === 'paid') {
          paidStudentsCount++;
        } else if (fin.status === 'partial') {
          partialStudentsCount++;
        } else {
          unpaidStudentsCount++;
        }
      }
    });

    // Actual collected sums from payments table and canteen_payments table (excluding cancelled)
    const totalPaidTuition = payments
      .filter((p: any) => p.status !== 'cancelled')
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

  // Dedicated Teacher Dashboard (100% focused on teacher's class, ZERO financial data)
  if (isTeacherUser) {
    const boysCount = teacherStudents.filter(s => s.sex === 'M').length;
    const girlsCount = teacherStudents.filter(s => s.sex === 'F').length;

    return (
      <div className="space-y-6">
        {/* Teacher Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wider">
                Espace Pédagogique
              </span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                {teacherRoleLabel}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-2">
              Bonjour, {profile?.first_name} {profile?.last_name} 👋
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tableau de bord de votre classe • Année scolaire {academicYear?.name || '2026-2027'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/attendance')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98]"
            >
              <CalendarCheck size={16} />
              <span>Faire l'appel</span>
            </button>
            <button
              onClick={() => navigate('/grades')}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98]"
            >
              <ClipboardList size={16} />
              <span>Saisir des notes</span>
            </button>
            <button
              onClick={() => navigate('/documents')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold shadow-xs transition"
            >
              <Printer size={16} />
              <span>Documents classe</span>
            </button>
          </div>
        </div>

        {/* Attendance Status Alert Banner */}
        {teacherAttendanceStats.recorded ? (
          teacherAttendanceStats.absent > 0 || teacherAttendanceStats.late > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {teacherAttendanceStats.absent} élève(s) absent(s) et {teacherAttendanceStats.late} retard(s) aujourd'hui
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Classe : {teacherClass?.name} • Prévenez les parents directement par WhatsApp pour un suivi immédiat.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/attendance')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition flex-shrink-0"
              >
                <MessageSquare size={14} />
                <span>Alerter sur WhatsApp</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center gap-3 shadow-xs text-emerald-900">
              <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Tous les élèves de votre classe sont présents aujourd'hui !</p>
                <p className="text-xs text-emerald-700 mt-0.5">Appel validé avec 100% de présence.</p>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-bold">
                <CalendarCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">
                  L'appel du jour n'a pas encore été enregistré
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Effectuez le pointage de votre classe ({teacherClass?.name || 'Titulaire'}) en quelques clics.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/attendance')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition flex-shrink-0"
            >
              <span>Pointer maintenant</span>
            </button>
          </div>
        )}

        {/* 4 Class KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<GraduationCap size={20} />}
            value={teacherStudents.length}
            label={`Élèves de ${teacherClass?.name || 'ma classe'}`}
            color="blue"
            subLabel={`${boysCount} Garçons • ${girlsCount} Filles`}
          />
          <StatCard
            icon={<CalendarCheck size={20} />}
            value={`${teacherAttendanceStats.rate}%`}
            label="Présence aujourd'hui"
            color="green"
            subLabel={`${teacherAttendanceStats.present} présent(s) • ${teacherAttendanceStats.absent} absent(s)`}
          />
          <StatCard
            icon={<ClipboardList size={20} />}
            value={teacherRecentGrades.length}
            label="Évaluations récentes"
            color="teal"
            subLabel="Notes saisies ce trimestre"
          />
          <StatCard
            icon={<Users size={20} />}
            value={teacherStudents.length}
            label="Contacts familles"
            color="slate"
            subLabel="Parents joignables"
          />
        </div>

        {/* Quick Actions Shortcuts Banner */}
        <div className="surface-card p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Accès Direct</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Outils Rapides pour votre Classe</h3>
            </div>
            <span className="text-xs text-slate-300 font-semibold">{teacherClass?.name}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/attendance')}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-left flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                <CalendarCheck size={16} />
              </div>
              <p className="text-xs font-bold text-white">Feuille d'Appel</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Pointer les présences</p>
            </button>

            <button
              onClick={() => navigate('/grades')}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-left flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                <ClipboardList size={16} />
              </div>
              <p className="text-xs font-bold text-white">Carnet de Notes</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Devoirs & Compositions</p>
            </button>

            <button
              onClick={() => navigate('/messages')}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-left flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <Mail size={16} />
              </div>
              <p className="text-xs font-bold text-white">Messages Familles</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Diffusions & Échanges</p>
            </button>

            <button
              onClick={() => navigate('/documents')}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-left flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                <Printer size={16} />
              </div>
              <p className="text-xs font-bold text-white">Documents Classe</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Cartes, fiches & bulletins</p>
            </button>
          </div>
        </div>

        {/* Class Students Roster Table (Zero Financial Data) */}
        <div className="surface-card p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Trombinoscope & Liste des Élèves • {teacherClass?.name || 'Ma classe'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {teacherStudents.length} élèves inscrits actifs • Filiation et contacts d'urgence
              </p>
            </div>
            <button
              onClick={() => navigate('/students')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Voir la liste complète</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {teacherStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3">Élève</th>
                    <th className="p-3">Matricule</th>
                    <th className="p-3">Sexe</th>
                    <th className="p-3">Date de Naissance</th>
                    <th className="p-3">Parent Référent</th>
                    <th className="p-3 text-right">Contact WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStudents.map(student => {
                    const primaryParent = student.parents?.[0]?.parent;
                    const parentPhone = primaryParent?.phone || student.parent_phone || '';

                    return (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-2.5">
                          {student.photo_url ? (
                            <img
                              src={student.photo_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[11px]">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-extrabold text-slate-900 uppercase leading-tight">{student.last_name}</p>
                            <p className="font-medium text-slate-600 leading-tight">{student.first_name}</p>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{student.matricule}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              student.sex === 'F' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {student.sex === 'F' ? 'Fille' : 'Garçon'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {student.date_of_birth
                            ? new Date(student.date_of_birth).toLocaleDateString('fr-FR')
                            : '-'}
                        </td>
                        <td className="p-3 text-slate-700">
                          {primaryParent ? `${primaryParent.first_name} ${primaryParent.last_name}` : 'Non renseigné'}
                        </td>
                        <td className="p-3 text-right">
                          {parentPhone ? (
                            <a
                              href={`https://wa.me/${parentPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis l'enseignant(e) de ${student.first_name} au ${school?.name}.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition text-[11px]"
                            >
                              <MessageSquare size={12} />
                              <span>{parentPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Aucun numéro</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <GraduationCap size={40} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Aucun élève trouvé dans cette classe pour le moment.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isParentUser) {
    return (
      <div className="space-y-6">
        {/* Parent Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 surface-card p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-400/30 uppercase tracking-wider">
                Espace Famille • Portail Parent
              </span>
              <span className="px-3 py-1 bg-white/10 text-slate-200 text-xs font-bold rounded-full border border-white/10">
                Accès Sécurisé
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-white mt-2.5">
              Bonjour, {profile?.first_name} {profile?.last_name} 👋
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Suivi scolaire, assiduité, notes et frais de scolarité de vos enfants inscrits {school?.name ? `à ${school.name}` : 'à votre établissement scolaire'}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/grades')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98]"
            >
              <ClipboardList size={16} />
              <span>Notes & Bulletins</span>
            </button>
            <button
              onClick={() => navigate('/students')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition"
            >
              <GraduationCap size={16} />
              <span>Dossiers Enfants</span>
            </button>
            <button
              onClick={() => navigate('/supplies')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition"
            >
              <BookOpen size={16} />
              <span>Fournitures</span>
            </button>
          </div>
        </div>

        {/* If no children linked */}
        {parentChildren.length === 0 ? (
          <div className="surface-card p-8 text-center rounded-3xl border border-slate-200">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 font-bold">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Bienvenue sur votre Espace Famille</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
              Votre compte parent est activé. Pour lier le dossier de votre enfant à votre espace, veuillez contacter le secrétariat de l'école en précisant son nom et sa classe.
            </p>
            {school?.phone && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <a
                  href={`tel:${school.phone}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  <Phone size={14} />
                  <span>Appeler le secrétariat ({school.phone})</span>
                </a>
                <a
                  href={`https://wa.me/${school.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis ${profile?.first_name} ${profile?.last_name}, parent d'élève. Je souhaite lier le dossier de mon enfant.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                >
                  <MessageSquare size={14} />
                  <span>Contacter sur WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Children Cards Row */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                Vos Enfants Inscrits ({parentChildren.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parentChildren.map(child => {
                  const fin = parentFinances.byChild[child.id] || { expected: 0, paid: 0, remaining: 0 };
                  const isSettled = fin.remaining <= 0 && fin.expected > 0;

                  return (
                    <div
                      key={child.id}
                      className="surface-card p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3.5">
                        {child.photo_url ? (
                          <img
                            src={child.photo_url}
                            alt=""
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/20 shadow-xs flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-lg flex items-center justify-center flex-shrink-0 shadow-xs">
                            {child.first_name[0]}{child.last_name[0]}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            {child.class?.name || 'Classe'}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-base mt-1 truncate">
                            {child.first_name} {child.last_name}
                          </h3>
                          <p className="text-xs font-mono text-slate-500 font-bold">{child.matricule}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Statut Scolarité</span>
                          {fin.expected === 0 ? (
                            <span className="font-bold text-slate-600">Tarif non défini</span>
                          ) : isSettled ? (
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={13} /> Soldé
                            </span>
                          ) : (
                            <span className="font-bold text-amber-700">
                              Reste : {formatCurrency(fin.remaining)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => navigate('/students')}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs transition"
                        >
                          Voir dossier
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4 Parent StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Users size={20} />}
                value={parentChildren.length}
                label="Enfants Inscrits"
                color="blue"
                subLabel={parentChildren.map(c => c.class?.name).filter(Boolean).join(' • ') || 'Dossiers actifs'}
              />
              <StatCard
                icon={<DollarSign size={20} />}
                value={formatCurrency(parentFinances.totalPaid)}
                label="Scolarité Réglée"
                color="green"
                subLabel={`Sur ${formatCurrency(parentFinances.totalExpected)} attendus`}
              />
              <StatCard
                icon={<Wallet size={20} />}
                value={formatCurrency(parentFinances.totalRemaining)}
                label="Reliquat Restant"
                color={parentFinances.totalRemaining > 0 ? "amber" : "green"}
                subLabel={parentFinances.totalRemaining > 0 ? "Solde de vos enfants" : "Frais entièrement soldés"}
              />
              <StatCard
                icon={<CalendarCheck size={20} />}
                value={`${parentAttendanceStats.attendanceRate}%`}
                label="Assiduité & Présence"
                color="teal"
                subLabel={`${parentAttendanceStats.absentCount} absence(s) enregistrée(s)`}
              />
            </div>

            {/* Parent Tuition Tracking Card */}
            <div className="surface-card p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Frais de Scolarité Personnels de vos Enfants
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    État des règlements et reçus délivrés pour vos enfants
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  Année {academicYear?.name || '2026-2027'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-3">Enfant</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3 text-right">Frais Attendus</th>
                      <th className="p-3 text-right">Montant Réglé</th>
                      <th className="p-3 text-right">Reste à Payer</th>
                      <th className="p-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parentChildren.map(child => {
                      const fin = parentFinances.byChild[child.id] || { expected: 0, paid: 0, remaining: 0 };
                      const isSettled = fin.remaining <= 0 && fin.expected > 0;

                      return (
                        <tr key={child.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                          <td className="p-3 font-bold text-slate-900">
                            {child.first_name} {child.last_name} ({child.matricule})
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            {child.class?.name || '-'}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {formatCurrency(fin.expected)}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            +{formatCurrency(fin.paid)}
                          </td>
                          <td className="p-3 text-right font-bold">
                            <span className={isSettled ? 'text-emerald-700 font-bold' : 'text-amber-700 font-black'}>
                              {isSettled ? 'Soldé (0 FCFA)' : formatCurrency(fin.remaining)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                isSettled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : fin.paid > 0
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isSettled ? 'À jour' : fin.paid > 0 ? 'Partiel (En cours)' : 'En attente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Official Receipts History for Parent */}
              {parentFinances.payments.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Reçus & Règlements Enregistrés pour vos Enfants ({parentFinances.payments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {parentFinances.payments.map((p: any) => {
                      const child = parentChildren.find(c => c.id === p.student_id);
                      const receiptNum = p.receipts?.[0]?.receipt_number || p.receipt_number || `REC-${p.id?.slice(0, 6)}`;
                      return (
                        <div key={p.id} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-extrabold text-slate-900">
                              {child ? `${child.first_name} ${child.last_name}` : 'Votre enfant'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              N° {receiptNum} • {p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : '-'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-700 font-mono text-xs">
                              +{formatCurrency(Number(p.amount || 0))}
                            </span>
                            <span className="block text-[10px] font-medium text-slate-500 capitalize mt-0.5">
                              {p.payment_method === 'cash' ? 'Espèces' : p.payment_method === 'mobile_money' ? 'Mobile Money' : p.payment_method || 'Règlement'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Evaluations and Contacts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Grades */}
              <div className="surface-card p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-slate-900">Dernières Notes Reçues</h3>
                  <button
                    onClick={() => navigate('/grades')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Voir tout le bulletin
                  </button>
                </div>

                {parentRecentGrades.length > 0 ? (
                  <div className="space-y-2">
                    {parentRecentGrades.map(g => (
                      <div
                        key={g.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900 text-xs">
                            {g.subject?.name || 'Matière'} • {g.student?.first_name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {g.grade_type || 'Évaluation'} • {g.date ? new Date(g.date).toLocaleDateString('fr-FR') : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-black ${Number(g.score) >= 10 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {g.score} / {g.max_score || 20}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Aucune note publiée récemment pour vos enfants.
                  </div>
                )}
              </div>

              {/* Direct School Contacts */}
              <div className="surface-card p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">
                    Contactez l'Établissement
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Le secrétariat et les enseignants sont à votre disposition pour toute question.
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">Secrétariat & Direction</p>
                        <p className="text-[11px] text-slate-500">{school?.phone || 'Non renseigné'}</p>
                      </div>
                      {school?.phone && (
                        <a
                          href={`https://wa.me/${school.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis ${profile?.first_name} ${profile?.last_name}, parent d'élève.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition"
                        >
                          <MessageSquare size={13} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">Messagerie Interne</p>
                        <p className="text-[11px] text-slate-500">Communiquez directement avec l'équipe pédagogique</p>
                      </div>
                      <button
                        onClick={() => navigate('/messages')}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 transition"
                      >
                        <Mail size={13} />
                        <span>Écrire</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles size={14} className="text-emerald-600" />
                    Conseil aux Familles
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    Consultez régulièrement les cahiers de texte et prévenez l'école en cas d'absence imprévue de votre enfant.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
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
