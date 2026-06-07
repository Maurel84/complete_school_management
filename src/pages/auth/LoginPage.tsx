import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, GraduationCap, KeyRound, Loader2, Lock, Mail, ShieldCheck, Users } from 'lucide-react';

const quickAccounts = [
  {
    label: 'Admin',
    description: 'Compte propre pour creer les utilisateurs et piloter les acces.',
    email: 'admin@schoolmanager.pro',
    password: 'Admin123!',
    icon: ShieldCheck,
  },
  {
    label: 'Demo',
    description: 'Compte de presentation avec donnees mock et parcours complet.',
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
    setPassword(account.password);
    setError('');
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="hidden border-r border-slate-200 bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <GraduationCap size={25} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">SchoolManager Pro</h1>
              <p className="text-sm text-slate-400">Maternelle et primaire</p>
            </div>
          </div>

          <div className="mt-16 max-w-lg">
            <p className="text-sm font-semibold uppercase text-emerald-300">Plateforme operationnelle</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">
              Une console calme pour gerer l'ecole, les familles et les finances.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              L'interface se concentre sur les actions frequentes: dossiers eleves, paiements,
              cartes scolaires, comptes utilisateurs et acces par module.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {[
            { icon: Users, text: 'Familles, eleves et titulaires relies' },
            { icon: KeyRound, text: 'Comptes utilisateurs avec acces controles' },
            { icon: Lock, text: 'Separation claire entre demo et administration' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <item.icon size={18} className="text-emerald-300" />
              <span className="text-sm text-slate-200">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <GraduationCap size={23} />
            </div>
            <h1 className="text-xl font-semibold text-slate-950">SchoolManager Pro</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-950">Connexion</h2>
            <p className="mt-1 text-sm text-slate-500">Choisis un profil ou connecte-toi avec tes identifiants.</p>
          </div>

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
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
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
                  className="w-full rounded-md border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
