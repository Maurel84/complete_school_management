import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, GraduationCap, KeyRound, Loader2, Lock, Mail, ShieldCheck, Users, ImageIcon } from 'lucide-react';

const quickAccounts = [
  {
    label: 'Admin',
    description: 'Compte réel pour créer les utilisateurs et piloter les accès.',
    email: 'tarieljeremie@gmail.com',
    icon: ShieldCheck,
  },
  {
    label: 'Demo',
    description: 'Compte de présentation avec données mock et parcours complet.',
    email: 'demo@schoolmanager.pro',
    password: 'Demo123!',
    icon: BookOpen,
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);

  useEffect(() => {
    async function loadSchools() {
      const { data } = await supabase.from('schools').select('*').eq('active', true).order('name');
      if (data && data.length > 0) {
        setSchools(data);
        const lastId = localStorage.getItem('last_school_id');
        const matched = data.find((s: any) => s.id === lastId);
        setSelectedSchool(matched || data[0]);
      }
    }
    void loadSchools();
  }, []);

  function handleSchoolChange(schoolId: string) {
    const matched = schools.find((s: any) => s.id === schoolId);
    if (matched) {
      setSelectedSchool(matched);
      localStorage.setItem('last_school_id', matched.id);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate('/');
  }

  function fillAccount(account: typeof quickAccounts[number]) {
    setEmail(account.email);
    setPassword(account.password ?? '');
    setError('');
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.92fr_1.08fr]">
      {/* Visual left panel */}
      <section 
        className="hidden border-r border-slate-200 bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between relative overflow-hidden transition-all duration-700"
        style={{
          backgroundImage: selectedSchool?.facade_url ? `linear-gradient(to bottom, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95)), url(${selectedSchool.facade_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!selectedSchool?.facade_url && (
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900 to-emerald-950 opacity-90 -z-10" />
        )}

        <div>
          <div className="flex items-center gap-3">
            {selectedSchool?.logo_url ? (
              <img 
                src={selectedSchool.logo_url} 
                alt="Logo" 
                className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-md bg-white" 
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                <GraduationCap size={24} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {selectedSchool?.name || 'SchoolManager Pro'}
              </h1>
              <p className="text-xs text-slate-400 font-medium">Maternelle et primaire</p>
            </div>
          </div>

          <div className="mt-16 max-w-lg">
            <p className="text-xs uppercase tracking-wider font-extrabold text-emerald-400">Établissement Partenaire</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-white drop-shadow-sm">
              {selectedSchool?.motto ? `« ${selectedSchool.motto} »` : 'Une console calme pour gérer l\'école, les familles et les finances.'}
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              L'interface centralisée se concentre sur les actions quotidiennes : dossiers des élèves, suivi financier,
              bulletins scolaires et gestion de l'inventaire.
            </p>
          </div>
        </div>

        {/* Children in uniform card */}
        {selectedSchool?.students_uniform_url ? (
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-slate-950/40 p-2 backdrop-blur-md shadow-2xl max-w-sm mt-6">
            <img 
              src={selectedSchool.students_uniform_url} 
              alt="Élèves en tenue" 
              className="w-full h-40 object-cover rounded-2xl bg-slate-900" 
            />
            <p className="text-center text-xs font-bold text-slate-200 mt-2 py-1 tracking-wide">
              Nos élèves en tenue officielle
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {[
              { icon: Users, text: 'Familles, élèves et scolarité reliés' },
              { icon: KeyRound, text: 'Comptes utilisateurs avec accès contrôlés' },
              { icon: Lock, text: 'Séparation claire entre démo et administration' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <item.icon size={18} className="text-emerald-300" />
                <span className="text-sm text-slate-200">{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Right side form */}
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Mobile branding header */}
          <div className="mb-8 lg:hidden flex items-center gap-3">
            {selectedSchool?.logo_url ? (
              <img 
                src={selectedSchool.logo_url} 
                alt="Logo" 
                className="h-11 w-11 rounded-xl object-cover border border-slate-200 shadow-sm" 
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <GraduationCap size={23} />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-950">{selectedSchool?.name || 'SchoolManager Pro'}</h1>
              <p className="text-xs text-slate-500 font-medium">Maternelle & primaire</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-950">Connexion</h2>
            <p className="mt-1 text-sm text-slate-500">Choisissez votre établissement et connectez-vous.</p>
          </div>

          {/* School Selector Dropdown */}
          {schools.length > 1 && (
            <div className="mb-5">
              <label className="mb-1 block text-xs font-bold text-slate-500 uppercase tracking-wider">Sélectionner l'établissement</label>
              <select
                value={selectedSchool?.id || ''}
                onChange={e => handleSchoolChange(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-slate-900"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    🏫 {s.name} ({s.city || s.country || 'Côte d\'Ivoire'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {quickAccounts.map(account => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillAccount(account)}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <account.icon size={20} className="text-emerald-700" />
                <p className="mt-3 text-sm font-semibold text-slate-950">{account.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{account.description}</p>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 py-2.5 !pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 py-2.5 !pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
