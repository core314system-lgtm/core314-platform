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
    <div className="min-h-screen bg-[#0A0F1A] text-white flex items-center justify-center px-4">
      {/* Animated background */}
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
              Reset Password
            </span>
          </h1>
          <p className="text-gray-300">
            {success ? 'Check your email for reset instructions' : 'Enter your email to receive a reset link'}
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
            <h2 className="text-2xl font-bold mb-4 text-[#66FCF1]">Email Sent!</h2>
            <p className="text-gray-300 mb-6">
              We've sent a password reset link to <strong className="text-white">{email}</strong>
            </p>
            <p className="text-sm text-gray-400 mb-8">
              Please check your inbox and follow the instructions to reset your password. 
              The link will expire in 1 hour.
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-3 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all"
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
            className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8"
          >
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="your@email.com"
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
                  Sending reset link...
                </>
              ) : (
                'Send Reset Link'
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
