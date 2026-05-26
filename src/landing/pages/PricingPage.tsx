import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle, X, ChevronDown, Sparkles } from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const tiers = [
  {
    name: 'Growth',
    price: '$2,500',
    annual_price: '$2,000',
    desc: 'For procurement teams managing multiple concurrent bids across government and commercial markets.',
    features: [
      'Up to 25 active projects',
      'Up to 10 user seats',
      'AI document analysis (unlimited)',
      'Subcontractor database (up to 500)',
      'Automated RFQ with follow-ups',
      'Gap analysis & coverage tracking',
      'Pricing Decision Matrix with AI markup',
      'Bid/No-Bid Decision Engine',
      'Compliance auto-verification',
      'Market rate intelligence',
      'SAM.gov integration',
      'Pipeline & workflow engine',
      'Analytics dashboard',
      'Data export (CSV/JSON)',
      'Chat support with AI assistant',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$5,000',
    annual_price: '$4,000',
    desc: 'For large primes, JV partners, and multi-office firms managing complex portfolios.',
    features: [
      'Unlimited active projects',
      'Unlimited user seats',
      'Everything in Growth, plus:',
      'Post-award transition tracking',
      'Teaming & JV management',
      'Resource capacity tracking',
      'Subcontractor relationship intelligence',
      'Vendor performance scoring & tiers',
      'Custom quote form builder',
      'REST API access',
      'Custom workflow stages',
      'Intelligence library',
      'Dedicated onboarding',
      'Priority support with SLA',
      '99.9% uptime guarantee',
    ],
  },
]

const comparison = [
  { name: 'Active Projects', growth: 'Up to 25', ent: 'Unlimited' },
  { name: 'User Seats', growth: 'Up to 10', ent: 'Unlimited' },
  { name: 'AI Document Analysis', growth: true, ent: true },
  { name: 'Subcontractor Database', growth: '500', ent: 'Unlimited' },
  { name: 'Automated RFQ & Follow-Ups', growth: true, ent: true },
  { name: 'Gap Analysis & Coverage', growth: true, ent: true },
  { name: 'Pricing Decision Matrix', growth: true, ent: true },
  { name: 'AI Markup Suggestions', growth: true, ent: true },
  { name: 'Bid/No-Bid Decision Engine', growth: true, ent: true },
  { name: 'Compliance Auto-Verification', growth: true, ent: true },
  { name: 'Market Rate Intelligence', growth: true, ent: true },
  { name: 'SAM.gov Integration', growth: true, ent: true },
  { name: 'Pipeline & Workflow', growth: true, ent: true },
  { name: 'Analytics Dashboard', growth: true, ent: true },
  { name: 'Data Export', growth: true, ent: true },
  { name: 'Post-Award Transition', growth: false, ent: true },
  { name: 'Teaming & JV Management', growth: false, ent: true },
  { name: 'Resource Capacity Tracking', growth: false, ent: true },
  { name: 'Relationship Intelligence', growth: false, ent: true },
  { name: 'Custom Quote Forms', growth: false, ent: true },
  { name: 'REST API Access', growth: false, ent: true },
  { name: 'Custom Workflows', growth: false, ent: true },
  { name: 'Dedicated Onboarding', growth: false, ent: true },
  { name: '99.9% Uptime SLA', growth: false, ent: true },
]

const faqs = [
  { q: 'Is there a free trial?', a: 'Yes. Every plan includes a 7-day free trial with full access to all features. A credit card is required to start your trial, but you will not be charged until the trial ends. Cancel anytime during the trial at no cost.' },
  { q: 'Can I switch plans later?', a: 'Absolutely. You can upgrade from Growth to Enterprise at any time. Changes take effect immediately with prorated billing.' },
  { q: 'Is there a contract or commitment?', a: 'No long-term contracts required. Pay monthly or save 20% with annual billing. Cancel anytime — your subscription remains active until the end of your billing period.' },
  { q: 'What payment methods do you accept?', a: 'All major credit cards via Stripe. Enterprise customers can also pay by invoice or ACH transfer.' },
  { q: 'How is data protected?', a: 'All data is encrypted at rest and in transit. Row-level security ensures complete tenant isolation — your data is never visible to other organizations. We maintain a comprehensive security posture document available upon request.' },
  { q: 'Can I export my data?', a: 'Yes. Full data portability is guaranteed. Export your entire account — projects, subcontractors, documents, quotes, and analytics — in CSV or JSON format at any time.' },
  { q: 'What support is included?', a: 'All plans include our AI-powered support assistant that can answer platform and account-specific questions 24/7. If the AI cannot resolve your issue, it escalates to a human specialist with callback scheduling.' },
  { q: 'Do you support government contractors specifically?', a: 'Yes. Procuvex is built for government procurement from the ground up — SAM.gov integration, compliance matrices, set-aside tracking, NAICS code matching, and wage determination handling are all native to the platform.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-5 pr-8"><p className="text-sm text-slate-600 leading-relaxed">{a}</p></div>}
    </div>
  )
}

function CellValue({ val }: { val: boolean | string }) {
  if (typeof val === 'string') return <span className="text-sm font-medium text-slate-900">{val}</span>
  if (val) return <CheckCircle className="h-5 w-5 text-blue-500 mx-auto" />
  return <X className="h-5 w-5 text-slate-300 mx-auto" />
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Pricing</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Invest in <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Winning More</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              One platform to manage your entire procurement lifecycle — from opportunity identification to contract execution. 7-day free trial on all plans.
            </motion.p>
          </div>

          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <span className={`text-sm font-medium ${!annual ? 'text-slate-900' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${annual ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-slate-900' : 'text-slate-500'}`}>
              Annual <span className="text-green-600 font-bold">(Save 20%)</span>
            </span>
          </div>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tiers.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`relative bg-white rounded-2xl p-8 ${
                  tier.popular ? 'border-2 border-blue-600 shadow-xl shadow-blue-600/10' : 'border border-slate-200 shadow-sm'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-1">{tier.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{tier.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{annual ? tier.annual_price : tier.price}</span>
                  <span className="text-slate-500 text-sm">/month{annual ? ' (billed annually)' : ''}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/login?from=pricing&plan=${tier.name.toLowerCase()}&billing=${annual ? 'annual' : 'monthly'}`}
                  className={`block w-full py-3.5 text-center rounded-xl font-semibold text-sm transition-colors ${
                    tier.popular
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/25'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  Start 7-Day Free Trial
                </Link>
                <p className="text-xs text-slate-400 text-center mt-3">Credit card required — cancel anytime during trial</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10" style={{ fontFamily: 'Poppins, sans-serif' }}>Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 pr-4 text-sm font-semibold text-slate-900 w-1/2">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-blue-600">Growth</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-slate-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 text-sm text-slate-700">{row.name}</td>
                    <td className="py-3 px-4 text-center bg-blue-50/30"><CellValue val={row.growth} /></td>
                    <td className="py-3 px-4 text-center"><CellValue val={row.ent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10" style={{ fontFamily: 'Poppins, sans-serif' }}>Frequently Asked Questions</h2>
          <div className="divide-y divide-slate-200">
            {faqs.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
