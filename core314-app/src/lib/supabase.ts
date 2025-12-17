/**
 * Supabase Client Export
 * 
 * This module re-exports the Supabase client initialization functions
 * from the new runtime client module. The client is initialized at runtime
 * using configuration fetched from a Netlify Function.
 * 
 * For new code, prefer using:
 * - useSupabaseClient() hook from '@/contexts/SupabaseClientContext'
 * - initSupabaseClient() for async initialization
 * - getSupabaseFunctionUrl() for Edge Function URLs
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export { 
  initSupabaseClient, 
  getSupabaseClientSync,
  isClientInitialized 
} from './supabaseClient';

export { 
  getSupabaseConfig,
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseUrlSync,
  getSupabaseAnonKeySync,
  getSupabaseFunctionUrl,
  isConfigLoaded 
} from './supabaseRuntimeConfig';

// For backward compatibility with code that imports `supabase` directly,
// we provide a getter that returns the client if initialized.
// New code should use useSupabaseClient() or initSupabaseClient() instead.
import { getSupabaseClientSync } from './supabaseClient';

/**
 * Creates a stub that throws a helpful error when auth methods are called
 * before the Supabase client is initialized.
 */
function createAuthStub() {
  const errorMessage = 'Authentication service unavailable. Please try again later.';
  const createAsyncStub = () => async () => {
    throw new Error(errorMessage);
  };
  
  return {
    getSession: createAsyncStub(),
    getUser: createAsyncStub(),
    signInWithPassword: createAsyncStub(),
    signUp: createAsyncStub(),
    signOut: createAsyncStub(),
    onAuthStateChange: () => {
      console.warn('Supabase client not initialized. Auth state changes will not be tracked.');
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };
}

/**
 * @deprecated Use useSupabaseClient() hook or initSupabaseClient() instead.
 * This getter returns null if the client hasn't been initialized yet.
 * 
 * This is a Proxy that forwards all property accesses to the actual client.
 * TypeScript sees it as SupabaseClient for compatibility with existing code.
 * 
 * When accessed before initialization, auth methods will throw a user-friendly
 * error instead of crashing with "Cannot read properties of null".
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClientSync();
    if (!client) {
      if (import.meta.env.DEV) {
        console.warn(
          'Supabase client accessed before initialization. ' +
          'Use useSupabaseClient() hook or await initSupabaseClient() instead.'
        );
      }
      // Return auth stub to prevent "Cannot read properties of null (reading 'auth')" errors
      if (prop === 'auth') {
        return createAuthStub();
      }
      // For other properties, return undefined (will cause errors but won't crash on .auth access)
      return undefined;
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    // Bind functions to the client to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
