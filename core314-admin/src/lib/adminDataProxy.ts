/**
 * Admin Data Proxy
 * 
 * Fetches intelligence data from the admin-intelligence-data Netlify Function,
 * which uses the service_role key to bypass RLS and query all users' data.
 */

import { getSupabaseClientSync } from './supabaseClient';

async function getAuthToken(): Promise<string | null> {
  const client = getSupabaseClientSync();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  return session?.access_token ?? null;
}

export async function fetchAdminData<T = unknown>(type: string): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/.netlify/functions/admin-intelligence-data?type=${type}`, { headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorBody.error || `Failed to fetch ${type} data`);
  }
  return res.json();
}
