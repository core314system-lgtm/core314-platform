import { useEffect, useState, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

/**
 * Explicit auth status states - eliminates ambiguity from boolean combinations
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AdminAuthState {
  adminUser: User | null;
  authStatus: AuthStatus;
  supabaseSession: Session | null;
}

// Timeout for auth resolution (3 seconds)
const AUTH_TIMEOUT_MS = 3000;

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
 * 
 * State machine:
 * - 'loading': Auth is being resolved (show spinner)
 * - 'unauthenticated': No valid session or not admin (redirect to /login)
 * - 'authenticated': Valid session + is_platform_admin (render admin routes)
 * 
 * Hard fallback: If auth is still unresolved after 3 seconds, force to 'unauthenticated'
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    adminUser: null,
    authStatus: 'loading',
    supabaseSession: null,
  });
  
  // Track if auth has been resolved to prevent timeout from overwriting valid state
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    console.debug('[AdminAuth] Auth loading started');

    const setUnauthenticated = () => {
      if (!cancelled && !resolvedRef.current) {
        resolvedRef.current = true;
        console.debug('[AdminAuth] Setting state to unauthenticated');
        setState({
          adminUser: null,
          authStatus: 'unauthenticated',
          supabaseSession: null,
        });
      }
    };

    const setAuthenticated = (profile: User, session: Session) => {
      if (!cancelled) {
        resolvedRef.current = true;
        console.debug('[AdminAuth] Setting state to authenticated');
        setState({
          adminUser: profile,
          authStatus: 'authenticated',
          supabaseSession: session,
        });
      }
    };

    // Hard fallback: Force unauthenticated after timeout
    timeoutId = setTimeout(() => {
      if (!resolvedRef.current) {
        console.debug('[AdminAuth] Timeout reached - forcing unauthenticated state');
        setUnauthenticated();
      }
    }, AUTH_TIMEOUT_MS);

    const initializeAuth = async () => {
      try {
        // STEP 1: Check Supabase session FIRST (single source of truth)
        const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AdminAuth] Error getting Supabase session:', sessionError);
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated();
          return;
        }

        console.debug('[AdminAuth] Session resolved:', supabaseSession ? 'exists' : 'null');

        if (!supabaseSession) {
          // No Supabase session = NOT authenticated (fail closed)
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated();
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
          console.error('[AdminAuth] Error fetching admin profile:', profileError);
          // Sign out from Supabase since we can't verify admin status
          await supabase.auth.signOut();
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated();
          return;
        }

        // STEP 3: Verify is_platform_admin flag
        if (!profile.is_platform_admin) {
          console.warn('[AdminAuth] User is not a platform admin');
          // Sign out from Supabase - non-admins should not have access
          await supabase.auth.signOut();
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated();
          return;
        }

        // STEP 4: User is authenticated and is a platform admin
        // Update cache for faster subsequent loads (cache is NOT authoritative)
        try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
        
        setAuthenticated(profile, supabaseSession);
      } catch (error) {
        console.error('[AdminAuth] Unexpected error during auth initialization:', error);
        try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
        setUnauthenticated();
      }
    };

    initializeAuth();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      console.debug('[AdminAuth] Auth state change:', event);

      if (event === 'SIGNED_OUT' || !session) {
        // Supabase session ended - clear all auth state
        try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
        resolvedRef.current = true;
        setState({
          adminUser: null,
          authStatus: 'unauthenticated',
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
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: profile,
            authStatus: 'authenticated',
            supabaseSession: session,
          });
        } else {
          // Not an admin - sign out
          await supabase.auth.signOut();
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: null,
            authStatus: 'unauthenticated',
            supabaseSession: null,
          });
        }
      }
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
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
      try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
      setState({
        adminUser: profile,
        authStatus: 'authenticated',
        supabaseSession: authData.session,
      });

      return { data: profile, error: null };
    } catch {
      return { error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    // Clear all auth state
    try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
    setState({
      adminUser: null,
      authStatus: 'unauthenticated',
      supabaseSession: null,
    });

    // Sign out from Supabase (single source of truth)
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // Derive backward-compatible fields from authStatus
  const loading = state.authStatus === 'loading';
  const isAuthenticated = state.authStatus === 'authenticated';

  return {
    adminUser: state.adminUser,
    authStatus: state.authStatus,
    isAuthenticated,
    supabaseSession: state.supabaseSession,
    loading,
    signIn,
    signOut,
  };
}
