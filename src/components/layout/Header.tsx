import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { Menu, Search, Bell, ChevronDown, User, LogOut, Settings } from 'lucide-react';

export default function Header() {
  const { profile, signOut } = useAuth();
  const { school, academicYear, academicYears, setAcademicYear, sidebarOpen, setSidebarOpen } = useApp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (yearMenuRef.current && !yearMenuRef.current.contains(e.target as Node)) setYearMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 flex-1 max-w-md">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="bg-transparent border-none outline-none text-sm text-gray-700 w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div ref={yearMenuRef} className="relative">
          <button
            onClick={() => setYearMenuOpen(!yearMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 rounded-lg hover:bg-gray-100"
          >
            <span className="hidden sm:inline">{academicYear?.name || 'Année scolaire'}</span>
            <ChevronDown size={14} />
          </button>
          {yearMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50">
              {academicYears.map(year => (
                <button
                  key={year.id}
                  onClick={() => { setAcademicYear(year); setYearMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${academicYear?.id === year.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                >
                  {year.name} {year.active && <span className="text-xs text-emerald-600 ml-1">(Active)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1.5"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-700">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role?.display_name}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-50">
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <User size={16} /> Mon profil
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Settings size={16} /> Paramètres
              </button>
              <hr className="my-1" />
              <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={16} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
