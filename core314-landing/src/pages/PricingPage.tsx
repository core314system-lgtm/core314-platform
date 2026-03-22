import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Minus, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { PRICING, formatPrice } from '../config/pricing';

// ============================================================================
// Supabase Edge Function config — uses build-time env vars with hardcoded fallback
// The Supabase URL and anon key are public (client-side safe)
// ============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const CHECKOUT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/stripe-create-checkout`;

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const plans = [
  {
    id: 'intelligence' as const,
    stripePlan: 'intelligence' as const,
    highlight: false,
  },
  {
    id: 'commandCenter' as const,
    stripePlan: 'command_center' as const,
    highlight: true,
  },
  {
    id: 'enterprise' as const,
    stripePlan: null,
    highlight: false,
  },
];

const comparisonFeatures = [
  { label: 'Slack Integration', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'HubSpot Integration', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'QuickBooks Integration', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'Google Calendar Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Gmail Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Jira Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Trello Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Microsoft Teams Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Google Sheets Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Asana Integration', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Operational Health Score', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'Signals Dashboard', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'AI Operational Briefs', intelligence: '30 per month', commandCenter: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Operational Pattern Detection', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'Operational Brief Archive', intelligence: true, commandCenter: true, enterprise: true },
  { label: 'Command Center Dashboard', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Advanced Signal Analysis', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Integration Event History', intelligence: false, commandCenter: true, enterprise: true },
  { label: 'Custom Integrations', intelligence: false, commandCenter: false, enterprise: true },
  { label: 'Dedicated Onboarding', intelligence: false, commandCenter: false, enterprise: true },
  { label: 'Executive Operational Reporting', intelligence: false, commandCenter: false, enterprise: true },
  { label: 'Priority Signal Processing', intelligence: false, commandCenter: false, enterprise: true },
  { label: 'SLA Uptime Guarantees', intelligence: false, commandCenter: false, enterprise: true },
  { label: 'Users', intelligence: 'Up to 5', commandCenter: 'Up to 25', enterprise: 'Unlimited' },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: 'intelligence' | 'command_center') => {
    console.log('[Core314] Starting checkout for plan:', plan);
    console.log('[Core314] Edge Function URL:', CHECKOUT_FUNCTION_URL);
    setLoading(plan);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      // Include anon key if available (required by Supabase Edge Function gateway)
      if (SUPABASE_ANON_KEY) {
        headers['apikey'] = SUPABASE_ANON_KEY;
      }

      const response = await fetch(CHECKOUT_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Checkout failed (${response.status})`;
        console.error('[Core314] Checkout API error:', errorMsg, errorData);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('[Core314] Checkout session created, redirecting to:', data.url);

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('[Core314] Checkout error:', error);
      alert('Checkout failed. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">Pricing</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Simple, Transparent Pricing
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Choose the plan that matches your operational intelligence needs. All plans include HubSpot, Slack, and QuickBooks integrations.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="pb-20 lg:pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const data = PRICING[plan.id];
              const isEnterprise = 'custom' in data;
              return (
                <motion.div
                  key={plan.id}
                  variants={fadeUp}
                  className={`rounded-xl p-6 border ${plan.highlight ? 'border-sky-300 bg-slate-50 ring-1 ring-sky-200 shadow-lg' : 'border-slate-200 bg-white'}`}
                >
                  {plan.highlight && (
                    <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-3">Most Popular</div>
                  )}
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{data.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{data.tagline}</p>
                  <div className="mb-6">
                    {isEnterprise ? (
                      <div className="text-2xl font-extrabold text-slate-900">Custom</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-slate-900">{'monthly' in data ? formatPrice(data.monthly) : ''}</span>
                        <span className="text-sm text-slate-500">/mo</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {data.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  {isEnterprise ? (
                    <Link to="/contact" className="block w-full py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-center transition-colors">
                      Contact Sales
                    </Link>
                  ) : (
                    <button
                      onClick={() => plan.stripePlan && handleCheckout(plan.stripePlan)}
                      disabled={loading === plan.stripePlan}
                      className={`block w-full ${plan.highlight ? 'py-3 text-base' : 'py-2.5 text-sm'} font-semibold rounded-lg text-center transition-colors cursor-pointer disabled:opacity-50 ${plan.highlight ? 'text-white bg-slate-900 hover:bg-slate-800' : 'text-slate-700 bg-white border border-slate-300 hover:border-slate-400'}`}
                    >
                      {loading === plan.stripePlan ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecting...
                        </span>
                      ) : (
                        'Start Free Trial'
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Compare Plans</h2>
          </motion.div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 w-2/5">Feature</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Intelligence</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-sky-600">Command Center</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feat, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3 px-4 text-sm text-slate-700">{feat.label}</td>
                    {(['intelligence', 'commandCenter', 'enterprise'] as const).map((plan) => {
                      const val = feat[plan];
                      return (
                        <td key={plan} className="text-center py-3 px-4">
                          {val === true ? (
                            <CheckCircle className="h-4 w-4 text-sky-500 mx-auto" />
                          ) : val === false ? (
                            <Minus className="h-4 w-4 text-slate-300 mx-auto" />
                          ) : (
                            <span className="text-sm text-slate-600">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to Get Started?
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Connect your tools and receive your first Operational Brief. Trial starts after your first integration is connected.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              Contact Sales
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
