import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { initSupabaseClient } from '../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize Supabase client at runtime (fetches config from Netlify Function)
      const supabase = await initSupabaseClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://core314.com/reset-password/confirm`
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

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
            Reset Password
          </h1>
          <p className="text-slate-600">
            {success ? 'Check your email for reset instructions' : 'Enter your email to receive a reset link'}
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
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Email Sent!</h2>
            <p className="text-slate-600 mb-6">
              We've sent a password reset link to <strong className="text-slate-900">{email}</strong>
            </p>
            <p className="text-sm text-slate-500 mb-8">
              Please check your inbox and follow the instructions to reset your password. 
              The link will expire in 1 hour.
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Back to Login
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
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="your@email.com"
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
                  Sending reset link...
                </>
              ) : (
                'Send Reset Link'
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
