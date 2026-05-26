import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { School, AcademicYear } from '../types';

interface AppContextType {
  school: School | null;
  academicYear: AcademicYear | null;
  academicYears: AcademicYear[];
  setAcademicYear: (year: AcademicYear) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchool(profile.school_id);
      fetchAcademicYears(profile.school_id);
    }
  }, [profile?.school_id]);

  async function fetchSchool(schoolId: string) {
    const { data } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle();
    setSchool(data as School);
  }

  async function fetchAcademicYears(schoolId: string) {
    const { data } = await supabase.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false });
    setAcademicYears((data as AcademicYear[]) || []);
    const active = data?.find((y: AcademicYear) => y.active);
    if (active) setAcademicYear(active);
    else if (data && data.length > 0) setAcademicYear(data[0] as AcademicYear);
  }

  return (
    <AppContext.Provider value={{ school, academicYear, academicYears, setAcademicYear, sidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
