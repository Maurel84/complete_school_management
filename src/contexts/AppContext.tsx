import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { School, AcademicYear } from '../types';
import { getSchoolTheme, applySchoolTheme, saveSchoolTheme, SchoolTheme, DEFAULT_THEME } from '../lib/schoolTheme';
import { initializeSchoolFullStructure, InitializationResult } from '../lib/schoolDataInitializer';

interface AppContextType {
  school: School | null;
  academicYear: AcademicYear | null;
  academicYears: AcademicYear[];
  setAcademicYear: (year: AcademicYear) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  refreshSchool: () => Promise<void>;
  refreshAcademicYears: () => Promise<void>;
  theme: SchoolTheme;
  updateTheme: (newTheme: SchoolTheme) => Promise<void>;
  bootstrapSchoolData: (withSampleData?: boolean) => Promise<InitializationResult | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setThemeState] = useState<SchoolTheme>(() => getSchoolTheme());

  useEffect(() => {
    if (school?.id) {
      const activeTheme = getSchoolTheme(school.id);
      setThemeState(activeTheme);
      applySchoolTheme(activeTheme);
    } else {
      applySchoolTheme(theme);
    }
  }, [school?.id]);

  async function updateTheme(newTheme: SchoolTheme) {
    setThemeState(newTheme);
    applySchoolTheme(newTheme);
    if (school?.id) {
      await saveSchoolTheme(school.id, newTheme);
    }
  }

  useEffect(() => {
    void initializeAppSchool();
  }, [profile?.school_id, profile?.id]);

  async function initializeAppSchool() {
    try {
      const host = window.location.hostname.toLowerCase();
      const isCoconDomain = host.includes('cocon');
      const isDavidDomain = host.includes('hdd') || host.includes('eecae');

      // 1. If accessing via Cocon domain
      if (isCoconDomain) {
        let { data: coconSchool } = await supabase
          .from('schools')
          .select('*')
          .or('slug.ilike.%cocon%,name.ilike.%cocon%')
          .limit(1)
          .maybeSingle();

        if (!coconSchool) {
          // Provision Cocon school if missing
          const { data: createdSchool } = await supabase
            .from('schools')
            .insert({
              name: 'GROUPE SCOLAIRE COCON',
              slug: 'cocon',
              phone: '0700276689',
              email: 'contact@cocon.maurelagohi.xyz',
              address: 'Abidjan, Côte d’Ivoire',
              motto: 'L’Excellence et la Réussite',
            })
            .select()
            .maybeSingle();

          coconSchool = createdSchool;
        }

        if (coconSchool) {
          setSchool(coconSchool as School);
          await fetchAcademicYears(coconSchool.id);

          // If current profile is logged in and not bound to coconSchool, update it
          if (profile?.id && profile.school_id !== coconSchool.id) {
            try {
              await supabase.from('profiles').update({ school_id: coconSchool.id }).eq('id', profile.id);
            } catch (err) {
              console.warn('Failed to update profile school_id for cocon', err);
            }
          }

          // Check if Cocon has 0 classes, auto-bootstrap structure & sample data
          const { count: classCount } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', coconSchool.id);

          if ((classCount || 0) === 0) {
            try {
              await initializeSchoolFullStructure(coconSchool.id, { withSampleData: true });
              await fetchAcademicYears(coconSchool.id);
            } catch (err) {
              console.warn('Auto-init Cocon error', err);
            }
          }
          return;
        }
      }

      // 2. If accessing via David / EECAD domain
      if (isDavidDomain) {
        const { data: hddSchool } = await supabase
          .from('schools')
          .select('*')
          .or('slug.ilike.%hdd%,slug.ilike.%harpe%,name.ilike.%harpe%')
          .limit(1)
          .maybeSingle();

        if (hddSchool) {
          setSchool(hddSchool as School);
          await fetchAcademicYears(hddSchool.id);
          if (profile?.id && profile.school_id !== hddSchool.id) {
            try {
              await supabase.from('profiles').update({ school_id: hddSchool.id }).eq('id', profile.id);
            } catch (err) {
              console.warn('Failed to update profile school_id for hdd', err);
            }
          }
          return;
        }
      }

      // 3. User profile school_id if available
      if (profile?.school_id) {
        await fetchSchool(profile.school_id);
        await fetchAcademicYears(profile.school_id);
        return;
      }

      // 4. Default fallback
      await fetchDefaultSchool();
    } catch (e) {
      console.warn('Error in initializeAppSchool', e);
      await fetchDefaultSchool();
    }
  }

  async function fetchDefaultSchool() {
    try {
      const { data } = await supabase.from('schools').select('*').limit(1).maybeSingle();
      if (data) {
        setSchool(data as School);
        void fetchAcademicYears(data.id);
        if (profile?.id && !profile.school_id) {
          try {
            await supabase.from('profiles').update({ school_id: data.id }).eq('id', profile.id);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Error loading fallback school', e);
    }
  }

  async function fetchSchool(schoolId: string) {
    const { data } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle();
    if (data) {
      setSchool(data as School);
    } else {
      await fetchDefaultSchool();
    }
  }

  async function fetchAcademicYears(schoolId: string) {
    const { data } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    const years = (data as AcademicYear[]) || [];

    if (years.length > 0) {
      setAcademicYears(years);
      const active = years.find((y: AcademicYear) => y.active);
      if (active) setAcademicYear(active);
      else setAcademicYear(years[0]);
    } else {
      // Auto-create active academic year 2026-2027 if none exists
      try {
        const { data: newYear } = await supabase
          .from('academic_years')
          .insert({
            school_id: schoolId,
            name: '2026-2027',
            start_date: '2026-09-15',
            end_date: '2027-06-30',
            active: true,
          })
          .select()
          .maybeSingle();

        if (newYear) {
          setAcademicYears([newYear as AcademicYear]);
          setAcademicYear(newYear as AcademicYear);
        }
      } catch (e) {
        console.warn('Could not auto-create academic year', e);
      }
    }
  }

  async function refreshSchool() {
    await initializeAppSchool();
  }

  async function refreshAcademicYears() {
    const targetSid = school?.id || profile?.school_id;
    if (targetSid) {
      await fetchAcademicYears(targetSid);
    }
  }

  async function bootstrapSchoolData(withSampleData = true): Promise<InitializationResult | null> {
    const targetSid = school?.id || profile?.school_id;
    if (!targetSid) return null;
    const res = await initializeSchoolFullStructure(targetSid, { withSampleData });
    await refreshSchool();
    return res;
  }

  return (
    <AppContext.Provider
      value={{
        school,
        academicYear,
        academicYears,
        setAcademicYear,
        sidebarOpen,
        setSidebarOpen,
        refreshSchool,
        refreshAcademicYears,
        theme,
        updateTheme,
        bootstrapSchoolData,
      }}
    >
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
