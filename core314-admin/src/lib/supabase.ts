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
 * @deprecated Use useSupabaseClient() hook or initSupabaseClient() instead.
 * This getter returns null if the client hasn't been initialized yet.
 * 
 * This is a Proxy that forwards all property accesses to the actual client.
 * TypeScript sees it as SupabaseClient for compatibility with existing code.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClientSync();
    if (!client) {
      console.warn(
        'Supabase client accessed before initialization. ' +
        'Use useSupabaseClient() hook or await initSupabaseClient() instead.'
      );
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
