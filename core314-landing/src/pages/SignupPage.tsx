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
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <div className="pt-32 pb-20 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Start Your Free Trial
            </h1>
            <p className="text-xl text-slate-600">
              Selected Plan: <span className="text-sky-600 font-semibold">
                {plans[formData.plan as keyof typeof plans]?.name} - {plans[formData.plan as keyof typeof plans]?.price}
              </span>
            </p>
            <Link to="/pricing" className="text-sm text-sky-500 hover:text-sky-600 transition-colors">
              Change plan
            </Link>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            onSubmit={handleSubmit}
            className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm"
          >
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                {error}
                {error.includes('log in') && (
                  <Link 
                    to={`/login?email=${encodeURIComponent(formData.email)}`}
                    className="block mt-2 text-sky-600 hover:text-sky-700 font-semibold transition-colors"
                  >
                    Go to Login →
                  </Link>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="john@acme.com"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-slate-900"
                placeholder="Minimum 8 characters"
              />
              <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters long</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-slate-500">
                By signing up, you agree to our{' '}
                <Link to="/terms" className="text-sky-600 hover:text-sky-700">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-sky-600 hover:text-sky-700">Privacy Policy</Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

            <p className="text-center text-sm text-slate-500 mt-6">
              14-day free trial • Cancel anytime
            </p>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
