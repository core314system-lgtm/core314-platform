/**
 * Auth Context Provider
 *
 * Centralizes authentication state so every component that calls useAuth()
 * shares a SINGLE profile / loading / user state. This eliminates the race
 * condition where independent useAuth() instances each start their own
 * profile fetch and can disagree on the current role.
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { User as SupabaseUser, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';
import { User } from '../types';
import { logActivity } from '../lib/activity';

interface AuthContextValue {
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  initError: string | null;
  signIn: (email: string, password: string) => Promise<{ data: { user: SupabaseUser | null; session: unknown }; error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: { user: SupabaseUser | null; session: unknown }; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  // Guard against double-fetch from getSession + onAuthStateChange INITIAL_SESSION
  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // Skip if we're already fetching for this user
    if (fetchingRef.current === userId) return;
    fetchingRef.current = userId;

    try {
      const supabase = supabaseRef.current || await initSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      fetchingRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const supabase = await initSupabaseClient();
        supabaseRef.current = supabase;

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }

        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) {
            fetchProfile(session.user.id);
          } else {
            setProfile(null);
            setLoading(false);
          }
        });
        subscription = sub;
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setInitError('Authentication service unavailable. Please refresh the page.');
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = supabaseRef.current || await initSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service unavailable. Please try again later.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      try {
        const url = await getSupabaseFunctionUrl('auth-log-session');
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'login' }),
        });
      } catch (e) {
        console.error('Failed to log session:', e);
      }
      logActivity('login', { method: 'password' });
    }

    return { data, error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const supabase = supabaseRef.current || await initSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service unavailable. Please try again later.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    logActivity('logout');
    const supabase = supabaseRef.current || await initSupabaseClient();
    if (!supabase) {
      throw new Error('Authentication service unavailable. Please try again later.');
    }
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
    }
    return { error };
  }, []);

  const isAdmin = useCallback(() => profile?.role === 'admin', [profile]);
  const isManager = useCallback(() => profile?.role === 'manager' || profile?.role === 'admin', [profile]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      initError,
      signIn,
      signUp,
      signOut,
      isAdmin,
      isManager,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from AuthContext.
 * Must be used within an AuthProvider.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
