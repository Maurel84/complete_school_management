import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getInitials } from '../../lib/utils';
import { APP_MODULES, type ModuleKey } from '../../lib/moduleAccess';
import { getDarkMode, toggleDarkMode } from '../../lib/schoolTheme';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import {
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  Phone,
  School,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const moduleIcons: Record<ModuleKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  students: GraduationCap,
  parents: Users,
  classes: School,
  supplies: BookOpen,
  finance: DollarSign,
  cash: Wallet,
  accounting: Calculator,
  teachers: BookOpen,
  hr: Briefcase,
  grades: ClipboardList,
  attendance: CalendarCheck,
  schedule: Clock,
  messages: Mail,
  documents: FileText,
  users: ShieldCheck,
  settings: Settings,
};

interface SchoolNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  category: 'finance' | 'student' | 'attendance' | 'message';
  path: string;
}

const DEFAULT_NOTIFICATIONS: SchoolNotification[] = [
  {
    id: 'notif-1',
    title: 'Paiement de scolarité enregistré',
    message: 'Encaissement validé avec reçu numérique généré automatiquement.',
    time: 'Il y a 10 min',
    read: false,
    category: 'finance',
    path: '/finance',
  },
  {
    id: 'notif-2',
    title: 'Rappel échéance tranches',
    message: 'Des tranches de scolarité arrivent à échéance ce mois-ci.',
    time: 'Il y a 1 h',
    read: false,
    category: 'finance',
    path: '/finance',
  },
  {
    id: 'notif-3',
    title: 'Pointage des présences effectué',
    message: 'Les registres d\'appel du matin ont été enregistrés.',
    time: 'Ce matin',
    read: false,
    category: 'attendance',
    path: '/attendance',
  },
  {
    id: 'notif-4',
    title: 'Nouvelle communication aux parents',
    message: 'La note d\'information pour la rentrée a été diffusée.',
    time: 'Hier',
    read: true,
    category: 'message',
    path: '/messages',
  },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, allowedModules, isDemoAccount, role, isTeacher, isParent } = useAuth();
  const { school, academicYear, academicYears, setAcademicYear, sidebarOpen, setSidebarOpen, theme } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => getDarkMode());
  const [signingOut, setSigningOut] = useState(false);

  // User Profile Edit State
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<SchoolNotification[]>(() => {
    try {
      const stored = localStorage.getItem('school_notifications_list');
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_NOTIFICATIONS;
  });

  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const profileRole = Array.isArray(profile?.role) ? profile?.role[0] : profile?.role;
  const isTeacherUser = isTeacher || role === 'teacher' || profileRole?.name === 'teacher' || (profileRole as any) === 'teacher';
  const isParentUser = isParent || role === 'parent' || profileRole?.name === 'parent' || (profileRole as any) === 'parent';

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) setYearMenuOpen(false);
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) setNotificationsOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (profile?.phone) {
      setProfilePhone(profile.phone);
    }
  }, [profile?.phone]);

  function markAllAsRead() {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      localStorage.setItem('school_notifications_list', JSON.stringify(updated));
    } catch {}
  }

  function handleNotificationClick(item: SchoolNotification) {
    const updated = notifications.map(n => (n.id === item.id ? { ...n, read: true } : n));
    setNotifications(updated);
    try {
      localStorage.setItem('school_notifications_list', JSON.stringify(updated));
    } catch {}
    setNotificationsOpen(false);
    if (item.path) {
      navigate(item.path);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.id) return;
    setSavingProfile(true);
    setProfileSavedNotice(null);

    try {
      await supabase.from('profiles').update({ phone: profilePhone }).eq('id', profile.id);
      setProfileSavedNotice('Numéro de téléphone mis à jour avec succès.');
      setTimeout(() => setProfileSavedNotice(null), 3500);
    } catch (err) {
      console.warn('Erreur mise à jour profil:', err);
    } finally {
      setSavingProfile(false);
    }
  }

  const items = useMemo(
    () => APP_MODULES.filter(module => allowedModules.includes(module.key)),
    [allowedModules],
  );

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  async function handleSignOut() {
    setSigningOut(true);
    setUserMenuOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3">
              {school?.logo_url ? (
                <img src={school.logo_url} alt={school.name} className="h-11 w-11 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-white shadow-xs"
                  style={{ backgroundColor: theme.primary }}
                >
                  <GraduationCap size={23} />
                </div>
              )}
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-semibold text-slate-950 dark:text-white">{school?.name || 'Ecole primaire'}</p>
                  {isDemoAccount && (
                    <span className="hidden rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-700 sm:inline-flex dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400">
                      Demo
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">Maternelle et primaire, PS au CM2</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* SÉLECTEUR ANNÉE SCOLAIRE */}
            <div ref={yearMenuRef} className="relative hidden sm:block">
              <button
                onClick={() => setYearMenuOpen(!yearMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span>{academicYear?.name || 'Année scolaire'}</span>
                <ChevronDown size={14} />
              </button>
              {yearMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {academicYears.map(year => (
                    <button
                      key={year.id}
                      onClick={() => {
                        setAcademicYear(year);
                        setYearMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${
                        academicYear?.id === year.id
                          ? 'bg-emerald-50 text-emerald-700 font-bold dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{year.name}</span>
                      {year.active && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BOUTON BASCULEMENT THÈME CLAIR / SOMBRE */}
            <button
              onClick={() => {
                const next = toggleDarkMode();
                setIsDark(next);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700"
              title={isDark ? 'Passer en Mode Clair (Jour)' : 'Passer en Mode Sombre (Nuit)'}
              aria-label="Basculer thème clair/sombre"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
            </button>

            {/* CENTRE DE NOTIFICATIONS */}
            <div ref={notificationMenuRef} className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Notifications"
                title="Notifications scolaires"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-1 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <Bell size={15} />
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Centre de Notifications</h3>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Aucune notification pour le moment.
                      </div>
                    ) : (
                      notifications.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`cursor-pointer rounded-xl p-2.5 transition flex gap-3 ${
                            item.read
                              ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 opacity-75'
                              : 'bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100/60 dark:bg-emerald-950/20 dark:border-emerald-900/40 opacity-100'
                          }`}
                        >
                          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs dark:bg-slate-800">
                            {item.category === 'finance' && <DollarSign size={15} className="text-emerald-600" />}
                            {item.category === 'student' && <GraduationCap size={15} className="text-blue-600" />}
                            {item.category === 'attendance' && <CalendarCheck size={15} className="text-amber-600" />}
                            {item.category === 'message' && <Mail size={15} className="text-violet-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-800 truncate dark:text-slate-200">{item.title}</p>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.time}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 dark:text-slate-400">{item.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between px-1 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">Alertes en direct</span>
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('/messages');
                      }}
                      className="text-xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white flex items-center gap-1"
                    >
                      Messagerie <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* MENU UTILISATEUR & PROFIL */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-white shadow-xs"
                  style={{ backgroundColor: theme.primary }}
                >
                  {getInitials(profile?.first_name || '', profile?.last_name || '')}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{profileRole?.display_name || 'Personnel'}</p>
                </div>
                <ChevronDown size={14} className="hidden text-slate-400 md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[230px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800 animate-in">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <User size={16} /> Mon profil
                  </button>
                  {allowedModules.includes('users') && (
                    <button
                      onClick={() => {
                        navigate('/users');
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <ShieldCheck size={16} /> Utilisateurs
                    </button>
                  )}
                  {allowedModules.includes('settings') && (
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Settings size={16} /> Paramètres
                    </button>
                  )}
                  <div className="my-2 h-px bg-slate-100 dark:bg-slate-700" />
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut size={16} /> {signingOut ? 'Déconnexion...' : 'Déconnexion'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BARRE DE NAVIGATION SECONDAIRE */}
        <div className="border-t border-slate-100 bg-slate-50/65 dark:border-slate-800 dark:bg-slate-900/60 transition-colors">
          <nav className="hidden items-center gap-1 overflow-x-auto px-4 py-2 lg:flex lg:px-6 scrollbar-thin">
            {items.map(item => {
              const Icon = moduleIcons[item.key];
              const active = isActive(item.path);
              let label = item.label;
              if (item.key === 'students') {
                if (isTeacherUser) label = 'Mes Élèves';
                else if (isParentUser) label = 'Mes Enfants';
              }

              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-xs font-bold transition-all duration-200 ${
                    active
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-950/15 scale-[1.02] dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-xs dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon
                    size={15}
                    className={active ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-500 dark:text-slate-400'}
                  />
                  {label}
                </button>
              );
            })}
          </nav>

          {sidebarOpen && (
            <div className="space-y-1 px-4 py-3 lg:hidden">
              {items.map(item => {
                const Icon = moduleIcons[item.key];
                const active = isActive(item.path);
                let label = item.label;
                if (item.key === 'students') {
                  if (isTeacherUser) label = 'Mes Élèves';
                  else if (isParentUser) label = 'Mes Enfants';
                }

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* MODAL "MON PROFIL" ULTRA-COMPLET ET PROFESSIONNEL */}
      {profileModalOpen && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title="Mon Profil Utilisateur"
          size="lg"
        >
          <div className="space-y-6">
            {/* BANNIÈRE IDENTITÉ */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div
                  className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-inner ring-4 ring-white/10"
                  style={{ backgroundColor: theme.primary }}
                >
                  {getInitials(profile?.first_name || '', profile?.last_name || '')}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-xl font-bold tracking-tight">
                      {profile?.first_name} {profile?.last_name}
                    </h3>
                    <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      {profileRole?.display_name || 'Utilisateur'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300 flex items-center justify-center sm:justify-start gap-2">
                    <Mail size={14} /> {profile?.email || user?.email || 'Email non renseigné'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <School size={14} className="text-emerald-400" /> {school?.name || 'Établissement Scolaire'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sparkles size={14} className="text-amber-400" /> Année : {academicYear?.name || 'En cours'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NOTIFICATION DE SUCCÈS */}
            {profileSavedNotice && (
              <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 animate-in">
                <CheckCircle2 size={16} className="text-emerald-600" />
                {profileSavedNotice}
              </div>
            )}

            {/* COORDONNÉES ET MISE À JOUR */}
            <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 dark:border-slate-800 dark:bg-slate-800/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone size={15} className="text-emerald-600" /> Coordonnées directes
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 dark:text-slate-400">
                    Adresse Email de connexion
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile?.email || user?.email || ''}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-600 cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Géré via l'authentification sécurisée Supabase.</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">
                    Numéro de Téléphone (WhatsApp / SMS)
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Utilisé pour les alertes de l'école et confirmations.</span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile || profilePhone === (profile?.phone || '')}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  style={{ backgroundColor: theme.primary }}
                >
                  {savingProfile ? 'Enregistrement...' : 'Mettre à jour mon numéro'}
                </button>
              </div>
            </form>

            {/* MODULES ET PERMISSIONS ACCORDÉES */}
            <div className="rounded-2xl border border-slate-200 p-5 space-y-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Shield size={15} className="text-indigo-600" /> Vos Habilitations & Accès Modules
                </h4>
                <span className="text-xs font-semibold text-slate-400">
                  {allowedModules.length} module{allowedModules.length > 1 ? 's' : ''} actif{allowedModules.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {items.map(m => {
                  const Icon = moduleIcons[m.key];
                  return (
                    <span
                      key={m.key}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Icon size={13} className="text-emerald-600 dark:text-emerald-400" />
                      {m.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* INFORMATIONS SÉCURITÉ */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Statut : <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">● Compte vérifié & actif</strong></span>
              <span>Identifiant unique : <code className="font-mono text-[11px] text-slate-500">{profile?.id?.slice(0, 13)}...</code></span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
