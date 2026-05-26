import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getInitials } from '../../lib/utils';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  School,
  DollarSign,
  Wallet,
  Calculator,
  BookOpen,
  Briefcase,
  ClipboardList,
  CalendarCheck,
  Clock,
  Mail,
  FileText,
  Settings,
  ChevronDown,
  Bell,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react';

const navItems = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher'] },
  { label: 'Élèves', path: '/students', icon: GraduationCap, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
  { label: 'Parents', path: '/parents', icon: Users, roles: ['super_admin', 'admin', 'director', 'supervisor'] },
  { label: 'Classes', path: '/classes', icon: School, roles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor'] },
  { label: 'Finances', path: '/finance', icon: DollarSign, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier'] },
  { label: 'Caisse', path: '/cash', icon: Wallet, roles: ['super_admin', 'admin', 'director', 'cashier', 'accountant'] },
  { label: 'Comptabilité', path: '/accounting', icon: Calculator, roles: ['super_admin', 'admin', 'director', 'accountant'] },
  { label: 'Enseignants', path: '/teachers', icon: BookOpen, roles: ['super_admin', 'admin', 'director'] },
  { label: 'Personnel', path: '/hr', icon: Briefcase, roles: ['super_admin', 'admin', 'director'] },
  { label: 'Évaluations', path: '/grades', icon: ClipboardList, roles: ['super_admin', 'admin', 'director', 'teacher'] },
  { label: 'Présences', path: '/attendance', icon: CalendarCheck, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
  { label: 'Emploi du temps', path: '/schedule', icon: Clock, roles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor'] },
  { label: 'Messages', path: '/messages', icon: Mail, roles: ['super_admin', 'admin', 'director', 'teacher', 'parent', 'supervisor'] },
  { label: 'Documents', path: '/documents', icon: FileText, roles: ['super_admin', 'admin', 'director', 'teacher'] },
  { label: 'Paramètres', path: '/settings', icon: Settings, roles: ['super_admin', 'admin'] },
];

const parentItems = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Mes enfants', path: '/students', icon: GraduationCap },
  { label: 'Paiements', path: '/finance', icon: DollarSign },
  { label: 'Notes', path: '/grades', icon: ClipboardList },
  { label: 'Absences', path: '/attendance', icon: CalendarCheck },
  { label: 'Messages', path: '/messages', icon: Mail },
];

const studentItems = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Mes notes', path: '/grades', icon: ClipboardList },
  { label: 'Emploi du temps', path: '/schedule', icon: Clock },
  { label: 'Absences', path: '/attendance', icon: CalendarCheck },
  { label: 'Messages', path: '/messages', icon: Mail },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { school, academicYear, academicYears, setAcademicYear, sidebarOpen, setSidebarOpen } = useApp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) setYearMenuOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = role === 'parent'
    ? parentItems
    : role === 'student'
      ? studentItems
      : navItems.filter(item => item.roles.includes(role || ''));

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 lg:hidden"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3">
            {school?.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-12 w-12 rounded-2xl border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <GraduationCap size={24} />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="display-font truncate text-lg font-semibold text-slate-900">{school?.name || 'École primaire'}</p>
              <p className="truncate text-xs text-slate-500">Petite Section à CM2</p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <div ref={yearMenuRef} className="relative hidden sm:block">
            <button
              onClick={() => setYearMenuOpen(!yearMenuOpen)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>{academicYear?.name || 'Année scolaire'}</span>
              <ChevronDown size={14} />
            </button>
            {yearMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur">
                {academicYears.map(year => (
                  <button
                    key={year.id}
                    onClick={() => {
                      setAcademicYear(year);
                      setYearMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
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

          <button className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50">
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>

          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 transition hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                {getInitials(profile?.first_name || '', profile?.last_name || '')}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold text-slate-800">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-slate-500">{profile?.role?.display_name}</p>
              </div>
              <ChevronDown size={14} className="hidden text-slate-400 md:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[210px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur">
                <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                  <User size={16} /> Mon profil
                </button>
                <button
                  onClick={() => {
                    navigate('/settings');
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings size={16} /> Paramètres
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50">
                  <LogOut size={16} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
          <nav className="hidden items-center gap-1 overflow-x-auto py-3 lg:flex">
            {items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {sidebarOpen && (
            <div className="space-y-2 py-4 lg:hidden">
              {items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
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
      </div>
    </header>
  );
}
