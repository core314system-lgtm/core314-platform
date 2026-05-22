import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const tiers = [
  {
    name: 'Starter',
    desc: 'For individual BD professionals managing a handful of bids.',
    features: ['Up to 10 projects', '1 user', 'AI document analysis', 'Compliance matrix', 'Executive summary', 'Email support'],
  },
  {
    name: 'Professional',
    desc: 'For teams managing multiple concurrent bids across projects.',
    features: ['Unlimited projects', 'Up to 10 users', 'All AI modules', 'Pipeline & workflow engine', 'SAM.gov integration', 'CSV/Excel import', 'Analytics dashboard', 'Priority support'],
    popular: true,
  },
  {
    name: 'Enterprise',
    desc: 'For large organizations with complex, multi-division procurement.',
    features: ['Unlimited everything', 'Unlimited users', 'REST API access', 'Custom workflow stages', 'Intelligence library', 'Dedicated onboarding', 'Custom integrations', 'SLA guarantee'],
  },
]

const comparison = [
  { name: 'Projects', starter: '10', pro: 'Unlimited', ent: 'Unlimited' },
  { name: 'Users', starter: '1', pro: 'Up to 10', ent: 'Unlimited' },
  { name: 'AI Document Analysis', starter: true, pro: true, ent: true },
  { name: 'Compliance Matrix', starter: true, pro: true, ent: true },
  { name: 'Executive Summary', starter: true, pro: true, ent: true },
  { name: 'RFQ Package Generator', starter: true, pro: true, ent: true },
  { name: 'Pricing & Risk Analysis', starter: true, pro: true, ent: true },
  { name: 'Pipeline & Workflow', starter: false, pro: true, ent: true },
  { name: 'Team Assignments', starter: false, pro: true, ent: true },
  { name: 'SAM.gov Integration', starter: false, pro: true, ent: true },
  { name: 'CSV/Excel Import', starter: false, pro: true, ent: true },
  { name: 'Analytics Dashboard', starter: false, pro: true, ent: true },
  { name: 'Smart Recommendations', starter: false, pro: true, ent: true },
  { name: 'REST API', starter: false, pro: false, ent: true },
  { name: 'Custom Workflows', starter: false, pro: false, ent: true },
  { name: 'Intelligence Library', starter: false, pro: false, ent: true },
  { name: 'Dedicated Onboarding', starter: false, pro: false, ent: true },
  { name: 'SLA Guarantee', starter: false, pro: false, ent: true },
]

const faqs = [
  { q: 'When will pricing be available?', a: 'We are finalizing tier pricing now. Join the waitlist or contact us for early access pricing and priority onboarding when we launch.' },
  { q: 'Will there be a free trial?', a: 'Yes. Every plan will include a free trial period so you can evaluate Procuvex with your own documents and workflows before committing.' },
  { q: 'Can I switch plans later?', a: 'Absolutely. You can upgrade or downgrade at any time. Changes take effect immediately with prorated billing.' },
  { q: 'Is there a contract or commitment?', a: 'No long-term contracts on Starter or Professional plans. Enterprise plans may include annual options with additional discounts.' },
  { q: 'What payment methods do you accept?', a: 'We will accept all major credit cards via Stripe. Enterprise customers can also pay by invoice.' },
  { q: 'Do all plans include AI features?', a: 'Yes. Every plan includes AI document analysis, compliance matrix generation, and executive summary. Advanced features like pipeline, analytics, and integrations are available on Professional and Enterprise.' },
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
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Pricing</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Plans That <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Scale With You</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Pricing details coming soon. Join the waitlist for early access and priority onboarding.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">Most Popular</div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-1">{tier.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{tier.desc}</p>
                <div className="text-3xl font-extrabold text-slate-900 mb-6">Coming Soon</div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact"
                  className={`block w-full py-3 text-center rounded-xl font-semibold text-sm transition-colors ${
                    tier.popular
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Join Waitlist
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10" style={{ fontFamily: 'Poppins, sans-serif' }}>Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 pr-4 text-sm font-semibold text-slate-900 w-1/3">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-slate-900">Starter</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-blue-600">Professional</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-slate-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 text-sm text-slate-700">{row.name}</td>
                    <td className="py-3 px-4 text-center"><CellValue val={row.starter} /></td>
                    <td className="py-3 px-4 text-center bg-blue-50/30"><CellValue val={row.pro} /></td>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10" style={{ fontFamily: 'Poppins, sans-serif' }}>Pricing FAQ</h2>
          <div className="divide-y divide-slate-200">
            {faqs.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
