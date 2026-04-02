import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getSupabaseFunctionUrl, getSupabaseAnonKey } from '../lib/supabase';
import { supabase } from '../lib/supabase';

/**
 * AuthCallback - Handles OAuth callback from Google
 * 
 * Route: /auth/callback
 * 
 * Flow:
 * 1. Google redirects here with ?code=...&state=...
 * 2. This page extracts code + state from URL
 * 3. Sends them to google-oauth-exchange Edge Function
 * 4. Shows success/error UI
 * 5. Redirects to Integration Manager on success
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'exchanging' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Google OAuth callback...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double execution in React StrictMode
      if (exchangeStarted.current) return;
      exchangeStarted.current = true;

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Also handle legacy oauth_success flow (from old oauth-callback Edge Function)
      const oauthSuccess = searchParams.get('oauth_success');
      const service = searchParams.get('service');

      console.log('[AuthCallback] Callback received', {
        hasCode: !!code,
        hasState: !!state,
        error,
        oauthSuccess,
        service,
      });

      // Handle legacy success redirect (from other OAuth providers)
      if (oauthSuccess === 'true' && service) {
        setStatus('success');
        setMessage(`Successfully connected to ${service}!`);
        setTimeout(() => navigate('/integration-manager'), 2000);
        return;
      }

      // Handle OAuth error from Google
      if (error) {
        console.error('[AuthCallback] OAuth error from Google:', error, errorDescription);
        setStatus('error');
        setMessage(`Google OAuth error: ${error}`);
        setErrorDetails(errorDescription || null);
        return;
      }

      // Validate required params
      if (!code || !state) {
        console.error('[AuthCallback] Missing code or state');
        setStatus('error');
        setMessage('OAuth callback is missing required parameters.');
        setErrorDetails('The authorization code or state parameter is missing from the URL.');
        return;
      }

      // Exchange code for tokens via backend
      setStatus('exchanging');
      setMessage('Exchanging authorization code for tokens...');

      try {
        // Get auth session for the API call
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const url = await getSupabaseFunctionUrl('google-oauth-exchange');
        const anonKey = await getSupabaseAnonKey();

        // Determine the redirect_uri that was used when initiating OAuth
        // This MUST match exactly what was sent to Google
        const redirectUri = `${window.location.origin}/auth/callback`;

        console.log('[AuthCallback] Calling google-oauth-exchange', {
          url,
          redirectUri,
          hasToken: !!token,
        });

        const headers: Record<string, string> = {
          'apikey': anonKey,
          'Content-Type': 'application/json',
        };
        // Add auth header if user has a session (may not if they just signed up)
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code,
            state,
            redirect_uri: redirectUri,
          }),
        });

        const data = await response.json();
        console.log('[AuthCallback] Exchange response:', response.status, data);

        if (response.ok && data.success) {
          setStatus('success');
          setMessage(`Successfully connected ${data.service_name || 'Google service'}!`);

          // Redirect to Integration Manager after brief success display
          setTimeout(() => {
            navigate(`/integration-manager?oauth_success=true&service=${data.service_name || 'google'}`);
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.message || data.error || 'Token exchange failed');
          setErrorDetails(
            data.details?.google_error_description ||
            data.details?.google_error ||
            null
          );
        }
      } catch (err) {
        console.error('[AuthCallback] Exchange error:', err);
        setStatus('error');
        setMessage('Failed to complete OAuth connection');
        setErrorDetails(err instanceof Error ? err.message : 'Network error occurred');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md mx-4 shadow-lg border-slate-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {(status === 'loading' || status === 'exchanging') && (
              <div className="p-3 bg-blue-50 rounded-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}
            {status === 'success' && (
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 bg-red-50 rounded-full">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl">
            {status === 'loading' && 'Processing...'}
            {status === 'exchanging' && 'Connecting...'}
            {status === 'success' && 'Connected!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
          <CardDescription className="text-sm mt-2">{message}</CardDescription>
          {errorDetails && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded">{errorDetails}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {status === 'success' && (
            <p className="text-center text-sm text-slate-500">
              Redirecting to Integration Manager...
            </p>
          )}
          {status === 'error' && (
            <div className="space-y-2">
              <Button
                onClick={() => navigate('/integration-manager')}
                className="w-full"
                variant="default"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Integrations
              </Button>
              <Button
                onClick={() => {
                  exchangeStarted.current = false;
                  setStatus('loading');
                  setMessage('Retrying...');
                  setErrorDetails(null);
                  window.location.reload();
                }}
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
