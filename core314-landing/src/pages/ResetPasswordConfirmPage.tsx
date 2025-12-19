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
      <div className="min-h-screen bg-[#0A0F1A] text-white flex items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
        </div>

        <div className="relative z-10 w-full max-w-md text-center">
          <Loader2 className="h-16 w-16 text-[#00BFFF] mx-auto mb-4 animate-spin" />
          <h2 className="text-xl text-gray-300">Verifying reset link...</h2>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] text-white flex items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-red-500/30 rounded-xl p-8 text-center"
          >
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-red-400">Invalid or Expired Link</h2>
            <p className="text-gray-300 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              to="/reset-password"
              className="inline-block px-8 py-3 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all"
            >
              Request New Link
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#66FCF1] rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
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
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              Set New Password
            </span>
          </h1>
          <p className="text-gray-300">
            {success ? 'Your password has been reset successfully' : 'Enter your new password below'}
          </p>
        </motion.div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8 text-center"
          >
            <CheckCircle className="h-16 w-16 text-[#00BFFF] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-[#66FCF1]">Password Reset!</h2>
            <p className="text-gray-300 mb-6">
              Your password has been successfully updated. You will be redirected to the login page shortly.
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-3 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all"
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
            className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8"
          >
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="Enter new password"
                minLength={8}
              />
              <p className="mt-1 text-xs text-gray-400">
                Must be at least 8 characters
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <p className="text-gray-400">
                Remember your password?{' '}
                <Link to="/login" className="text-[#00BFFF] hover:text-[#66FCF1] font-semibold transition-colors">
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
          <Link to="/" className="text-sm text-gray-400 hover:text-[#00BFFF] transition-colors">
            ← Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
