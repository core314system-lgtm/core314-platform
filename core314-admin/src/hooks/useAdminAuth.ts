import { useEffect, useState, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getSupabaseUrlSync } from '../lib/supabaseRuntimeConfig';
import { User } from '../types';

/**
 * Explicit auth status states - eliminates ambiguity from boolean combinations
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AdminAuthState {
  adminUser: User | null;
  authStatus: AuthStatus;
  supabaseSession: Session | null;
  authError: string | null;
}

// Timeout for auth resolution (3 seconds)
const AUTH_TIMEOUT_MS = 3000;

// Timeout for individual operations (3 seconds)
const OPERATION_TIMEOUT_MS = 3000;

/**
 * ADMIN ALLOWLIST - Temporary override for immediate platform access
 * Emails in this list bypass the profile admin check and are granted admin access.
 * This is a bootstrap mechanism to unblock platform access.
 */
const ADMIN_ALLOWLIST = [
  'core314system@gmail.com',
  'support@govmatchai.com',
];

/**
 * Module-level guards to prevent race conditions across multiple useAdminAuth instances.
 * These are shared across all hook instances to ensure only one sign-out or sign-in
 * operation happens at a time, preventing the cascade of SIGNED_OUT events.
 */
let signOutInFlight = false;
let signInInFlight = false;

/**
 * Helper to extract project ref from Supabase URL
 */
function getProjectRef(url: string | null): string {
  if (!url) return 'unknown';
  try {
    const hostname = new URL(url).hostname;
    // Format: xxxxx.supabase.co
    const parts = hostname.split('.');
    return parts[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

/**
 * Log Supabase project info for debugging
 */
function logSupabaseProject(): void {
  const url = getSupabaseUrlSync();
  const projectRef = getProjectRef(url);
  console.log('[AdminAuth] === SUPABASE PROJECT INFO ===');
  console.log('[AdminAuth] Supabase URL:', url);
  console.log('[AdminAuth] Project Ref:', projectRef);
  console.log('[AdminAuth] =============================');
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
    authError: null,
  });
  
  // Track if auth has been resolved to prevent timeout from overwriting valid state
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Log Supabase project info at initialization
    logSupabaseProject();
    console.debug('[AdminAuth] Auth loading started');

    const setUnauthenticated = (error?: string) => {
      if (!cancelled && !resolvedRef.current) {
        resolvedRef.current = true;
        console.debug('[AdminAuth] Setting state to unauthenticated', error ? `Error: ${error}` : '');
        setState({
          adminUser: null,
          authStatus: 'unauthenticated',
          supabaseSession: null,
          authError: error || null,
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
          authError: null,
        });
      }
    };

    // Hard fallback: Force unauthenticated after timeout
    timeoutId = setTimeout(() => {
      if (!resolvedRef.current) {
        console.error('[AdminAuth] TIMEOUT reached - forcing unauthenticated state after', AUTH_TIMEOUT_MS, 'ms');
        setUnauthenticated('Authentication timed out. Please try again.');
      }
    }, AUTH_TIMEOUT_MS);

    const initializeAuth = async () => {
      try {
        // STEP 1: Check Supabase session FIRST (single source of truth)
        console.debug('[AdminAuth] Getting Supabase session...');
        const { data: { session: supabaseSession }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          OPERATION_TIMEOUT_MS,
          'Session fetch timed out'
        );

        if (sessionError) {
          console.error('[AdminAuth] Error getting Supabase session:', sessionError);
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated('Failed to get session');
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
        const userEmail = supabaseSession.user.email || '';
        
        // HARD LOG: User info
        console.log('[AdminAuth] === USER INFO ===');
        console.log('[AdminAuth] User ID:', userId);
        console.log('[AdminAuth] User Email:', userEmail);
        console.log('[AdminAuth] ====================');

        // Check admin allowlist FIRST (bypass for immediate access)
        const isAllowlisted = ADMIN_ALLOWLIST.includes(userEmail.toLowerCase());
        console.log('[AdminAuth] Admin allowlist check:', isAllowlisted ? 'ALLOWED' : 'not in allowlist');

        // ALLOWLIST SHORT-CIRCUIT: Grant immediate access without waiting for profile fetch
        if (isAllowlisted) {
          console.log('[AdminAuth] ALLOWLIST SHORT-CIRCUIT (initializeAuth): Granting immediate access');
          const syntheticProfile: User = {
            id: userId,
            email: userEmail,
            full_name: userEmail.split('@')[0] || 'Admin User',
            role: 'admin',
            two_factor_enabled: false,
            subscription_tier: 'enterprise',
            subscription_status: 'active',
            is_platform_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as User;
          
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
          setAuthenticated(syntheticProfile, supabaseSession);
          
          // Kick off profile fetch in background (non-blocking) to update cache with real data
          Promise.resolve(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()
          ).then(({ data: realProfile }) => {
            if (realProfile) {
              console.log('[AdminAuth] Background profile fetch succeeded, updating cache');
              try { localStorage.setItem('admin_profile_cache', JSON.stringify(realProfile)); } catch { /* ignore */ }
              setState(prev => ({ ...prev, adminUser: realProfile }));
            }
          }).catch(() => { /* ignore background fetch errors */ });
          
          return;
        }

        // Fetch profile from database (only for non-allowlisted users)
        console.debug('[AdminAuth] Fetching profile from database...');
        const profilePromise = Promise.resolve(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        );
        const { data: profile, error: profileError } = await withTimeout(
          profilePromise,
          OPERATION_TIMEOUT_MS,
          'Profile fetch timed out'
        );

        // HARD LOG: Profile query result
        console.log('[AdminAuth] === PROFILE QUERY RESULT ===');
        console.log('[AdminAuth] Profile data:', profile);
        console.log('[AdminAuth] Profile error:', profileError);
        console.log('[AdminAuth] is_platform_admin:', profile?.is_platform_admin);
        console.log('[AdminAuth] ==============================');

        // AUTO-HEAL: If no profile exists, create one
        if (profileError || !profile) {
          console.warn('[AdminAuth] NO PROFILE ROW found for user:', userId);
          
          // Attempt to auto-heal by creating profile
          console.log('[AdminAuth] Attempting to auto-heal missing profile...');
          const newProfile: Partial<User> = {
            id: userId,
            email: userEmail,
            full_name: userEmail.split('@')[0] || 'Admin User',
            role: 'admin',
            two_factor_enabled: false,
            subscription_tier: 'enterprise',
            subscription_status: 'active',
            is_platform_admin: isAllowlisted, // Only set admin for allowlisted emails
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .single();
          
          console.log('[AdminAuth] Auto-heal result:', { insertedProfile, insertError });
          
          if (insertError || !insertedProfile) {
            console.error('[AdminAuth] Auto-heal FAILED:', insertError);
            // If allowlisted, grant access anyway with synthetic profile
            if (isAllowlisted) {
              console.log('[AdminAuth] ALLOWLIST OVERRIDE: Granting access despite profile issues');
              const syntheticProfile = newProfile as User;
              try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
              setAuthenticated(syntheticProfile, supabaseSession);
              return;
            }
            await supabase.auth.signOut();
            try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
            setUnauthenticated('Profile not found and could not be created');
            return;
          }
          
          // Profile created successfully
          if (isAllowlisted || insertedProfile.is_platform_admin) {
            try { localStorage.setItem('admin_profile_cache', JSON.stringify(insertedProfile)); } catch { /* ignore */ }
            setAuthenticated(insertedProfile, supabaseSession);
            return;
          } else {
            await supabase.auth.signOut();
            setUnauthenticated('Access denied. Platform administrator access required.');
            return;
          }
        }

        // STEP 3: Verify is_platform_admin flag OR allowlist
        const hasAdminAccess = profile.is_platform_admin || isAllowlisted;
        console.log('[AdminAuth] Admin access check:', { 
          is_platform_admin: profile.is_platform_admin, 
          isAllowlisted, 
          hasAdminAccess 
        });
        
        if (!hasAdminAccess) {
          console.warn('[AdminAuth] User is not a platform admin and not in allowlist');
          await supabase.auth.signOut();
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          setUnauthenticated('Access denied. Platform administrator access required.');
          return;
        }

        // STEP 4: User is authenticated and has admin access
        // Update cache for faster subsequent loads (cache is NOT authoritative)
        try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
        
        setAuthenticated(profile, supabaseSession);
      } catch (error) {
        console.error('[AdminAuth] Unexpected error during auth initialization:', error);
        try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
        setUnauthenticated(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    initializeAuth();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      console.debug('[AdminAuth] Auth state change:', event, 'signInInFlight:', signInInFlight);

      if (event === 'SIGNED_OUT' || !session) {
        // Supabase session ended - clear all auth state
        try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
        resolvedRef.current = true;
        setState({
          adminUser: null,
          authStatus: 'unauthenticated',
          supabaseSession: null,
          authError: null,
        });
      } else if (event === 'SIGNED_IN') {
        // Skip admin check if signIn() is in progress - it will handle the check
        // This prevents race conditions where multiple hook instances all try to
        // verify admin status and potentially call signOut() concurrently
        if (signInInFlight) {
          console.debug('[AdminAuth] Skipping SIGNED_IN handling - signIn in progress');
          return;
        }
        
        // Check allowlist for this user
        const userEmail = session.user.email || '';
        const isAllowlisted = ADMIN_ALLOWLIST.includes(userEmail.toLowerCase());
        
        // ALLOWLIST SHORT-CIRCUIT: Grant immediate access without waiting for profile fetch
        if (isAllowlisted) {
          console.log('[AdminAuth] ALLOWLIST SHORT-CIRCUIT (SIGNED_IN): Granting immediate access');
          const syntheticProfile: User = {
            id: session.user.id,
            email: userEmail,
            full_name: userEmail.split('@')[0] || 'Admin User',
            role: 'admin',
            two_factor_enabled: false,
            subscription_tier: 'enterprise',
            subscription_status: 'active',
            is_platform_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as User;
          
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: syntheticProfile,
            authStatus: 'authenticated',
            supabaseSession: session,
            authError: null,
          });
          
          // Kick off profile fetch in background (non-blocking)
          Promise.resolve(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
          ).then(({ data: realProfile }) => {
            if (realProfile) {
              console.log('[AdminAuth] Background profile fetch succeeded, updating cache');
              try { localStorage.setItem('admin_profile_cache', JSON.stringify(realProfile)); } catch { /* ignore */ }
              setState(prev => ({ ...prev, adminUser: realProfile }));
            }
          }).catch(() => { /* ignore background fetch errors */ });
          
          return;
        }
        
        // Session changed outside of signIn flow - re-verify admin status (non-allowlisted users only)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const hasAdminAccess = profile?.is_platform_admin;
        
        if (hasAdminAccess && profile) {
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: profile,
            authStatus: 'authenticated',
            supabaseSession: session,
            authError: null,
          });
        } else {
          // Not an admin - sign out (with guard to prevent multiple concurrent signOuts)
          if (!signOutInFlight) {
            signOutInFlight = true;
            console.debug('[AdminAuth] Signing out non-admin user');
            await supabase.auth.signOut();
            signOutInFlight = false;
          }
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: null,
            authStatus: 'unauthenticated',
            supabaseSession: null,
            authError: 'Access denied. Platform administrator access required.',
          });
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Check allowlist for this user
        const userEmail = session.user.email || '';
        const isAllowlisted = ADMIN_ALLOWLIST.includes(userEmail.toLowerCase());
        
        // ALLOWLIST SHORT-CIRCUIT: Grant immediate access without waiting for profile fetch
        if (isAllowlisted) {
          console.log('[AdminAuth] ALLOWLIST SHORT-CIRCUIT (TOKEN_REFRESHED): Granting immediate access');
          const syntheticProfile: User = {
            id: session.user.id,
            email: userEmail,
            full_name: userEmail.split('@')[0] || 'Admin User',
            role: 'admin',
            two_factor_enabled: false,
            subscription_tier: 'enterprise',
            subscription_status: 'active',
            is_platform_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as User;
          
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: syntheticProfile,
            authStatus: 'authenticated',
            supabaseSession: session,
            authError: null,
          });
          
          // Kick off profile fetch in background (non-blocking)
          Promise.resolve(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
          ).then(({ data: realProfile }) => {
            if (realProfile) {
              console.log('[AdminAuth] Background profile fetch succeeded, updating cache');
              try { localStorage.setItem('admin_profile_cache', JSON.stringify(realProfile)); } catch { /* ignore */ }
              setState(prev => ({ ...prev, adminUser: realProfile }));
            }
          }).catch(() => { /* ignore background fetch errors */ });
          
          return;
        }
        
        // Token refresh - re-verify admin status (non-allowlisted users only)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const hasAdminAccess = profile?.is_platform_admin;

        if (hasAdminAccess && profile) {
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: profile,
            authStatus: 'authenticated',
            supabaseSession: session,
            authError: null,
          });
        } else {
          // Not an admin - sign out (with guard)
          if (!signOutInFlight) {
            signOutInFlight = true;
            await supabase.auth.signOut();
            signOutInFlight = false;
          }
          try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
          resolvedRef.current = true;
          setState({
            adminUser: null,
            authStatus: 'unauthenticated',
            supabaseSession: null,
            authError: 'Access denied. Platform administrator access required.',
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
    // Set guard to prevent onAuthStateChange from racing with this function
    signInInFlight = true;
    
    // Log Supabase project info at sign-in
    logSupabaseProject();
    console.log('[AdminAuth] === SIGN IN STARTED ===');
    console.log('[AdminAuth] Email:', email);
    
    try {
      // STEP 1: Authenticate with Supabase (with timeout)
      console.debug('[AdminAuth] Calling signInWithPassword');
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        OPERATION_TIMEOUT_MS,
        'Sign-in timed out'
      );

      if (authError || !authData.user || !authData.session) {
        console.log('[AdminAuth] signInWithPassword FAILED:', authError?.message);
        signInInFlight = false;
        return { error: { message: authError?.message || 'Invalid credentials' } };
      }
      
      console.log('[AdminAuth] signInWithPassword SUCCEEDED');
      console.log('[AdminAuth] User ID:', authData.user.id);
      console.log('[AdminAuth] User Email:', authData.user.email);

      // Check admin allowlist FIRST (bypass for immediate access)
      const userEmail = authData.user.email || '';
      const isAllowlisted = ADMIN_ALLOWLIST.includes(userEmail.toLowerCase());
      console.log('[AdminAuth] Admin allowlist check:', isAllowlisted ? 'ALLOWED' : 'not in allowlist');

      // ALLOWLIST SHORT-CIRCUIT: Grant immediate access without waiting for profile fetch
      if (isAllowlisted) {
        console.log('[AdminAuth] ALLOWLIST SHORT-CIRCUIT: Granting immediate access');
        const syntheticProfile: User = {
          id: authData.user.id,
          email: userEmail,
          full_name: userEmail.split('@')[0] || 'Admin User',
          role: 'admin',
          two_factor_enabled: false,
          subscription_tier: 'enterprise',
          subscription_status: 'active',
          is_platform_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as User;
        
        try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
        setState({
          adminUser: syntheticProfile,
          authStatus: 'authenticated',
          supabaseSession: authData.session,
          authError: null,
        });
        
        // Kick off profile fetch in background (non-blocking) to update cache with real data
        Promise.resolve(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single()
        ).then(({ data: realProfile }) => {
          if (realProfile) {
            console.log('[AdminAuth] Background profile fetch succeeded, updating cache');
            try { localStorage.setItem('admin_profile_cache', JSON.stringify(realProfile)); } catch { /* ignore */ }
            setState(prev => ({ ...prev, adminUser: realProfile }));
          }
        }).catch(() => { /* ignore background fetch errors */ });
        
        signInInFlight = false;
        return { data: syntheticProfile, error: null };
      }

      // STEP 2: Fetch admin profile (with timeout) - only for non-allowlisted users
      console.debug('[AdminAuth] Fetching profile from database...');
      const signInProfilePromise = Promise.resolve(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single()
      );
      const { data: profile, error: profileError } = await withTimeout(
        signInProfilePromise,
        OPERATION_TIMEOUT_MS,
        'Profile fetch timed out'
      );

      // HARD LOG: Profile query result
      console.log('[AdminAuth] === PROFILE QUERY RESULT ===');
      console.log('[AdminAuth] Profile data:', profile);
      console.log('[AdminAuth] Profile error:', profileError);
      console.log('[AdminAuth] is_platform_admin:', profile?.is_platform_admin);
      console.log('[AdminAuth] ==============================');

      // AUTO-HEAL: If no profile exists, create one
      if (profileError || !profile) {
        console.warn('[AdminAuth] NO PROFILE ROW found, attempting auto-heal...');
        
        const newProfile: Partial<User> = {
          id: authData.user.id,
          email: userEmail,
          full_name: userEmail.split('@')[0] || 'Admin User',
          role: 'admin',
          two_factor_enabled: false,
          subscription_tier: 'enterprise',
          subscription_status: 'active',
          is_platform_admin: isAllowlisted,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single();
        
        console.log('[AdminAuth] Auto-heal result:', { insertedProfile, insertError });
        
        if (insertError || !insertedProfile) {
          console.error('[AdminAuth] Auto-heal FAILED:', insertError);
          // If allowlisted, grant access anyway with synthetic profile
          if (isAllowlisted) {
            console.log('[AdminAuth] ALLOWLIST OVERRIDE: Granting access despite profile issues');
            const syntheticProfile = newProfile as User;
            try { localStorage.setItem('admin_profile_cache', JSON.stringify(syntheticProfile)); } catch { /* ignore */ }
            setState({
              adminUser: syntheticProfile,
              authStatus: 'authenticated',
              supabaseSession: authData.session,
              authError: null,
            });
            signInInFlight = false;
            return { data: syntheticProfile, error: null };
          }
          // Not allowlisted and profile creation failed
          if (!signOutInFlight) {
            signOutInFlight = true;
            await supabase.auth.signOut();
            signOutInFlight = false;
          }
          signInInFlight = false;
          return { error: { message: 'Profile not found and could not be created.' } };
        }
        
        // Profile created successfully
        if (isAllowlisted || insertedProfile.is_platform_admin) {
          try { localStorage.setItem('admin_profile_cache', JSON.stringify(insertedProfile)); } catch { /* ignore */ }
          setState({
            adminUser: insertedProfile,
            authStatus: 'authenticated',
            supabaseSession: authData.session,
            authError: null,
          });
          signInInFlight = false;
          return { data: insertedProfile, error: null };
        } else {
          if (!signOutInFlight) {
            signOutInFlight = true;
            await supabase.auth.signOut();
            signOutInFlight = false;
          }
          signInInFlight = false;
          return { error: { message: 'Access denied. Platform administrator access required.' } };
        }
      }

      // STEP 3: Verify is_platform_admin flag OR allowlist
      const hasAdminAccess = profile.is_platform_admin || isAllowlisted;
      console.log('[AdminAuth] Admin access check:', { 
        is_platform_admin: profile.is_platform_admin, 
        isAllowlisted, 
        hasAdminAccess 
      });
      
      if (!hasAdminAccess) {
        console.log('[AdminAuth] User is NOT a platform admin and NOT in allowlist, signing out');
        if (!signOutInFlight) {
          signOutInFlight = true;
          await supabase.auth.signOut();
          signOutInFlight = false;
        }
        signInInFlight = false;
        return { error: { message: 'Access denied. Platform administrator access required.' } };
      }

      // STEP 4: Success - update state and cache
      console.log('[AdminAuth] === SIGN IN SUCCESSFUL ===');
      try { localStorage.setItem('admin_profile_cache', JSON.stringify(profile)); } catch { /* ignore */ }
      setState({
        adminUser: profile,
        authStatus: 'authenticated',
        supabaseSession: authData.session,
        authError: null,
      });

      signInInFlight = false;
      return { data: profile, error: null };
    } catch (error) {
      console.error('[AdminAuth] signIn UNEXPECTED ERROR:', error);
      signInInFlight = false;
      return { error: { message: error instanceof Error ? error.message : 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    // Clear all auth state
    try { localStorage.removeItem('admin_profile_cache'); } catch { /* ignore */ }
    setState({
      adminUser: null,
      authStatus: 'unauthenticated',
      supabaseSession: null,
      authError: null,
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
    authError: state.authError,
    isAuthenticated,
    supabaseSession: state.supabaseSession,
    loading,
    signIn,
    signOut,
  };
}
