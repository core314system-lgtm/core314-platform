import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AdminAuthState {
  adminUser: User | null;
  isAuthenticated: boolean;
  supabaseSession: Session | null;
}

/**
 * Admin authentication hook that enforces Supabase Auth as the SINGLE source of truth.
 * 
 * Authentication requirements:
 * 1. A valid Supabase session MUST exist
 * 2. The user's profile MUST have is_platform_admin === true
 * 3. localStorage is used ONLY as a profile cache, NOT as an auth gate
 * 
 * The hook "fails closed" - if Supabase session is missing or invalid,
 * the user is NOT authenticated regardless of any cached data.
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    adminUser: null,
    isAuthenticated: false,
    supabaseSession: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const clearAuthState = () => {
      if (!cancelled) {
        setState({
          adminUser: null,
          isAuthenticated: false,
          supabaseSession: null,
        });
        setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        // STEP 1: Check Supabase session FIRST (single source of truth)
        const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting Supabase session:', sessionError);
          localStorage.removeItem('admin_profile_cache');
          clearAuthState();
          return;
        }

        if (!supabaseSession) {
          // No Supabase session = NOT authenticated (fail closed)
          // Clear any stale localStorage data
          localStorage.removeItem('admin_profile_cache');
          clearAuthState();
          return;
        }

        // STEP 2: We have a Supabase session - now verify admin status
        const userId = supabaseSession.user.id;

        // Always verify profile from database
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError || !profile) {
          console.error('Error fetching admin profile:', profileError);
          // Sign out from Supabase since we can't verify admin status
          await supabase.auth.signOut();
          localStorage.removeItem('admin_profile_cache');
          clearAuthState();
          return;
        }

        // STEP 3: Verify is_platform_admin flag
        if (!profile.is_platform_admin) {
          console.warn('User is not a platform admin');
          // Sign out from Supabase - non-admins should not have access
          await supabase.auth.signOut();
          localStorage.removeItem('admin_profile_cache');
          clearAuthState();
          return;
        }

        // STEP 4: User is authenticated and is a platform admin
        // Update cache for faster subsequent loads (cache is NOT authoritative)
        localStorage.setItem('admin_profile_cache', JSON.stringify(profile));
        
        if (!cancelled) {
          setState({
            adminUser: profile,
            isAuthenticated: true,
            supabaseSession,
          });
          setLoading(false);
        }
      } catch (error) {
        console.error('Unexpected error during auth initialization:', error);
        localStorage.removeItem('admin_profile_cache');
        clearAuthState();
      }
    };

    initializeAuth();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT' || !session) {
        // Supabase session ended - clear all auth state
        localStorage.removeItem('admin_profile_cache');
        setState({
          adminUser: null,
          isAuthenticated: false,
          supabaseSession: null,
        });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Session changed - re-verify admin status
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile?.is_platform_admin) {
          localStorage.setItem('admin_profile_cache', JSON.stringify(profile));
          setState({
            adminUser: profile,
            isAuthenticated: true,
            supabaseSession: session,
          });
        } else {
          // Not an admin - sign out
          await supabase.auth.signOut();
          localStorage.removeItem('admin_profile_cache');
          setState({
            adminUser: null,
            isAuthenticated: false,
            supabaseSession: null,
          });
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // STEP 1: Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user || !authData.session) {
        return { error: { message: 'Invalid credentials' } };
      }

      // STEP 2: Fetch and verify admin profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Profile not found.' } };
      }

      // STEP 3: Verify is_platform_admin flag
      if (!profile.is_platform_admin) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Platform administrator access required.' } };
      }

      // STEP 4: Success - update state and cache
      localStorage.setItem('admin_profile_cache', JSON.stringify(profile));
      setState({
        adminUser: profile,
        isAuthenticated: true,
        supabaseSession: authData.session,
      });

      return { data: profile, error: null };
    } catch {
      return { error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    // Clear all auth state
    localStorage.removeItem('admin_profile_cache');
    setState({
      adminUser: null,
      isAuthenticated: false,
      supabaseSession: null,
    });

    // Sign out from Supabase (single source of truth)
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    adminUser: state.adminUser,
    isAuthenticated: state.isAuthenticated,
    supabaseSession: state.supabaseSession,
    loading,
    signIn,
    signOut,
  };
}
