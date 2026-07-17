import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { buildReportCardHtml, buildPayslipHtml, openPrintPreview } from '../../lib/printableDocuments';
import { Phone, Search, GraduationCap, Receipt, CreditCard, ChevronRight, User, LogOut, CheckCircle2, AlertCircle, Info, Printer } from 'lucide-react';

export default function ParentPortal() {
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
  const [school, setSchool] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'grades' | 'installments' | 'payments' | 'card'>('grades');

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

      const p = parentData[0];
      setParent(p);

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
        setSchool(schoolData);

        // Load details for the first student
        await loadStudentDetails(firstStudent.id, firstStudent.school_id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
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
      setSubjects(subRes.data || []);
      setInstallments(instRes.data || []);
      setPayments(payRes.data || []);
      setClasses(clsRes.data || []);
    } catch (err) {
      console.error("Failed to load details", err);
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
    <div className="min-height-screen bg-slate-50 flex flex-col">
      {/* Decorative Brand Header */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-pink-500 p-2 text-white font-black text-xs">EECAD</div>
          <div>
            <h1 className="font-extrabold text-lg leading-none tracking-tight">LA HARPE DE DAVID</h1>
            <p className="text-slate-400 text-xs font-semibold mt-1">Portail d'Accès Parents d'Élèves</p>
          </div>
        </div>
        {parent && (
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-300 hover:text-white transition text-sm font-semibold">
            <LogOut size={16} /> Déconnexion
          </button>
        )}
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
                    onClick={() => setActiveSubTab('installments')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                      activeSubTab === 'installments' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard size={14} /> Échéancier de Scolarité
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
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="font-extrabold text-slate-800">Résultats du 1er Trimestre</h4>
                            <p className="text-slate-500 text-xs mt-0.5">Calculé sur la base des devoirs et compositions.</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 uppercase font-bold">Moyenne Générale</span>
                            <p className="text-xl font-black text-slate-950">{reportCardData.overallAverage.toFixed(2)} / 20</p>
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
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                                    <CheckCircle2 size={12} /> Réglé
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                                    <AlertCircle size={12} /> À régler
                                  </span>
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
