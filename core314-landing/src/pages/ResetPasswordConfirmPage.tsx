import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { initSupabaseClient } from '../lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPasswordConfirmPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      
      if (errorCode === 'otp_expired' || params.get('error') === 'access_denied') {
        setSessionError(true);
        setInitializing(false);
        return;
      }
    }

    let subscription: { unsubscribe: () => void } | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const initAuth = async () => {
      try {
        const supabase = await initSupabaseClient();
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            setInitializing(false);
          } else if (event === 'SIGNED_OUT') {
            setSessionError(true);
            setInitializing(false);
          }
        });
        subscription = authListener.subscription;

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setInitializing(false);
        }
      } catch (err) {
        setSessionError(true);
        setInitializing(false);
      }
    };

    initAuth();

    timeout = setTimeout(() => {
      if (initializing) {
        setSessionError(true);
        setInitializing(false);
      }
    }, 5000);

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const supabase = await initSupabaseClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 flex items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative z-10 w-full max-w-md text-center">
          <Loader2 className="h-16 w-16 text-sky-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl text-slate-600">Verifying reset link...</h2>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 flex items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm"
          >
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-red-600">Invalid or Expired Link</h2>
            <p className="text-slate-600 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              to="/reset-password"
              className="inline-block px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Request New Link
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 flex items-center justify-center px-4">
      {/* Subtle decorative background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/logo-icon.png" alt="Core314" className="h-16 w-16" />
          </Link>
          <h1 className="text-4xl font-bold mb-2 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Set New Password
          </h1>
          <p className="text-slate-600">
            {success ? 'Your password has been reset successfully' : 'Enter your new password below'}
          </p>
        </motion.div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm"
          >
            <CheckCircle className="h-16 w-16 text-sky-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Password Reset!</h2>
            <p className="text-slate-600 mb-6">
              Your password has been successfully updated. You will be redirected to the login page shortly.
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Go to Login
            </Link>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
          >
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="Enter new password"
                minLength={8}
              />
              <p className="mt-1 text-xs text-slate-500">
                Must be at least 8 characters
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Resetting password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            <div className="mt-6 text-center">
              <p className="text-slate-500">
                Remember your password?{' '}
                <Link to="/login" className="text-sky-600 hover:text-sky-700 font-semibold transition-colors">
                  Log in
                </Link>
              </p>
            </div>
          </motion.form>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 text-center"
        >
          <Link to="/" className="text-sm text-slate-500 hover:text-sky-600 transition-colors">
            ← Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
