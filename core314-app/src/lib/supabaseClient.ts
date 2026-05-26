/**
 * Supabase Client with Runtime Configuration
 * 
 * This module provides a Supabase client that is initialized at runtime
 * using configuration fetched from a Netlify Function, preventing
 * sensitive values from being embedded in the client-side bundle.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseRuntimeConfig';

let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

/**
 * Initialize the Supabase client asynchronously.
 * This fetches configuration from the Netlify Function and creates the client.
 * The result is cached, so subsequent calls return the same client.
 */
export async function initSupabaseClient(): Promise<SupabaseClient> {
  if (client) return client;
  
  if (!initPromise) {
    initPromise = (async () => {
      const { url, anon } = await getSupabaseConfig();
      client = createClient(url, anon, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      return client;
    })();
  }
  
  return initPromise;
}

/**
 * Get the Supabase client synchronously.
 * Returns null if the client hasn't been initialized yet.
 * Use initSupabaseClient() for async initialization.
 */
export function getSupabaseClientSync(): SupabaseClient | null {
  return client;
}

/**
 * Check if the Supabase client has been initialized.
 */
export function isClientInitialized(): boolean {
  return client !== null;
}
