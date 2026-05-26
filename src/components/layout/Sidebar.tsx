import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  LayoutDashboard, GraduationCap, Users, School, DollarSign,
  Wallet, Calculator, BookOpen, Briefcase, ClipboardList,
  CalendarCheck, Clock, Mail, FileText, Settings, LogOut, X
} from 'lucide-react';

const navItems = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor'] },
  { label: 'Élèves', path: '/students', icon: GraduationCap, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
  { label: 'Parents', path: '/parents', icon: Users, roles: ['super_admin', 'admin', 'director', 'supervisor'] },
  { label: 'Classes', path: '/classes', icon: School, roles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor'] },
  { label: 'Finances', path: '/finance', icon: DollarSign, roles: ['super_admin', 'admin', 'director', 'accountant', 'cashier'] },
  { label: 'Caisse', path: '/cash', icon: Wallet, roles: ['super_admin', 'admin', 'director', 'cashier', 'accountant'] },
  { label: 'Comptabilité', path: '/accounting', icon: Calculator, roles: ['super_admin', 'admin', 'director', 'accountant'] },
  { label: 'Enseignants', path: '/teachers', icon: BookOpen, roles: ['super_admin', 'admin', 'director'] },
  { label: 'Ressources Humaines', path: '/hr', icon: Briefcase, roles: ['super_admin', 'admin', 'director'] },
  { label: 'Notes & Bulletins', path: '/grades', icon: ClipboardList, roles: ['super_admin', 'admin', 'director', 'teacher'] },
  { label: 'Absences & Discipline', path: '/attendance', icon: CalendarCheck, roles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher'] },
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

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
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
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 h-full bg-slate-800 text-white z-50 transition-all duration-300 flex flex-col
        ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'} overflow-hidden`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'lg:justify-center'}`}>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap size={24} />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold leading-tight">SchoolManager</h1>
                <p className="text-xs text-slate-400">Pro</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {sidebarOpen && school && (
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-400">Établissement</p>
            <p className="text-sm font-medium truncate">{school.name}</p>
          </div>
        )}

        <nav className="flex-1 py-4 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                  ${active ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                  ${!sidebarOpen && 'lg:justify-center lg:px-0'}`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
          {sidebarOpen && profile && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{profile.first_name} {profile.last_name}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.role?.display_name}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
