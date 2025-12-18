import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { initSupabaseClient } from '../lib/supabase';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      // Initialize Supabase client at runtime (fetches config from Netlify Function)
      const supabase = await initSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setSubscription(profile);
        }
      }
    } catch (err) {
      console.error('Failed to check user:', err);
      // Page will show "Please Log In" state if user is null
    }
  };

  const openBillingPortal = async () => {
    if (!user) {
      setError('Please log in to manage your billing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open billing portal');
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      past_due: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
      incomplete: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm border ${statusColors[status] || statusColors.incomplete}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white flex flex-col">
      <Header />

      <div className="flex-1 pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
                Billing & Subscription
              </span>
            </h1>
            <p className="text-xl text-gray-300">
              Manage your subscription, payment methods, and billing history
            </p>
          </motion.div>

          {!user ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8 text-center"
            >
              <CreditCard className="w-16 h-16 text-[#00BFFF] mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4">Please Log In</h2>
              <p className="text-gray-300 mb-6">
                You need to be logged in to manage your billing and subscription.
              </p>
              <a
                href="/login"
                className="inline-block px-8 py-4 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all"
              >
                Log In
              </a>
            </motion.div>
          ) : (
            <>
              {subscription && subscription.stripe_customer_id && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8 mb-6"
                >
                  <h2 className="text-2xl font-semibold mb-6 text-[#66FCF1]">Current Subscription</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Plan</p>
                      <p className="text-lg font-semibold text-white">
                        {subscription.subscription_plan ? 
                          subscription.subscription_plan.charAt(0).toUpperCase() + subscription.subscription_plan.slice(1) 
                          : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Status</p>
                      <div className="mt-1">
                        {subscription.subscription_status ? 
                          getStatusBadge(subscription.subscription_status) 
                          : <span className="text-gray-500">N/A</span>}
                      </div>
                    </div>
                    
                    {subscription.trial_end && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Trial Ends</p>
                        <p className="text-lg font-semibold text-white">
                          {formatDate(subscription.trial_end)}
                        </p>
                      </div>
                    )}
                    
                    {subscription.current_period_end && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Next Billing Date</p>
                        <p className="text-lg font-semibold text-white">
                          {formatDate(subscription.current_period_end)}
                        </p>
                      </div>
                    )}
                  </div>

                  {subscription.subscription_status === 'trialing' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                      <p className="text-blue-400 text-sm">
                        🎉 You're currently on a free trial! You won't be charged until your trial ends.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8"
              >
                <h2 className="text-2xl font-semibold mb-4 text-[#66FCF1]">Manage Your Subscription</h2>
                <p className="text-gray-300 mb-6">
                  Access the Stripe Customer Portal to manage your subscription, update payment methods, view invoices, and more.
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                    {error}
                  </div>
                )}

                <button
                  onClick={openBillingPortal}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Opening Portal...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Open Billing Portal
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="mt-6 pt-6 border-t border-[#00BFFF]/20">
                  <h3 className="text-lg font-semibold mb-3 text-white">What you can do in the portal:</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-[#00BFFF] mt-1">•</span>
                      <span>Update your payment method</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00BFFF] mt-1">•</span>
                      <span>Upgrade or downgrade your plan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00BFFF] mt-1">•</span>
                      <span>Add or remove integrations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00BFFF] mt-1">•</span>
                      <span>View and download invoices</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00BFFF] mt-1">•</span>
                      <span>Cancel your subscription</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
