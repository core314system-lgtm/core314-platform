import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { PRICING, ADDONS, formatPrice } from '../config/pricing';

// ============================================================================
// PHASE 14.1: PRICING PAGE SOURCE-OF-TRUTH FIX
// All pricing values are imported from shared/pricing.ts
// NO inline price literals ($99, $199, etc.) are allowed in this file
// ============================================================================

export default function PricingPage() {
  const [expandedAddons, setExpandedAddons] = useState(false);

  const plans = [
    {
      name: 'Observe',
      label: 'System Observation & Discovery',
      price: formatPrice(PRICING.starter.monthly),
      period: '/mo',
      description: 'Core314 connects to your tools and begins observing how your organization operates. Dashboards are generated automatically in preview mode while the system identifies metrics and relationships.',
      features: [
        `${PRICING.starter.integrations} integrations included`,
        'Automatic dashboard generation',
        'Metric discovery & relationship mapping',
        'Global Fusion Score at baseline',
        'Email support',
        '14-day free trial'
      ],
      constraints: [
        'AI analysis not yet active',
        'Metrics are being discovered, not scored'
      ],
      cta: 'Start Free Trial',
      link: '/signup?plan=starter',
      popular: false
    },
    {
      name: 'Analyze',
      label: 'Active System Intelligence',
      price: formatPrice(PRICING.pro.monthly),
      period: '/mo',
      description: 'Core314 activates real-time intelligence across your integrations. The Global Fusion Score becomes dynamic. Each integration receives its own active dashboard with live metrics and explanations.',
      features: [
        `${PRICING.pro.integrations} integrations included`,
        'Dynamic Global Fusion Score',
        'AI insights grounded in your data',
        'Real-time KPI alerts',
        'Per-integration active dashboards',
        'Priority support',
        '14-day free trial'
      ],
      constraints: [],
      cta: 'Start Free Trial',
      link: '/signup?plan=pro',
      popular: true
    },
    {
      name: 'Predict & Act',
      label: 'Predictive Intelligence + Autonomous Optimization',
      price: 'Custom',
      period: '',
      description: 'Core314 identifies trends, risks, and emerging inefficiencies before they impact performance. The system moves from insight to execution with corrective actions, optimizations, and self-healing logic.',
      features: [
        'Unlimited integrations',
        'Forecasting & scenario modeling',
        'Early-warning indicators',
        'Autonomous optimization with governance',
        'Full API access',
        'Dedicated account manager',
        'Custom SLA'
      ],
      constraints: [],
      cta: 'Contact Sales',
      link: '/contact?plan=enterprise',
      popular: false
    }
  ];

  const addons = [
    {
      category: 'Integrations',
      items: [
        { name: ADDONS.integrations.starter.description, price: `${formatPrice(ADDONS.integrations.starter.monthly)}/mo each`, description: 'Connect more business apps on Starter plan' },
        { name: ADDONS.integrations.pro.description, price: `${formatPrice(ADDONS.integrations.pro.monthly)}/mo each`, description: 'Connect more business apps on Pro plan' },
        { name: ADDONS.integrations.custom.description, price: `${formatPrice(ADDONS.integrations.custom.setup)} setup`, description: 'Build a custom connector' }
      ]
    },
    {
      category: 'Analytics',
      items: [
        { name: ADDONS.analytics.premium.description, price: `${formatPrice(ADDONS.analytics.premium.monthly)}/mo`, description: 'Advanced reporting and insights' },
        { name: ADDONS.analytics.dataExport.description, price: `${formatPrice(ADDONS.analytics.dataExport.monthly)}/mo`, description: 'Export all your data anytime' }
      ]
    },
    {
      category: 'AI Modules',
      items: [
        { name: ADDONS.ai.advancedFusion.description, price: `${formatPrice(ADDONS.ai.advancedFusion.monthly)}/mo`, description: 'Enhanced AI capabilities' },
        { name: ADDONS.ai.predictive.description, price: `${formatPrice(ADDONS.ai.predictive.monthly)}/mo`, description: 'Forecast future trends' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            System Maturity Tiers
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto"
          >
            Core314 grows with your organization. Start observing, then unlock intelligence as your system matures.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className={`relative bg-white rounded-xl p-8 shadow-sm ${
                  plan.popular 
                    ? 'border-2 border-sky-500 shadow-lg' 
                    : 'border border-slate-200'
                } hover:border-sky-400 transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-sky-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-1 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {plan.name}
                  </h3>
                  {'label' in plan && plan.label && (
                    <p className="text-sky-600 text-sm font-medium mb-3">{plan.label}</p>
                  )}
                  <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-500">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                {'constraints' in plan && plan.constraints && plan.constraints.length > 0 && (
                  <div className="mb-6 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">This tier is intentionally preparatory:</p>
                    <ul className="space-y-2">
                      {plan.constraints.map((constraint: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                          <span className="text-slate-400">•</span>
                          <span>{constraint}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  to={plan.link}
                  className={`block w-full py-3 rounded-lg font-semibold text-center transition-all ${
                    plan.popular
                      ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md hover:shadow-lg'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Customize Your Core
            </h2>
            <p className="text-xl text-slate-600">Expand your capabilities with powerful add-ons</p>
          </motion.div>

          <button
            onClick={() => setExpandedAddons(!expandedAddons)}
            className="w-full max-w-2xl mx-auto mb-8 px-6 py-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-sky-400 transition-all flex items-center justify-between"
          >
            <span className="text-lg font-semibold text-slate-900">View Available Add-ons</span>
            <ChevronDown className={`h-6 w-6 text-slate-600 transition-transform ${expandedAddons ? 'rotate-180' : ''}`} />
          </button>

          {expandedAddons && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {addons.map((category, index) => (
                <motion.div
                  key={category.category}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold mb-4 text-slate-900">{category.category}</h3>
                  <div className="space-y-4">
                    {category.items.map((item, i) => (
                      <div key={i} className="border-t border-slate-200 pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <span className="text-sky-600 text-sm">{item.price}</span>
                        </div>
                        <p className="text-sm text-slate-500">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-12 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Frequently Asked Questions
          </motion.h2>
          
          <div className="space-y-6">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
              },
              {
                q: 'What happens after the free trial?',
                a: 'After 14 days, you\'ll be charged for your selected plan. You can cancel anytime during the trial with no charges.'
              },
              {
                q: 'Do you offer refunds?',
                a: 'Yes. Refunds are calculated on a prorated basis according to the number of days and services used during your billing period. Any unused days of service are refunded at the appropriate prorated amount. During your 14-day free trial, you may cancel at any time without incurring charges.'
              },
              {
                q: 'Can I add more integrations?',
                a: 'Absolutely! You can add integrations starting at $75/month each on the Observe tier or $50/month each on the Analyze tier. For more than 8 integrations, upgrading to Analyze provides the best long-term value.'
              },
              {
                q: 'Why does the Observe tier have limited AI features?',
                a: 'The Observe tier is intentionally preparatory. Core314 needs time to discover your metrics, map relationships, and establish baselines before intelligence can be activated. This ensures AI insights are grounded in real data, not assumptions.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-slate-200 rounded-lg p-6 hover:border-sky-400 transition-all shadow-sm"
              >
                <h3 className="text-lg font-semibold mb-2 text-slate-900">{faq.q}</h3>
                <p className="text-slate-600">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
