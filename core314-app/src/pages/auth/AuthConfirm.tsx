/**
 * Auth Confirmation Page
 * 
 * Handles all auth email confirmation flows:
 * - Email verification (signup confirmation)
 * - Magic link login
 * - Email change confirmation
 * 
 * Password reset is handled separately by ResetPasswordConfirm.tsx
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';

type ConfirmationType = 'signup' | 'magiclink' | 'email_change' | 'recovery' | 'unknown';

interface ConfirmationState {
  status: 'loading' | 'success' | 'error';
  type: ConfirmationType;
  message: string;
}

export function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmationState>({
    status: 'loading',
    type: 'unknown',
    message: 'Verifying your request...',
  });

  useEffect(() => {
    const handleConfirmation = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type') as ConfirmationType || 'unknown';
      const redirectTo = searchParams.get('redirect_to') || '/dashboard';

      // If no token_hash, check for hash fragment (Supabase default behavior)
      if (!tokenHash) {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const errorCode = params.get('error_code');
          const errorDesc = params.get('error_description');
          
          if (errorCode || params.get('error')) {
            setState({
              status: 'error',
              type,
              message: errorDesc || 'This link is invalid or has expired.',
            });
            return;
          }

          // Check for access_token in hash (magic link or signup confirmation)
          const accessToken = params.get('access_token');
          if (accessToken) {
            // Session should be automatically set by Supabase
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setState({
                status: 'success',
                type: type === 'magiclink' ? 'magiclink' : 'signup',
                message: type === 'magiclink' 
                  ? 'You have been signed in successfully.'
                  : 'Your email has been verified successfully.',
              });
              
              // Redirect after a short delay
              setTimeout(() => {
                navigate(redirectTo, { replace: true });
              }, 2000);
              return;
            }
          }
        }

        // No valid token found
        setState({
          status: 'error',
          type,
          message: 'Invalid confirmation link. Please request a new one.',
        });
        return;
      }

      // Handle token_hash based confirmation
      try {
        if (type === 'recovery') {
          // Redirect to password reset confirm page
          navigate(`/reset-password/confirm#access_token=${tokenHash}`, { replace: true });
          return;
        }

        // Verify the OTP token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === 'signup' ? 'signup' : type === 'magiclink' ? 'magiclink' : type === 'email_change' ? 'email_change' : 'signup',
        });

        if (error) {
          console.error('OTP verification error:', error);
          setState({
            status: 'error',
            type,
            message: error.message || 'This link is invalid or has expired.',
          });
          return;
        }

        if (data.session || data.user) {
          let successMessage = 'Verification successful.';
          
          switch (type) {
            case 'signup':
              successMessage = 'Your email has been verified. Welcome to Core314!';
              break;
            case 'magiclink':
              successMessage = 'You have been signed in successfully.';
              break;
            case 'email_change':
              successMessage = 'Your email address has been updated successfully.';
              break;
          }

          setState({
            status: 'success',
            type,
            message: successMessage,
          });

          // Redirect after a short delay
          setTimeout(() => {
            navigate(redirectTo, { replace: true });
          }, 2000);
        } else {
          setState({
            status: 'error',
            type,
            message: 'Verification failed. Please try again or request a new link.',
          });
        }
      } catch (err) {
        console.error('Confirmation error:', err);
        setState({
          status: 'error',
          type,
          message: err instanceof Error ? err.message : 'An unexpected error occurred.',
        });
      }
    };

    handleConfirmation();
  }, [searchParams, navigate]);

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin" />
            <h2 className="mt-6 text-center text-xl text-gray-900 dark:text-white">
              {state.message}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Please wait while we verify your request.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Verification Failed
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {state.message}
            </p>
          </div>
          <div className="text-center space-y-3">
            {state.type === 'signup' && (
              <Link 
                to="/signup" 
                className="block font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up again
              </Link>
            )}
            {state.type === 'magiclink' && (
              <Link 
                to="/login" 
                className="block font-medium text-blue-600 hover:text-blue-500"
              >
                Request new sign-in link
              </Link>
            )}
            {state.type === 'email_change' && (
              <Link 
                to="/settings" 
                className="block font-medium text-blue-600 hover:text-blue-500"
              >
                Go to Settings
              </Link>
            )}
            <Link 
              to="/login" 
              className="block font-medium text-gray-500 hover:text-gray-400"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {state.type === 'magiclink' ? (
            <Mail className="mx-auto h-16 w-16 text-green-500" />
          ) : (
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          )}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {state.type === 'signup' && 'Email Verified'}
            {state.type === 'magiclink' && 'Signed In'}
            {state.type === 'email_change' && 'Email Updated'}
            {state.type === 'unknown' && 'Success'}
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {state.message}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            Redirecting you to the dashboard...
          </p>
        </div>
        <div className="text-center">
          <Link 
            to="/dashboard" 
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Go to Dashboard now
          </Link>
        </div>
      </div>
    </div>
  );
}
