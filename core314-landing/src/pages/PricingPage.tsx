import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, X, ArrowRight, Zap, BarChart3, FileText, Users } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { PRICING, formatPrice } from '../config/pricing';

// ============================================================================
// Core314 Operational Intelligence — Pricing Page
// All pricing values imported from shared/pricing.ts (single source of truth)
// ============================================================================

export default function PricingPage() {
  const plans = [
    {
      key: 'monitor' as const,
      popular: false,
      isEnterprise: false,
    },
    {
      key: 'intelligence' as const,
      popular: true,
      isEnterprise: false,
    },
    {
      key: 'commandCenter' as const,
      popular: false,
      isEnterprise: false,
    },
    {
      key: 'enterprise' as const,
      popular: false,
      isEnterprise: true,
    },
  ];

  const upcomingIntegrations = [
    { name: 'Salesforce', icon: '☁️' },
    { name: 'Microsoft Teams', icon: '💬' },
    { name: 'Jira', icon: '📋' },
    { name: 'Stripe', icon: '💳' },
    { name: 'Google Workspace', icon: '📧' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      {/* ============================================================ */}
      {/* SECTION 1 — HERO */}
      {/* ============================================================ */}
      <section className="pt-32 pb-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            AI Operational Intelligence for Growing Companies
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            Core314 connects your business systems, detects operational signals, and generates
            AI-powered Operational Briefs explaining what is happening inside your company.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/signup"
              className="px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-semibold text-lg"
            >
              Start 14-Day Operational Intelligence Trial
            </Link>
            <Link
              to="/contact?demo=true"
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-lg border border-slate-300 hover:border-sky-400 transition-all font-semibold text-lg"
            >
              Book Demo
            </Link>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-4 text-sm text-slate-500"
          >
            Trial begins after your first integration is connected.
          </motion.p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — PRICING TABLE */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => {
              const tier = PRICING[plan.key];
              const isPopular = plan.popular;
              const isEnterprise = plan.isEnterprise;
              const price = 'monthly' in tier ? formatPrice(tier.monthly) : 'Custom';

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15, duration: 0.6 }}
                  whileHover={{ y: -5 }}
                  className={`relative bg-white rounded-xl shadow-sm flex flex-col ${
                    isPopular
                      ? 'border-2 border-sky-500 shadow-lg lg:scale-105 lg:z-10'
                      : 'border border-slate-200'
                  } hover:border-sky-400 transition-all duration-300`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-sky-500 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                      Most Popular
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Plan Name & Tagline */}
                    <div className="text-center mb-6">
                      <h3
                        className="text-2xl font-bold mb-2 text-slate-900"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {tier.name}
                      </h3>
                      <p className="text-slate-500 text-sm mb-4 min-h-[40px]">
                        {tier.tagline}
                      </p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-slate-900">{price}</span>
                        {!isEnterprise && (
                          <span className="text-slate-500">/ month</span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                      {tier.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((feature, i) => {
                        const isHeader = feature.startsWith('Everything in');
                        return (
                          <li key={i} className={`flex items-start gap-3 ${isHeader ? 'mb-1' : ''}`}>
                            {isHeader ? (
                              <span className="text-sm font-semibold text-sky-600">{feature}</span>
                            ) : (
                              <>
                                <Check className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">{feature}</span>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA Button */}
                    <Link
                      to={isEnterprise ? '/contact?plan=enterprise' : `/signup?plan=${plan.key}`}
                      className={`block w-full py-3 rounded-lg font-semibold text-center transition-all ${
                        isPopular
                          ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md hover:shadow-lg'
                          : isEnterprise
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
                      }`}
                    >
                      {isEnterprise ? 'Contact Sales' : 'Start Trial'}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — UPCOMING INTEGRATIONS */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-4 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Upcoming Integrations
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto"
          >
            Core314 is expanding its operational intelligence platform with additional integrations.
          </motion.p>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {upcomingIntegrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-5 py-3 hover:border-sky-400 transition-colors"
              >
                <span className="text-2xl">{integration.icon}</span>
                <span className="font-medium text-slate-700">{integration.name}</span>
              </motion.div>
            ))}
          </div>

          <p className="text-sm text-slate-500">
            New integrations automatically enhance operational intelligence signals as they are released.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 — BEFORE VS AFTER */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            How Companies Operate Before and After Core314
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Without Core314 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white border border-slate-200 rounded-xl p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <X className="h-6 w-6 text-red-500" />
                Without Core314
              </h3>
              <ul className="space-y-4 mb-8">
                {[
                  'Sales pipeline issues discovered too late',
                  'Financial signals buried in accounting reports',
                  'Slack conversations hiding operational insight',
                  'Leaders manually reviewing multiple dashboards',
                  'Operational changes go unnoticed',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">&#x2022;</span>
                    <span className="text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-red-600">
                  Result: Leadership reacts to problems after they happen.
                </p>
              </div>
            </motion.div>

            {/* With Core314 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-sky-50 border-2 border-sky-200 rounded-xl p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Check className="h-6 w-6 text-sky-500" />
                With Core314
              </h3>
              <ul className="space-y-4 mb-8">
                {[
                  'Detect stalled deals before revenue drops',
                  'Identify financial anomalies early',
                  'Monitor cross-team operational signals',
                  'Automatically generate Operational Briefs',
                  'Leadership receives clear recommendations',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-sky-200 pt-4">
                <p className="text-sm font-semibold text-sky-700">
                  Result: Leadership understands what is happening before problems escalate.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — VALUE EXPLANATION */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            What Core314 Actually Does
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: <Zap className="h-8 w-8 text-sky-500" />,
                title: 'Detect Operational Signals',
                description:
                  'Core314 monitors events across your business systems and detects operational changes.',
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-sky-500" />,
                title: 'Analyze Business Activity',
                description:
                  'The platform identifies patterns across sales, financial activity, and team communication.',
              },
              {
                icon: <FileText className="h-8 w-8 text-sky-500" />,
                title: 'Generate AI Operational Briefs',
                description:
                  'Core314 automatically generates operational briefings explaining what is happening.',
              },
              {
                icon: <Users className="h-8 w-8 text-sky-500" />,
                title: 'Help Leadership Act Faster',
                description:
                  'Leadership receives actionable insight instead of manually analyzing dashboards.',
              },
            ].map((block, index) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-xl p-8 hover:border-sky-400 transition-colors"
              >
                <div className="mb-4">{block.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{block.title}</h3>
                <p className="text-slate-600">{block.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — ROI */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-12 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Why Companies Use Core314
          </motion.h2>

          <div className="space-y-4">
            {[
              'Detect stalled deals before revenue drops',
              'Identify operational bottlenecks early',
              'Monitor financial health automatically',
              'Understand operational patterns across systems',
              'Reduce time spent analyzing dashboards',
            ].map((bullet, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-6 py-4 text-left hover:border-sky-400 transition-colors"
              >
                <ArrowRight className="h-5 w-5 text-sky-500 flex-shrink-0" />
                <span className="text-slate-700 font-medium">{bullet}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 7 — FINAL CTA */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-8 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Install Core314 and See What Your Business Is Telling You
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <Link
              to="/signup"
              className="px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-semibold text-lg"
            >
              Start Trial
            </Link>
            <Link
              to="/contact?demo=true"
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-lg border border-slate-300 hover:border-sky-400 transition-all font-semibold text-lg"
            >
              Book Demo
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500"
          >
            <span>No per-user pricing.</span>
            <span className="hidden sm:inline">&#x2022;</span>
            <span>No long-term contracts.</span>
            <span className="hidden sm:inline">&#x2022;</span>
            <span>Cancel anytime.</span>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
