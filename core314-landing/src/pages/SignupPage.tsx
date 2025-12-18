import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { initSupabaseClient } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import Header from '../components/Header';

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan') || 'pro';
  
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    password: '',
    plan: selectedPlan,
    addons: [] as string[]
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize Supabase client at runtime (fetches config from Netlify Function)
      const supabase = await initSupabaseClient();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            company_name: formData.companyName,
            phone: formData.phone,
            plan: formData.plan,
            addons: formData.addons
          }
        }
      });

      if (authError) {
        // Check if this is a duplicate email error from Supabase Auth
        if (authError.message?.toLowerCase().includes('already registered') ||
            authError.message?.toLowerCase().includes('already exists') ||
            authError.message?.toLowerCase().includes('user already exists')) {
          throw new Error('An account with this email already exists. Please log in instead.');
        }
        throw authError;
      }

      if (!authData.user) throw new Error('Failed to create user account');

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        // Check if this is a duplicate email constraint violation
        if (profileError.message?.includes('profiles_email_key') || 
            profileError.message?.includes('duplicate key value violates unique constraint')) {
          throw new Error('An account with this email already exists. Please log in instead.');
        }
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }

      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: formData.plan,
          email: formData.email,
          userId: authData.user.id,
          addons: formData.addons,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
      setLoading(false);
    }
  };

  const plans = {
    starter: { name: 'Starter', price: '$99/mo' },
    pro: { name: 'Pro', price: '$999/mo' },
    enterprise: { name: 'Enterprise', price: 'Custom' }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white">
      <Header />

      <div className="pt-32 pb-20 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
                Start Your Free Trial
              </span>
            </h1>
            <p className="text-xl text-gray-300">
              Selected Plan: <span className="text-[#00BFFF] font-semibold">
                {plans[formData.plan as keyof typeof plans]?.name} - {plans[formData.plan as keyof typeof plans]?.price}
              </span>
            </p>
            <Link to="/pricing" className="text-sm text-[#00BFFF] hover:text-[#66FCF1] transition-colors">
              Change plan
            </Link>
          </motion.div>

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
                {error.includes('log in') && (
                  <Link 
                    to={`/login?email=${encodeURIComponent(formData.email)}`}
                    className="block mt-2 text-[#00BFFF] hover:text-[#66FCF1] font-semibold transition-colors"
                  >
                    Go to Login →
                  </Link>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="john@acme.com"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:border-[#00BFFF] focus:outline-none transition-colors"
                placeholder="Minimum 8 characters"
              />
              <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters long</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-gray-400">
                By signing up, you agree to our{' '}
                <Link to="/terms" className="text-[#00BFFF] hover:text-[#66FCF1]">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-[#00BFFF] hover:text-[#66FCF1]">Privacy Policy</Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating your account...
                </>
              ) : (
                'Start Free Trial'
              )}
            </button>

            <p className="text-center text-sm text-gray-400 mt-6">
              14-day free trial • Cancel anytime
            </p>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
