import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getInitials } from '../../lib/utils';
import { APP_MODULES, type ModuleKey } from '../../lib/moduleAccess';
import {
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  School,
  Settings,
  ShieldCheck,
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

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, allowedModules, isDemoAccount } = useAuth();
  const { school, academicYear, academicYears, setAcademicYear, sidebarOpen, setSidebarOpen } = useApp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const profileRole = Array.isArray(profile?.role) ? profile?.role[0] : profile?.role;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) setYearMenuOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = useMemo(
    () => APP_MODULES.filter(module => allowedModules.includes(module.key)),
    [allowedModules],
  );

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3">
            {school?.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-11 w-11 rounded-lg border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <GraduationCap size={23} />
              </div>
            )}
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-slate-950">{school?.name || 'Ecole primaire'}</p>
                {isDemoAccount && (
                  <span className="hidden rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-700 sm:inline-flex">
                    Demo
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500">Maternelle et primaire, PS au CM2</p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div ref={yearMenuRef} className="relative hidden sm:block">
            <button
              onClick={() => setYearMenuOpen(!yearMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>{academicYear?.name || 'Annee scolaire'}</span>
              <ChevronDown size={14} />
            </button>
            {yearMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {academicYears.map(year => (
                  <button
                    key={year.id}
                    onClick={() => {
                      setAcademicYear(year);
                      setYearMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${
                      academicYear?.id === year.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{year.name}</span>
                    {year.active && <span className="text-xs font-medium text-emerald-600">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>

          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                {getInitials(profile?.first_name || '', profile?.last_name || '')}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold text-slate-800">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-slate-500">{profileRole?.display_name}</p>
              </div>
              <ChevronDown size={14} className="hidden text-slate-400 md:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[230px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                  <User size={16} /> Mon profil
                </button>
                {allowedModules.includes('users') && (
                  <button
                    onClick={() => {
                      navigate('/users');
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
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
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings size={16} /> Parametres
                  </button>
                )}
                <div className="my-2 h-px bg-slate-100" />
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50">
                  <LogOut size={16} /> Deconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/65">
        <nav className="hidden items-center gap-1 overflow-x-auto px-4 py-2 lg:flex lg:px-6">
          {items.map(item => {
            const Icon = moduleIcons[item.key];
            const active = isActive(item.path);

            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white hover:text-slate-950'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="space-y-1 px-4 py-3 lg:hidden">
            {items.map(item => {
              const Icon = moduleIcons[item.key];
              const active = isActive(item.path);

              return (
                <button
                  key={item.key}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
