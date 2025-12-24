import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function PricingPage() {
  const [expandedAddons, setExpandedAddons] = useState(false);

  const plans = [
    {
      name: 'Starter',
      price: '$99',
      period: '/mo',
      description: 'Perfect for small teams getting started',
      features: [
        'Unified dashboards',
        '3 integrations included',
        'Basic AI recommendations',
        'Email support',
        '14-day free trial'
      ],
      cta: 'Start Free Trial',
      link: '/signup?plan=starter',
      popular: false
    },
    {
      name: 'Pro',
      price: '$999',
      period: '/mo',
      description: 'For growing businesses that need more power',
      features: [
        '10 integrations included',
        'Proactive Optimization Engine™',
        'Real-time KPI alerts',
        'Advanced analytics',
        'Priority support',
        '14-day free trial'
      ],
      cta: 'Start Free Trial',
      link: '/signup?plan=pro',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations with complex needs',
      features: [
        'Unlimited integrations',
        'Admin Analytics dashboard',
        'Full API access',
        'On-premise deployment option',
        'Dedicated account manager',
        'Custom SLA'
      ],
      cta: 'Contact Sales',
      link: '/contact?plan=enterprise',
      popular: false
    }
  ];

  const addons = [
    {
      category: 'Integrations',
      items: [
        { name: 'Additional Integration (Starter)', price: '$75/mo each', description: 'Connect more business apps on Starter plan' },
        { name: 'Additional Integration (Pro)', price: '$50/mo each', description: 'Connect more business apps on Pro plan' },
        { name: 'Custom Integration', price: '$500 setup', description: 'Build a custom connector' }
      ]
    },
    {
      category: 'Analytics',
      items: [
        { name: 'Premium Analytics', price: '$199/mo', description: 'Advanced reporting and insights' },
        { name: 'Data Export', price: '$99/mo', description: 'Export all your data anytime' }
      ]
    },
    {
      category: 'AI Modules',
      items: [
        { name: 'Advanced Fusion AI', price: '$299/mo', description: 'Enhanced AI capabilities' },
        { name: 'Predictive Analytics', price: '$399/mo', description: 'Forecast future trends' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold mb-6"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] via-[#66FCF1] to-[#00BFFF] bg-clip-text text-transparent">
              Choose Your Core
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto"
          >
            Start with a 14-day free trial. Cancel anytime.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className={`relative bg-gradient-to-br from-[#001a33] to-[#0A0F1A] rounded-xl p-8 ${
                  plan.popular 
                    ? 'border-2 border-[#00BFFF] shadow-[0_0_40px_rgba(0,191,255,0.3)]' 
                    : 'border border-[#00BFFF]/30'
                } hover:border-[#00BFFF] transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2 text-[#66FCF1]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {plan.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#00BFFF] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.link}
                  className={`block w-full py-3 rounded-lg font-semibold text-center transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-[#00BFFF] to-[#007BFF] hover:shadow-[0_0_30px_rgba(0,191,255,0.6)]'
                      : 'bg-[#00BFFF]/20 hover:bg-[#00BFFF]/30 border border-[#00BFFF]'
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
      <section className="py-20 px-4 bg-gradient-to-b from-[#0A0F1A] to-[#001a33]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
                Customize Your Core
              </span>
            </h2>
            <p className="text-xl text-gray-300">Expand your capabilities with powerful add-ons</p>
          </motion.div>

          <button
            onClick={() => setExpandedAddons(!expandedAddons)}
            className="w-full max-w-2xl mx-auto mb-8 px-6 py-4 bg-[#001a33] border border-[#00BFFF]/30 rounded-lg hover:border-[#00BFFF] transition-all flex items-center justify-between"
          >
            <span className="text-lg font-semibold">View Available Add-ons</span>
            <ChevronDown className={`h-6 w-6 transition-transform ${expandedAddons ? 'rotate-180' : ''}`} />
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
                  className="bg-[#001a33] border border-[#00BFFF]/30 rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold mb-4 text-[#66FCF1]">{category.category}</h3>
                  <div className="space-y-4">
                    {category.items.map((item, i) => (
                      <div key={i} className="border-t border-[#00BFFF]/20 pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-[#00BFFF] text-sm">{item.price}</span>
                        </div>
                        <p className="text-sm text-gray-400">{item.description}</p>
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
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-12"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              Frequently Asked Questions
            </span>
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
                a: 'Absolutely! You can add integrations starting at $75/month each on the Starter plan or $50/month each on the Pro plan. For more than 8 integrations, upgrading to Pro provides the best long-term value.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#001a33] border border-[#00BFFF]/30 rounded-lg p-6 hover:border-[#00BFFF] transition-all"
              >
                <h3 className="text-lg font-semibold mb-2 text-[#66FCF1]">{faq.q}</h3>
                <p className="text-gray-300">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
