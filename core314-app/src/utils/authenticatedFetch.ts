/**
 * Authenticated Fetch Utility
 *
 * Provides automatic session recovery for Supabase Edge Function calls.
 * If the session is missing or expired, it attempts a refresh before retrying.
 * If refresh fails, it throws a SESSION_EXPIRED error for the caller to handle.
 *
 * Usage:
 *   const response = await authenticatedFetch(async (token) => {
 *     return await fetch(url, {
 *       headers: { Authorization: `Bearer ${token}` },
 *     });
 *   });
 */

import { supabase } from '../lib/supabase';

export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Execute an async function with a valid access token.
 * Automatically refreshes the session if the token is missing or if the
 * request returns a 401 Unauthorized response.
 *
 * @param fn - Async function that receives a valid access token and returns a Response
 * @returns The Response from the successful call
 * @throws SessionExpiredError if the session cannot be recovered
 */
export async function authenticatedFetch(
  fn: (accessToken: string) => Promise<Response>
): Promise<Response> {
  // Step 1: Get current session
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token;

  // Step 2: If no token, attempt refresh
  if (!accessToken) {
    console.log('[Auth] No session -> attempting refresh');
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data?.session?.access_token) {
      console.log('[Auth] Refresh failed');
      throw new SessionExpiredError();
    }

    console.log('[Auth] Refresh success');
    accessToken = data.session.access_token;
  }

  // Step 3: Execute the request
  try {
    const response = await fn(accessToken);

    // Step 4: If 401, attempt refresh and retry once
    if (response.status === 401) {
      console.log('[Auth] Received 401 -> attempting refresh');
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data?.session?.access_token) {
        console.log('[Auth] Refresh failed');
        throw new SessionExpiredError();
      }

      console.log('[Auth] Refresh success');
      console.log('[Auth] Retrying request after refresh');
      return await fn(data.session.access_token);
    }

    return response;
  } catch (err) {
    // If it's already a SessionExpiredError, re-throw
    if (err instanceof SessionExpiredError) {
      throw err;
    }

    // Detect auth-related errors in the catch
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Unauthorized') || message.includes('401')) {
      console.log('[Auth] Auth error detected -> attempting refresh');
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data?.session?.access_token) {
        console.log('[Auth] Refresh failed');
        throw new SessionExpiredError();
      }

      console.log('[Auth] Refresh success');
      console.log('[Auth] Retrying request after refresh');
      return await fn(data.session.access_token);
    }

    throw err;
  }
}
