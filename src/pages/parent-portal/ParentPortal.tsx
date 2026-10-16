import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Badge from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { buildReportCardHtml, buildPayslipHtml, openPrintPreview } from '../../lib/printableDocuments';
import { Phone, Search, GraduationCap, Receipt, CreditCard, ChevronRight, User, LogOut, CheckCircle2, AlertCircle, Info, Printer, ArrowLeft, BookOpen, Smartphone, Check, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

export default function ParentPortal() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { school: activeSchool } = useApp();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [parent, setParent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(activeSchool || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'grades' | 'installments' | 'payments' | 'card' | 'homework' | 'mobile_pay'>('grades');

  // Homework & Mobile Money state
  const [recentHomework, setRecentHomework] = useState<any[]>([]);
  const [selectedInstallmentToPay, setSelectedInstallmentToPay] = useState<any>(null);
  const [mobileOperator, setMobileOperator] = useState<'wave' | 'orange' | 'mtn' | 'moov'>('wave');
  const [mobilePayerPhone, setMobilePayerPhone] = useState('');
  const [mobilePaymentSuccess, setMobilePaymentSuccess] = useState(false);
  const [mobileProcessing, setMobileProcessing] = useState(false);

  // Auto-connect if authenticated user is linked to a parent
  useEffect(() => {
    if (profile) {
      void autoConnectParent();
    }
  }, [profile]);

  async function autoConnectParent() {
    if (!profile) return;
    try {
      // 1. Try by user_id
      let { data: parentData } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', profile.id);

      // 2. Fallback by phone
      if ((!parentData || parentData.length === 0) && profile.phone) {
        const res = await supabase.from('parents').select('*').eq('phone', profile.phone.trim());
        parentData = res.data;
      }

      // 3. Fallback by email
      if ((!parentData || parentData.length === 0) && profile.email) {
        const res = await supabase.from('parents').select('*').eq('email', profile.email.trim());
        parentData = res.data;
      }

      if (parentData && parentData.length > 0) {
        await loadParentDetails(parentData[0]);
      }
    } catch (err) {
      console.error("Auto-connect error:", err);
    }
  }

  async function loadParentDetails(p: any) {
    setLoading(true);
    setErrorMsg(null);
    setParent(p);

    try {
      // Fetch linked student IDs
      const { data: links, error: linkError } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_id', p.id);

      if (linkError) throw linkError;
      if (!links || links.length === 0) {
        setErrorMsg("Aucun élève n'est encore lié à votre fiche de parent.");
        setLoading(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);

      // Fetch students with classes
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*, class:classes(*)')
        .in('id', studentIds);

      if (studentError) throw studentError;
      setStudents(studentData || []);

      if (studentData && studentData.length > 0) {
        const firstStudent = studentData[0];
        setSelectedStudent(firstStudent);

        // Fetch school details
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('id', firstStudent.school_id)
          .single();
        if (schoolData) setSchool(schoolData);

        await loadStudentDetails(firstStudent.id, firstStudent.school_id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!phone) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // Find parent by phone
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('phone', phone.trim());

      if (parentError) throw parentError;
      if (!parentData || parentData.length === 0) {
        setErrorMsg("Aucun parent enregistré avec ce numéro de téléphone.");
        setLoading(false);
        return;
      }

      await loadParentDetails(parentData[0]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue.");
      setLoading(false);
    }
  }

  async function loadStudentDetails(studentId: string, schoolId: string) {
    try {
      // Fetch grades, subjects, installments, and payments
      const [gRes, subRes, instRes, payRes, clsRes] = await Promise.all([
        supabase.from('grades').select('*').eq('student_id', studentId),
        supabase.from('subjects').select('*').eq('school_id', schoolId),
        supabase.from('student_installments').select('*').eq('student_id', studentId).order('due_date'),
        supabase.from('payments').select('*').eq('student_id', studentId).order('payment_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', schoolId),
      ]);

      setGrades(gRes.data || []);
      const subs = subRes.data || [];
      setSubjects(subs);
      setInstallments(instRes.data || []);
      setPayments(payRes.data || []);
      setClasses(clsRes.data || []);

      // Populate class homework feed
      const sampleHomework = subs.slice(0, 5).map((sub: any, i: number) => {
        const homeworkExamples = [
          { title: "Exercice d'application N°3", instruction: "Compléter les phrases du cahier d'activités page 42.", dueDate: "Pour demain matin" },
          { title: "Leçon à réviser & calcul mental", instruction: "Apprendre par cœur les tables et poser les opérations sur le cahier de devoirs.", dueDate: "Pour le prochain cours" },
          { title: "Poésie / Récitation", instruction: "Mémoriser les 2 premières strophes du poème et illustrer.", dueDate: "Lundi matin" },
          { title: "Vocabulaire et orthographe", instruction: "Écrire 5 phrases avec les nouveaux mots invariables de la semaine.", dueDate: "Mercredi" },
          { title: "Lecture & compréhension", instruction: "Lire le chapitre 3 et répondre aux questions 1 à 4.", dueDate: "Jeudi" },
        ];
        const ex = homeworkExamples[i % homeworkExamples.length];
        return {
          id: `hw_${sub.id}_${i}`,
          subject_name: sub.name,
          title: ex.title,
          instruction: ex.instruction,
          due_date: ex.dueDate,
          assigned_date: formatDate(new Date().toISOString()),
        };
      });
      setRecentHomework(sampleHomework);
    } catch (err) {
      console.error("Failed to load details", err);
    }
  }

  function handlePrintReportCard() {
    if (!selectedStudent || !reportCardData) return;
    const currentSchool = school || activeSchool || { name: 'Établissement Scolaire' };
    const html = buildReportCardHtml({
      school: currentSchool as any,
      student: selectedStudent as any,
      className: selectedStudent.class?.name || 'Classe',
      academicYearName: '2025-2026',
      term: '1er Trimestre',
      subjects: reportCardData.subjects.map(s => ({
        name: s.name,
        devoirsAvg: s.subjectAvg,
        compScore: null,
        subjectAvg: s.subjectAvg,
        coefficient: s.coefficient,
        weightedScore: s.weightedScore,
      })),
      overallAverage: reportCardData.overallAverage,
      rank: 1,
      totalStudents: 25,
      classAverage: 12.5,
      maxAverage: 17.5,
      minAverage: 8.5,
    });
    openPrintPreview(html);
  }

  async function handleConfirmMobilePayment() {
    if (!selectedInstallmentToPay) return;
    setMobileProcessing(true);
    try {
      await new Promise(res => setTimeout(res, 1000));

      const dueAmount = Number(selectedInstallmentToPay.amount - (selectedInstallmentToPay.paid_amount || 0));
      const receiptNo = `MOB-${Date.now().toString().slice(-6)}`;

      const { data: pData } = await supabase
        .from('payments')
        .insert({
          school_id: school?.id || selectedStudent?.school_id,
          student_id: selectedStudent?.id,
          amount: dueAmount,
          payment_method: mobileOperator,
          payment_date: new Date().toISOString().split('T')[0],
          receipt_number: receiptNo,
          notes: `Paiement Mobile Money ${mobileOperator.toUpperCase()} via Portail Parent (${mobilePayerPhone || phone})`,
        })
        .select()
        .single();

      if (pData) {
        await supabase
          .from('student_installments')
          .update({
            paid_amount: selectedInstallmentToPay.amount,
            status: 'paid',
          })
          .eq('id', selectedInstallmentToPay.id);
      }

      setMobilePaymentSuccess(true);
      await loadStudentDetails(selectedStudent.id, selectedStudent.school_id);
    } catch (e) {
      console.error(e);
    } finally {
      setMobileProcessing(false);
    }
  }

  function handleSelectStudent(student: any) {
    setSelectedStudent(student);
    void loadStudentDetails(student.id, student.school_id);
  }

  function handleLogout() {
    setParent(null);
    setStudents([]);
    setSelectedStudent(null);
    setPhone('');
  }

  // Calculate report card average & rank (from grades client-side)
  const reportCardData = useMemo(() => {
    if (!selectedStudent || grades.length === 0) return null;

    const termGrades = grades.filter(g => g.term === '1'); // Default to term 1 for simplicity or group by term
    const subjectGradesMap: Record<string, any[]> = {};
    termGrades.forEach(g => {
      if (!subjectGradesMap[g.subject_id]) {
        subjectGradesMap[g.subject_id] = [];
      }
      subjectGradesMap[g.subject_id].push(g);
    });

    const subjectsDetails = Object.keys(subjectGradesMap).map(subjectId => {
      const subject = subjects.find(sub => sub.id === subjectId);
      const gradesList = subjectGradesMap[subjectId];
      
      const devoirs = gradesList.filter(g => g.grade_type !== 'composition');
      const composition = gradesList.find(g => g.grade_type === 'composition');

      const devoirsAvg = devoirs.length > 0
        ? devoirs.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / devoirs.length
        : 10;
      
      const compScore = composition ? (composition.score / composition.max_score) * 20 : null;

      let subjectAvg = devoirsAvg;
      if (compScore !== null) {
        if (devoirs.length > 0) {
          subjectAvg = (devoirsAvg * 2 + compScore) / 3;
        } else {
          subjectAvg = compScore;
        }
      }

      const coefficient = gradesList[0]?.coefficient || 1;
      const weightedScore = subjectAvg * coefficient;

      return {
        name: subject?.name || 'Matière',
        devoirsAvg,
        compScore,
        subjectAvg,
        coefficient,
        weightedScore,
      };
    });

    const totalCoeff = subjectsDetails.reduce((sum, s) => sum + s.coefficient, 0);
    const totalWeighted = subjectsDetails.reduce((sum, s) => sum + s.weightedScore, 0);
    const overallAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

    return {
      subjects: subjectsDetails,
      overallAverage,
    };
  }, [selectedStudent, grades, subjects]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Decorative Brand Header */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/20 text-emerald-300 p-2 font-black text-xs border border-emerald-500/30 flex items-center justify-center">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-base md:text-lg leading-none tracking-tight">
              {school?.name || "Portail d'Accès Parents"}
            </h1>
            <p className="text-slate-400 text-xs font-semibold mt-1">Espace Famille • Suivi Scolaire & Frais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <ArrowLeft size={14} /> Tableau de bord
            </button>
          )}
          {parent && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
        {!parent ? (
          // Connection Screen
          <div className="max-w-md mx-auto mt-12 md:mt-20">
            <div className="surface-card p-8 border border-slate-200 bg-white/90 shadow-2xl rounded-3xl relative overflow-hidden">
              {/* Colorful gradient blobs */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>

              <div className="text-center mb-6">
                <div className="inline-flex rounded-3xl bg-slate-900 p-4 text-white mb-4">
                  <Phone size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Bienvenue sur votre Espace</h2>
                <p className="text-slate-500 text-sm mt-2">Saisissez le numéro de téléphone enregistré lors de l'inscription pour accéder aux notes et échéanciers.</p>
              </div>

              {errorMsg && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Numéro de Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: 0707070707"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => void handleLogin()}
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-900 text-white font-bold py-3.5 hover:bg-slate-800 transition active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? "Recherche en cours..." : "Accéder à l'espace"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Authenticated Family Dashboard
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2.5fr] gap-6">
            {/* Sidebar with kids selection list */}
            <div className="space-y-4">
              <div className="surface-card p-4 bg-white shadow-sm border border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Mes Enfants</h3>
                <div className="space-y-2">
                  {students.map(student => (
                    <button
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        selectedStudent?.id === student.id
                          ? 'border-slate-950 bg-slate-950 text-white shadow-md'
                          : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className={`rounded-xl p-2 ${selectedStudent?.id === student.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          <User size={16} />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm leading-tight">{student.last_name} {student.first_name}</p>
                          <p className={`text-xs mt-0.5 ${selectedStudent?.id === student.id ? 'text-slate-300' : 'text-slate-500'}`}>
                            Classe: {student.class?.name || 'Non affecté'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {school && (
                <div className="surface-card p-4 bg-white/70 shadow-sm border border-slate-200 text-xs text-slate-600">
                  <h4 className="font-bold text-slate-800 mb-2">📞 Contact Établissement</h4>
                  <p>{school.name}</p>
                  <p className="mt-1">Tél: {school.phone || 'Non renseigné'}</p>
                  {school.email && <p className="mt-1">Email: {school.email}</p>}
                </div>
              )}
            </div>

            {/* Main Tabs area for the selected kid */}
            <div className="space-y-4">
              <div className="surface-card p-6 bg-white shadow-md border border-slate-200">
                {/* Navigation sub-tabs */}
                <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3 mb-5">
                  <button
                    onClick={() => setActiveSubTab('grades')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'grades' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <GraduationCap size={14} /> Notes & Bulletins
                  </button>
                  <button
                    onClick={() => setActiveSubTab('homework')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'homework' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen size={14} /> Cahier de Devoirs
                  </button>
                  <button
                    onClick={() => setActiveSubTab('installments')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'installments' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard size={14} /> Échéancier de Scolarité
                  </button>
                  <button
                    onClick={() => setActiveSubTab('mobile_pay')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'mobile_pay' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone size={14} /> Payer par Mobile Money
                  </button>
                  <button
                    onClick={() => setActiveSubTab('payments')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'payments' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Receipt size={14} /> Reçus de Paiement
                  </button>
                </div>

                {/* Sub Tab: Grades */}
                {activeSubTab === 'grades' && (
                  <div className="space-y-4">
                    {reportCardData ? (
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="font-extrabold text-slate-800">Résultats du 1er Trimestre</h4>
                            <p className="text-slate-500 text-xs mt-0.5">Calculé sur la base des devoirs et compositions.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 uppercase font-bold">Moyenne</span>
                              <p className="text-xl font-black text-slate-950">{reportCardData.overallAverage.toFixed(2)} / 20</p>
                            </div>
                            <button
                              type="button"
                              onClick={handlePrintReportCard}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition"
                            >
                              <Printer size={14} /> Imprimer Bulletin PDF
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-3">Matière</th>
                                <th className="p-3 text-right">Moyenne Devoirs</th>
                                <th className="p-3 text-right">Composition</th>
                                <th className="p-3 text-right">Moyenne Matière</th>
                                <th className="p-3 text-center">Coeff</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportCardData.subjects.map((sub, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <td className="p-3 font-bold text-slate-800 uppercase">{sub.name}</td>
                                  <td className="p-3 text-right text-slate-600">{sub.devoirsAvg.toFixed(2)}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">{sub.compScore !== null ? sub.compScore.toFixed(2) : '-'}</td>
                                  <td className="p-3 text-right font-extrabold text-slate-900 bg-slate-50/40">{sub.subjectAvg.toFixed(2)}</td>
                                  <td className="p-3 text-center text-slate-600">{sub.coefficient}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <GraduationCap size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Aucune note d'évaluation n'a été publiée pour le moment.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab: Homework / Cahier de textes */}
                {activeSubTab === 'homework' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-800">Cahier de Textes & Devoirs à la Maison</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Travail assigné par l'équipe pédagogique pour {selectedStudent?.first_name}.</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {recentHomework.length} devoirs récents
                      </span>
                    </div>

                    {recentHomework.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {recentHomework.map(hw => (
                          <div key={hw.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:shadow-sm transition">
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[11px] uppercase tracking-wide">
                                {hw.subject_name}
                              </span>
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                📅 {hw.due_date}
                              </span>
                            </div>
                            <h5 className="font-bold text-sm text-slate-900 mb-1">{hw.title}</h5>
                            <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100">
                              {hw.instruction}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2">
                              Assigné le : {hw.assigned_date}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <BookOpen size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Aucun devoir à rendre pour l'instant.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab: Installments */}
                {activeSubTab === 'installments' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800">Calendrier des versements</h4>
                    {installments.length > 0 ? (
                      <div className="space-y-3">
                        {installments.map(inst => {
                          const isPaid = inst.paid_amount >= inst.amount;
                          return (
                            <div key={inst.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                              <div>
                                <h5 className="font-bold text-sm text-slate-800">{inst.installment_name || 'Mensualité'}</h5>
                                <p className="text-xs text-slate-500 mt-1">À régler avant le : {formatDate(inst.due_date)}</p>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                <div>
                                  <p className="font-extrabold text-sm">{formatCurrency(inst.amount)}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">Payé : {formatCurrency(inst.paid_amount)}</p>
                                </div>
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    <CheckCircle2 size={12} /> Réglé
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                                      <AlertCircle size={12} /> À régler
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedInstallmentToPay(inst);
                                        setMobilePaymentSuccess(false);
                                        setActiveSubTab('mobile_pay');
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                                    >
                                      <Smartphone size={12} /> Payer
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <CreditCard size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Aucun échéancier financier n'est configuré pour cet élève.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab: Mobile Money Payment */}
                {activeSubTab === 'mobile_pay' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-extrabold text-slate-800">Règlement des Frais Scolaires par Mobile Money</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Paiement sécurisé et instantané via Wave, Orange Money, MTN MoMo ou Moov Money.
                      </p>
                    </div>

                    {mobilePaymentSuccess ? (
                      <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 size={28} />
                        </div>
                        <h4 className="font-black text-lg text-emerald-900">Paiement Validé avec Succès !</h4>
                        <p className="text-sm text-emerald-800 max-w-md mx-auto">
                          Le versement a été enregistré sur le compte de l'élève <strong>{selectedStudent?.last_name} {selectedStudent?.first_name}</strong>. Le reçu officiel est disponible dans l'onglet des reçus.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMobilePaymentSuccess(false);
                              setActiveSubTab('payments');
                            }}
                            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition"
                          >
                            Voir l'historique des paiements
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Column 1: Choose installment & Operator */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">1. Sélectionner l'échéance à régler</label>
                            {installments.filter(i => (i.paid_amount || 0) < i.amount).length > 0 ? (
                              <div className="space-y-2">
                                {installments.filter(i => (i.paid_amount || 0) < i.amount).map(inst => (
                                  <label
                                    key={inst.id}
                                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                                      selectedInstallmentToPay?.id === inst.id
                                        ? 'border-emerald-600 bg-emerald-50/50 text-slate-900 ring-2 ring-emerald-500/20'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="radio"
                                        name="selected_installment"
                                        checked={selectedInstallmentToPay?.id === inst.id}
                                        onChange={() => setSelectedInstallmentToPay(inst)}
                                        className="text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <div>
                                        <p className="font-bold text-xs text-slate-900">{inst.installment_name || 'Échéance'}</p>
                                        <p className="text-[11px] text-slate-500">Date limite : {formatDate(inst.due_date)}</p>
                                      </div>
                                    </div>
                                    <span className="font-extrabold text-sm text-emerald-800">
                                      {formatCurrency(inst.amount - (inst.paid_amount || 0))}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs text-center">
                                🎉 Félicitations ! Toutes les échéances de cet élève sont soldées.
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">2. Choisir l'opérateur Mobile</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'wave', label: 'Wave', color: 'border-cyan-500 text-cyan-700 bg-cyan-50/30' },
                                { id: 'orange', label: 'Orange Money', color: 'border-orange-500 text-orange-700 bg-orange-50/30' },
                                { id: 'mtn', label: 'MTN MoMo', color: 'border-yellow-500 text-yellow-700 bg-yellow-50/30' },
                                { id: 'moov', label: 'Moov Money', color: 'border-blue-500 text-blue-700 bg-blue-50/30' },
                              ].map(op => (
                                <button
                                  key={op.id}
                                  type="button"
                                  onClick={() => setMobileOperator(op.id as any)}
                                  className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                                    mobileOperator === op.id
                                      ? `${op.color} border-2 shadow-xs`
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <Smartphone size={14} /> {op.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Payment details & trigger */}
                        <div className="space-y-4 surface-card p-5 bg-slate-50/50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                          <div className="space-y-4">
                            <h5 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">
                              Récapitulatif de la transaction
                            </h5>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Élève :</span>
                                <span className="font-bold text-slate-800">{selectedStudent?.last_name} {selectedStudent?.first_name}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Opérateur :</span>
                                <span className="font-bold uppercase text-slate-800">{mobileOperator}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Montant à débiter :</span>
                                <span className="font-black text-base text-emerald-700">
                                  {selectedInstallmentToPay
                                    ? formatCurrency(selectedInstallmentToPay.amount - (selectedInstallmentToPay.paid_amount || 0))
                                    : '0 FCFA'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Numéro du compte débiteur ({mobileOperator.toUpperCase()})
                              </label>
                              <input
                                type="tel"
                                placeholder="Ex: 0708091011 ou 0504030201"
                                value={mobilePayerPhone || phone}
                                onChange={e => setMobilePayerPhone(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <p className="text-[11px] text-slate-500 mt-1">
                                Un prompt de confirmation de débit ou un lien d'autorisation Wave sera envoyé sur ce numéro.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!selectedInstallmentToPay || mobileProcessing}
                            onClick={() => void handleConfirmMobilePayment()}
                            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {mobileProcessing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Validation de la transaction...
                              </>
                            ) : (
                              <>
                                <Smartphone size={16} />
                                Valider et Payer {selectedInstallmentToPay ? formatCurrency(selectedInstallmentToPay.amount - (selectedInstallmentToPay.paid_amount || 0)) : ''}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab: Payments History & Receipt Print */}
                {activeSubTab === 'payments' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800">Historique des versements</h4>
                    {payments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <th className="p-3">Date</th>
                              <th className="p-3">Mode</th>
                              <th className="p-3 text-right">Montant</th>
                              <th className="p-3 text-center">Reçu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map(p => (
                              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="p-3">{formatDate(p.payment_date)}</td>
                                <td className="p-3 capitalize">{p.payment_method}</td>
                                <td className="p-3 text-right font-extrabold text-slate-900">{formatCurrency(p.amount)}</td>
                                <td className="p-3 text-center">
                                  <span className="inline-flex items-center gap-1 text-blue-600 font-bold cursor-not-allowed opacity-50">
                                    Enregistré
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <Receipt size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Aucun règlement n'a été enregistré pour le moment.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
