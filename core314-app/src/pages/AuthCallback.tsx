import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getSupabaseUrl, getSupabaseAnonKey, supabase } from '../lib/supabase';

/**
 * AuthCallback — handles OAuth redirects from providers (Google, Jira/Atlassian, etc.).
 *
 * Flow:
 *   1. Provider redirects here with ?code=...&state=...
 *   2. We forward code + state to the oauth-callback Edge Function
 *   3. The Edge Function exchanges the code for tokens and stores them
 *   4. On success we redirect to /integration-manager
 *   5. On failure we show a clear error message
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Debug logging
      console.log('[AuthCallback] Params received:', {
        code_present: !!code,
        code_length: code?.length ?? 0,
        state_present: !!state,
        state_length: state?.length ?? 0,
        error: error ?? 'none',
      });

      // Provider returned an error (e.g. user denied consent)
      if (error) {
        console.error('[AuthCallback] Provider returned error:', error);
        setStatus('error');
        setMessage(`Authorization failed: ${error}`);
        return;
      }

      // Validate both code and state are present
      if (!code || !state) {
        console.error('[AuthCallback] Missing code or state', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Missing authorization code or state parameter. Please try connecting again.');
        return;
      }

      try {
        setMessage('Exchanging authorization code...');

        // Build the oauth-callback Edge Function URL with code + state as query params
        const supabaseUrl = await getSupabaseUrl();
        const anonKey = await getSupabaseAnonKey();
        const callbackUrl = new URL(`${supabaseUrl}/functions/v1/oauth-callback`);
        callbackUrl.searchParams.set('code', code);
        callbackUrl.searchParams.set('state', state);

        // Get the current user session JWT for Authorization header
        // The oauth-callback edge function needs this to pass Supabase gateway auth
        let sessionToken: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          sessionToken = sessionData.session?.access_token ?? null;
          console.log('[AuthCallback] Session token:', sessionToken ? 'present' : 'missing');
        } catch (sessionErr) {
          console.warn('[AuthCallback] Could not get session token, using anon key:', sessionErr);
        }

        console.log('[AuthCallback] Calling oauth-callback Edge Function:', {
          url: callbackUrl.origin + callbackUrl.pathname,
          code_length: code.length,
          state: state,
          has_session_token: !!sessionToken,
        });

        // Call the Edge Function — use redirect: 'manual' so we can intercept
        // the 302 redirect and handle it ourselves
        // Pass Authorization header with user JWT (or anon key as fallback)
        const response = await fetch(callbackUrl.toString(), {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${sessionToken || anonKey}`,
          },
          redirect: 'manual',
        });

        console.log('[AuthCallback] Edge Function response:', {
          status: response.status,
          type: response.type,
          redirected: response.redirected,
          location: response.headers.get('location'),
        });

        // The oauth-callback Edge Function returns a 302 redirect on success
        // redirect: 'manual' means we get the 302 as an opaque redirect response
        if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 0) {
          // Success — the Edge Function processed the token exchange
          const location = response.headers.get('location');
          console.log('[AuthCallback] Success! Redirect location:', location);

          setStatus('success');
          setMessage('Connected successfully!');

          // Parse the redirect location to extract service name
          if (location) {
            const redirectUrl = new URL(location, window.location.origin);
            const service = redirectUrl.searchParams.get('service');
            if (service) {
              const displayName = service.charAt(0).toUpperCase() + service.slice(1).replace(/_/g, ' ');
              setMessage(`Successfully connected ${displayName}!`);
            }
          }

          // Redirect to integration manager after brief success display
          setTimeout(() => {
            if (location) {
              // Use the Edge Function's redirect target (preserves query params)
              const redirectUrl = new URL(location, window.location.origin);
              navigate(redirectUrl.pathname + redirectUrl.search);
            } else {
              navigate('/integration-manager?oauth_success=true');
            }
          }, 1500);
          return;
        }

        // If we got a non-redirect response, try to parse the error
        if (response.status >= 400) {
          let errorDetail = `Server returned ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.error || errorData.message || errorDetail;
            console.error('[AuthCallback] Edge Function error response:', errorData);
          } catch {
            // Response might not be JSON
            const text = await response.text();
            console.error('[AuthCallback] Edge Function error (non-JSON):', text);
            if (text) errorDetail = text;
          }
          setStatus('error');
          setMessage(`Connection failed: ${errorDetail}`);
          return;
        }

        // Unexpected response — treat as success if 2xx
        if (response.ok) {
          console.log('[AuthCallback] Got 2xx response (unexpected for oauth-callback)');
          setStatus('success');
          setMessage('Connected successfully!');
          setTimeout(() => {
            navigate('/integration-manager?oauth_success=true');
          }, 1500);
          return;
        }

        // Fallback — unknown response
        console.error('[AuthCallback] Unexpected response status:', response.status);
        setStatus('error');
        setMessage(`Unexpected response (${response.status}). Please try again.`);
      } catch (err) {
        console.error('[AuthCallback] Exception during callback handling:', err);
        setStatus('error');
        setMessage(
          err instanceof Error
            ? `Connection failed: ${err.message}`
            : 'An unexpected error occurred. Please try again.'
        );
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            {status === 'loading'
              ? 'Connecting...'
              : status === 'success'
                ? 'Connection Successful!'
                : 'Connection Failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {status === 'error' && (
          <CardContent className="flex flex-col gap-2">
            <Button onClick={() => navigate('/integration-manager')} className="w-full">
              Return to Integrations
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              If this keeps happening, check your OAuth app configuration settings.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
