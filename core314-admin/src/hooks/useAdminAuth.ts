import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AdminSession {
  adminUser: User | null;
  isAuthenticated: boolean;
}

export function useAdminAuth() {
  const [session, setSession] = useState<AdminSession>({
    adminUser: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      // First, check if we have a stored admin profile
      const storedAdmin = localStorage.getItem('admin_session');
      
      if (!storedAdmin) {
        // No stored admin session - not authenticated
        if (!cancelled) {
          setSession({ adminUser: null, isAuthenticated: false });
          setLoading(false);
        }
        return;
      }

      // We have a stored admin profile - now verify Supabase session exists
      try {
        const adminUser = JSON.parse(storedAdmin);
        
        // Check if Supabase session is still valid
        const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();
        
        if (error || !supabaseSession) {
          // Supabase session is missing or expired - clear admin session and force re-login
          console.warn('Supabase session missing or expired - clearing admin session');
          localStorage.removeItem('admin_session');
          if (!cancelled) {
            setSession({ adminUser: null, isAuthenticated: false });
            setLoading(false);
          }
          return;
        }

        // Both admin profile and Supabase session exist - user is authenticated
        if (!cancelled) {
          setSession({ adminUser, isAuthenticated: true });
          setLoading(false);
        }
      } catch {
        // Invalid stored admin data
        localStorage.removeItem('admin_session');
        if (!cancelled) {
          setSession({ adminUser: null, isAuthenticated: false });
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for Supabase auth state changes (e.g., session expiry, sign out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (cancelled) return;
      
      if (event === 'SIGNED_OUT' || !supabaseSession) {
        // Supabase session ended - clear admin session
        localStorage.removeItem('admin_session');
        setSession({ adminUser: null, isAuthenticated: false });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { error: { message: 'Invalid credentials' } };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Profile not found.' } };
      }

      if (!profile.is_platform_admin) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Platform administrator access required.' } };
      }

      localStorage.setItem('admin_session', JSON.stringify(profile));
      setSession({ adminUser: profile, isAuthenticated: true });
      
      return { data: profile, error: null };
    } catch {
      return { error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    // Clear admin session first
    localStorage.removeItem('admin_session');
    setSession({ adminUser: null, isAuthenticated: false });
    
    // Also sign out from Supabase to keep auth states in sync
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    adminUser: session.adminUser,
    isAuthenticated: session.isAuthenticated,
    loading,
    signIn,
    signOut,
  };
}
