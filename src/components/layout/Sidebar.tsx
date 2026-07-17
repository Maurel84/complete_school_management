import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getInitials } from '../../lib/utils';
import {
  LayoutDashboard,
  GraduationCap,
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
  LogOut,
  X,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher'] },
  { label: 'Élèves', path: '/students', icon: GraduationCap, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
  { label: 'Parents', path: '/parents', icon: Users, roles: ['super_admin', 'admin', 'director', 'supervisor'] },
  { label: 'Classes', path: '/classes', icon: School, roles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor'] },
  { label: 'Finances', path: '/finance', icon: DollarSign, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier'] },
  { label: 'Caisse', path: '/cash', icon: Wallet, roles: ['super_admin', 'admin', 'director', 'cashier', 'accountant'] },
  { label: 'Comptabilité', path: '/accounting', icon: Calculator, roles: ['super_admin', 'admin', 'director', 'accountant'] },
  { label: 'Enseignants & titulaires', path: '/teachers', icon: BookOpen, roles: ['super_admin', 'admin', 'director'] },
  { label: 'Personnel & paie', path: '/hr', icon: Briefcase, roles: ['super_admin', 'admin', 'director', 'accountant'] },
  { label: 'Notes & bulletins', path: '/grades', icon: ClipboardList, roles: ['super_admin', 'admin', 'director', 'teacher'] },
  { label: 'Absences & discipline', path: '/attendance', icon: CalendarCheck, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
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

function getSchoolCycleLabel(establishmentType?: string) {
  switch (establishmentType) {
    case 'maternelle':
      return 'Maternelle';
    case 'primaire':
      return 'Primaire';
    case 'maternelle_primaire':
      return 'Maternelle & primaire';
    default:
      return 'Établissement scolaire';
  }
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const profileRole = Array.isArray(profile?.role) ? profile?.role[0] : profile?.role;
  const { school, sidebarOpen, setSidebarOpen } = useApp();

  const items = role === 'parent'
    ? parentItems
    : role === 'student'
      ? studentItems
      : navItems.filter(item => !item.roles || item.roles.includes(role || ''));

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#11273b_0%,#183f4f_55%,#0f2233_100%)] text-white shadow-[0_32px_80px_-28px_rgba(2,12,27,0.7)] transition-all duration-300 ${
          sidebarOpen ? 'w-72' : 'w-0 lg:w-24'
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'lg:justify-center'}`}>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 shadow-inner shadow-white/5">
              <GraduationCap size={25} />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="display-font truncate text-base font-semibold tracking-tight">SchoolManager</h1>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    Pro
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">Pilotage intelligent de l'école</p>
              </div>
            )}
          </div>
        </div>

        {sidebarOpen && school && (
          <div className="border-b border-white/10 px-5 py-4">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Sparkles size={14} /> {getSchoolCycleLabel(school.establishment_type)}
              </div>
              <p className="mt-3 line-clamp-1 text-sm font-semibold text-white">{school.name}</p>
              <p className="mt-1 text-xs text-slate-300">{school.city || 'Ville non renseignée'}</p>
            </div>
          </div>
        )}

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
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
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-[0_18px_45px_-26px_rgba(255,255,255,0.7)]'
                      : 'text-slate-200 hover:bg-white/8 hover:text-white'
                  } ${!sidebarOpen && 'lg:justify-center lg:px-0'}`}
                >
                  <Icon size={20} className={`flex-shrink-0 ${active ? 'text-emerald-600' : 'text-slate-300 group-hover:text-emerald-200'}`} />
                  {sidebarOpen && <span className="truncate font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          {sidebarOpen && profile && (
            <div className="mb-4 rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/20 text-sm font-bold text-emerald-100">
                  {getInitials(profile.first_name, profile.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{profile.first_name} {profile.last_name}</p>
                  <p className="truncate text-xs text-slate-300">{profileRole?.display_name}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-200 transition hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
          <button onClick={() => setSidebarOpen(false)} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/8 hover:text-white lg:hidden">
            <X size={20} />
            {sidebarOpen && <span>Réduire</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
