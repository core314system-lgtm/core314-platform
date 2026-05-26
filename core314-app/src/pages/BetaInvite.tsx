import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function BetaInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [tier, setTier] = useState('');

  useEffect(() => {
    activateInvite();
  }, []);

  async function activateInvite() {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid invite link - missing token');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const returnUrl = `/beta-invite?token=${token}`;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      const { data, error } = await supabase.functions.invoke('activate-beta-invite', {
        body: { invite_token: token }
      });

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Failed to activate invite');
        return;
      }

      if (!data.success) {
        setStatus('error');
        setMessage(data.error || 'Failed to activate invite');
        return;
      }

      setStatus('success');
      setTier(data.tier);
      setMessage(data.message || 'Beta invite activated successfully!');

      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Error activating invite:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Activating Your Beta Invite
              </h1>
              <p className="text-gray-600">
                Please wait while we set up your account...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Core314 Beta!
              </h1>
              <p className="text-gray-600 mb-4">
                {message}
              </p>
              {tier && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900">
                    Your Plan: <span className="font-bold">{tier}</span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    14-day trial included
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                Redirecting to your dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Activation Failed
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => navigate('/contact')}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Contact Support
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
