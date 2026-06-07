import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import type { User, Session } from '@supabase/supabase-js';
import { canAccessModule as checkModuleAccess, getAllowedModuleKeys, type ModuleKey } from '../lib/moduleAccess';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, profileData: Partial<Profile>) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  allowedModules: ModuleKey[];
  canAccessModule: (moduleKey: ModuleKey) => boolean;
  isDemoAccount: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isDirector: boolean;
  isTeacher: boolean;
  isParent: boolean;
  isStudent: boolean;
  isCashier: boolean;
  isAccountant: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightProfileUserId = useRef<string | null>(null);

  const role = profile?.role?.name as UserRole | null;

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isDirector = role === 'director';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';
  const isStudent = role === 'student';
  const isCashier = role === 'cashier';
  const isAccountant = role === 'accountant';
  const isSupervisor = role === 'supervisor';
  const allowedModules = getAllowedModuleKeys(profile, role);
  const isDemoAccount = profile?.account_type === 'demo';
  const canAccessModule = (moduleKey: ModuleKey) => checkModuleAccess(profile, role, moduleKey);

  useEffect(() => {
    if (supabaseConfigError) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user.id);
      } else {
        inFlightProfileUserId.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    if (inFlightProfileUserId.current === userId) return;

    inFlightProfileUserId.current = userId;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, role:roles(*)')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile from Supabase', error);
        setProfile(null);
        return;
      }

      setProfile(data as Profile | null);
    } finally {
      if (inFlightProfileUserId.current === userId) {
        inFlightProfileUserId.current = null;
      }
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    if (supabaseConfigError) {
      return { error: supabaseConfigError };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, profileData: Partial<Profile>) {
    if (supabaseConfigError) {
      return { error: supabaseConfigError };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        ...profileData,
      });
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, loading,
      signIn, signUp, signOut,
      allowedModules, canAccessModule, isDemoAccount,
      isSuperAdmin, isAdmin, isDirector, isTeacher, isParent, isStudent, isCashier, isAccountant, isSupervisor,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
