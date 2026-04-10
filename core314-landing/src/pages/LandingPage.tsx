import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  BarChart3,
  FileText,
  Zap,
  Target,
  AlertTriangle,
  TrendingDown,
  Search,
  CheckCircle,
  Loader2,
  MessageSquare,
  DollarSign,
  Briefcase,
  Calendar,
  Mail,
  Layout,
  Sheet,
  Users as UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { SampleBrief } from '../components/SampleBrief';
import { PRICING, formatPrice } from '../config/pricing';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ===== SECTION 2 DATA: WHAT YOU GET ===== */
const whatYouGet = [
  {
    icon: Activity,
    title: 'Detected Signals',
    desc: 'Core314 monitors your connected systems and surfaces the signals that indicate risk, opportunity, or operational drift \u2014 before you notice them manually.',
  },
  {
    icon: BarChart3,
    title: 'Cross-System Correlation',
    desc: 'Signals from different tools are analyzed together. A stalled deal in HubSpot combined with overdue invoices in QuickBooks tells a story no single tool can.',
  },
  {
    icon: TrendingDown,
    title: 'Business Impact',
    desc: 'Every signal is tied to a real business outcome \u2014 revenue at risk, cash flow exposure, delivery delays \u2014 so you know exactly what is at stake.',
  },
  {
    icon: Search,
    title: 'Root Cause Analysis',
    desc: 'Core314 identifies the underlying cause behind connected signals, not just the symptoms. Understand why problems are occurring across your operations.',
  },
  {
    icon: Zap,
    title: 'Recommended Actions',
    desc: 'Each brief includes specific actions: who should do what, by when. Clear accountability tied directly to the intelligence uncovered.',
  },
];

/* ===== SECTION 3 DATA: HOW IT WORKS ===== */
const howItWorksSteps = [
  {
    step: '01',
    title: 'Connect',
    desc: 'Link up to 3 or 10 integrations via secure OAuth \u2014 HubSpot, Slack, QuickBooks, Google Calendar, and more. No migration required.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Detect',
    desc: 'Core314 continuously monitors your connected systems and identifies operational patterns, risks, and anomalies across every data source.',
    icon: Activity,
  },
  {
    step: '03',
    title: 'Brief',
    desc: 'An AI-generated narrative explains what is happening, why it matters, and what the business impact is \u2014 in plain language, not charts.',
    icon: FileText,
  },
  {
    step: '04',
    title: 'Act',
    desc: 'Clear recommended actions with accountability \u2014 who should do what, by when. Turn intelligence into decisions immediately.',
    icon: Zap,
  },
];

/* ===== SECTION 6 DATA: INTEGRATIONS ===== */
const integrations = [
  { name: 'Slack', icon: MessageSquare },
  { name: 'HubSpot', icon: Briefcase },
  { name: 'QuickBooks', icon: DollarSign },
  { name: 'Google Calendar', icon: Calendar },
  { name: 'Gmail', icon: Mail },
  { name: 'Trello', icon: Layout },
  { name: 'Microsoft Teams', icon: UsersIcon },
  { name: 'Google Sheets', icon: Sheet },
];

/* ===== SECTION 5 DATA: PRICING PLANS ===== */
const pricingPlans = [
  {
    id: 'intelligence' as const,
    highlight: false,
    integrations: 'Up to 3 integrations',
    features: [
      'Up to 3 integrations',
      'Basic signal detection',
      'Limited visibility',
      'Operational Health Score',
      '30 AI Operational Briefs per month',
      '1 User',
    ],
  },
  {
    id: 'commandCenter' as const,
    highlight: true,
    integrations: 'Up to 10 integrations',
    features: [
      'Up to 10 integrations',
      'Full operational intelligence',
      'Cross-system correlation',
      'Root cause analysis',
      'Forecast projections',
      'Unlimited AI Operational Briefs',
      'Team-level visibility',
      'Up to 5 Users',
    ],
  },
  {
    id: 'enterprise' as const,
    highlight: false,
    integrations: 'Custom integrations',
    features: [
      'Everything in Command Center',
      'Custom integrations',
      'Dedicated onboarding',
      'Executive operational reporting',
      'Priority signal processing',
      'SLA uptime guarantees',
    ],
  },
];

export default function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  const handleCheckout = async (planId: string) => {
    const planMap: Record<string, string> = {
      intelligence: 'intelligence',
      commandCenter: 'command_center',
    };
    const plan = planMap[planId];
    if (!plan) return;

    setLoading(planId);
    setCheckoutError('');

    try {
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start checkout');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* ================================================================
          SECTION 1 \u2014 HERO
          ================================================================ */}
      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-medium mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Operational Intelligence Platform
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-6"
              >
                Know what&apos;s breaking in your business{' '}
                <span className="text-sky-600">before it costs you.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-slate-600 leading-relaxed mb-8"
              >
                Core314 analyzes your systems and delivers an AI-generated operational brief
                explaining what&apos;s happening, why it&apos;s happening, and what to do next.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-8"
              >
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Generate Your First Brief
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#sample-brief"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
                >
                  View Example Brief
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Connects With Your Systems
                </p>
                <div className="flex items-center gap-6 sm:gap-8">
                  <img src="/logos/slack.svg" alt="Slack" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <img src="/logos/quickbooks.svg" alt="QuickBooks" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <img src="/logos/hubspot.svg" alt="HubSpot" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <span className="text-sm font-medium text-slate-400 border-l border-slate-200 pl-6">+ 5 More</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Mini brief visual */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block"
            >
              <SampleBrief compact />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 \u2014 WHAT YOU GET
          ================================================================ */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Not dashboards. Decisions.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Every brief delivers structured intelligence \u2014 from detection to action \u2014 so you
              can make informed decisions, not review more data.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            {whatYouGet.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-sky-200 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-base font-bold mb-2 text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3 \u2014 HOW IT WORKS
          ================================================================ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              How Core314 Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Four steps from connection to clarity. No disruption to your existing workflows.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {howItWorksSteps.map((item, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="relative">
                <div className="bg-white border border-slate-200 rounded-xl p-6 h-full hover:border-sky-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sky-500/20 text-4xl font-extrabold mb-3">{item.step}</div>
                  <item.icon className="h-6 w-6 text-sky-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2 text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-slate-300 z-10">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4 \u2014 SAMPLE OPERATIONAL BRIEF (PRIMARY CONVERSION ASSET)
          ================================================================ */}
      <section id="sample-brief" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <p className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">
              See What You Get
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              A Real Operational Brief
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Not a dashboard. Not a chart. A clear, written explanation of what is happening
              inside your business \u2014 generated by AI from real operational data.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <SampleBrief />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-10"
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Generate Your First Brief
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 \u2014 PRICING
          ================================================================ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Choose the plan that matches your operational intelligence needs.
            </p>
          </motion.div>

          {checkoutError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center text-sm max-w-xl mx-auto">
              {checkoutError}
            </div>
          )}

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {pricingPlans.map((plan) => {
              const data = PRICING[plan.id];
              const isEnterprise = 'custom' in data;
              return (
                <motion.div
                  key={plan.id}
                  variants={fadeUp}
                  className={`rounded-xl p-6 border relative ${
                    plan.highlight
                      ? 'border-sky-300 bg-sky-50/50 ring-2 ring-sky-200 shadow-lg'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{data.name}</h3>
                  <p className="text-sm text-slate-500 mb-1">{data.tagline}</p>
                  <p className="text-xs text-sky-600 font-medium mb-4">{plan.integrations}</p>
                  <div className="mb-6">
                    {isEnterprise ? (
                      <div className="text-2xl font-extrabold text-slate-900">Custom</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {'monthly' in data ? formatPrice(data.monthly) : ''}
                        </span>
                        <span className="text-sm text-slate-500">/mo</span>
                      </div>
                    )}
                  </div>

                  {plan.highlight && (
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed italic">
                      For companies that need full visibility across operations \u2014 not partial insights.
                    </p>
                  )}

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {isEnterprise ? (
                    <Link
                      to="/contact"
                      className="block w-full py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-center transition-colors"
                    >
                      Contact Sales
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={loading === plan.id}
                      className={`block w-full ${
                        plan.highlight ? 'py-3 text-base' : 'py-2.5 text-sm'
                      } font-semibold rounded-lg text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        plan.highlight
                          ? 'text-white bg-slate-900 hover:bg-slate-800'
                          : 'text-slate-700 bg-white border border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {loading === plan.id ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
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

      {/* ================================================================
          SECTION 6 \u2014 INTEGRATIONS
          ================================================================ */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Connects Across Your Business Systems
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Connect up to 10 integrations. Core314 integrates with the platforms your team
              already uses \u2014 no migration, no disruption.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto"
          >
            {integrations.map((integration, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-xl p-5 text-center hover:border-sky-200 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-sky-50 rounded-lg w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <integration.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{integration.name}</h3>
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Available
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <Link
              to="/integrations"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors"
            >
              Request an Integration
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 7 \u2014 POSITIONING
          ================================================================ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <AlertTriangle className="h-10 w-10 text-sky-500 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Built for operators who need clarity \u2014 not more dashboards.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
              Your business already has the data. Core314 tells you what it means.
              Connect your tools and receive your first Operational Brief.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-10">
              {[
                { label: 'Replaces manual operational reviews', icon: FileText },
                { label: 'Detects cross-system patterns no single tool can see', icon: BarChart3 },
                { label: 'Delivers written intelligence \u2014 not dashboards', icon: Activity },
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <item.icon className="h-6 w-6 text-sky-500" />
                  <p className="text-sm text-slate-700 font-medium text-center leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 8 \u2014 FINAL CTA
          ================================================================ */}
      <section className="py-20 lg:py-28 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-white"
          >
            See What Your Business Is Telling You
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto"
          >
            Connect your tools and receive your first Operational Brief.
            No dashboards to build. No reports to configure. Just clarity.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
            >
              Generate Your First Brief
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-300 border border-slate-600 hover:border-slate-400 rounded-lg transition-colors"
            >
              View Pricing
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
