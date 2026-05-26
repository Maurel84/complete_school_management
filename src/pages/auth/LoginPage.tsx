import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, Mail, Lock, Loader2, BookOpen, Shield, Users } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate('/');
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900 text-white flex-col justify-center px-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SchoolManager Pro</h1>
            <p className="text-blue-300 text-sm">Gestion scolaire intelligente</p>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-6 leading-tight">Gérez votre établissement avec efficacité et simplicité</h2>
        <div className="space-y-4">
          {[
            { icon: Users, text: 'Gestion complète des élèves, parents et personnel' },
            { icon: BookOpen, text: 'Notes, bulletins et suivi académique automatisé' },
            { icon: Shield, text: 'Sécurité des données et contrôle d\'accès par rôle' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/30 rounded-lg"><f.icon size={20} /></div>
              <span className="text-blue-100">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <GraduationCap size={22} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">SchoolManager Pro</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion</h2>
          <p className="text-gray-500 mb-8">Accédez à votre espace de gestion scolaire</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="votre@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Pas de compte ? <Link to="/register" className="text-blue-600 hover:underline font-medium">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
