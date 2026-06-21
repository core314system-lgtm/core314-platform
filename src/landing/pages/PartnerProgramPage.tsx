import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  DollarSign, BarChart3, ArrowRight, CheckCircle,
  TrendingUp, Shield, Clock, Repeat, LogIn,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

const earningsExamples = [
  { referrals: 1, plan: 'Enterprise', monthly: '$5,000', commission: '$1,000/mo', annual: '$12,000' },
  { referrals: 3, plan: 'Enterprise', monthly: '$15,000', commission: '$3,000/mo', annual: '$36,000' },
  { referrals: 6, plan: 'Enterprise', monthly: '$30,000', commission: '$6,000/mo', annual: '$72,000' },
  { referrals: 10, plan: 'Enterprise', monthly: '$50,000', commission: '$10,000/mo', annual: '$120,000' },
]

const programFeatures = [
  {
    icon: DollarSign,
    title: '20% Recurring Commission',
    desc: 'Earn 20% of every subscription payment from customers you refer — not just the first month.',
  },
  {
    icon: Repeat,
    title: '12-Month Commission Window',
    desc: 'Commissions are paid for up to 12 months per referred subscriber, as long as their subscription remains active.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Dashboard',
    desc: 'Track your sign-ups, active subscribers, monthly commissions, and payout history in real time.',
  },
  {
    icon: Clock,
    title: 'Monthly Payouts, Net 30',
    desc: 'Commissions are calculated monthly and paid within 30 days. $100 minimum payout threshold.',
  },
  {
    icon: Shield,
    title: 'Non-Exclusive',
    desc: 'Promote other products alongside Procuvex. No exclusivity requirements.',
  },
  {
    icon: TrendingUp,
    title: 'Commission on Upgrades',
    desc: 'If a referred customer upgrades their plan, your commission adjusts to 20% of the new amount.',
  },
]

const howItWorks = [
  { step: '1', title: 'Apply', desc: 'Submit your application below. We review applications within 48 hours.' },
  { step: '2', title: 'Get Approved', desc: 'Once approved, you receive your unique referral link and access to your partner dashboard.' },
  { step: '3', title: 'Share & Earn', desc: 'Share your link with your audience. When someone subscribes through your link, you start earning.' },
  { step: '4', title: 'Get Paid', desc: 'Track your earnings in real time and receive monthly payouts via PayPal or ACH.' },
]

const keyTerms = [
  { label: 'Commission Rate', value: '20% recurring' },
  { label: 'Commission Duration', value: '12 months per subscriber' },
  { label: 'Attribution Window', value: '60 days from click' },
  { label: 'Commission Starts', value: 'After first paid invoice (not during trial)' },
  { label: 'Payout Frequency', value: 'Monthly, net 30' },
  { label: 'Minimum Payout', value: '$100' },
  { label: 'Payout Methods', value: 'PayPal, ACH, wire transfer' },
  { label: 'Self-Referral', value: 'Not permitted' },
  { label: 'Plan Changes', value: 'Commission adjusts with upgrades/downgrades' },
  { label: 'Cancellation', value: 'Commission stops when subscriber cancels' },
  { label: 'Refund Clawback', value: '30-day window' },
  { label: 'Exclusivity', value: 'Non-exclusive — promote other products too' },
]

export default function PartnerProgramPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [audienceSize, setAudienceSize] = useState('')
  const [promotionMethod, setPromotionMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/partner-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          name: name.trim(),
          email: email.toLowerCase().trim(),
          company: company.trim() || null,
          audience_size: audienceSize.trim() || null,
          promotion_method: promotionMethod.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
      } else if (data.error === 'already_applied') {
        setError('An application with this email already exists. If you need help, contact team@procuvex.com.')
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6"
          >
            <DollarSign className="h-4 w-4" />
            Partner Program
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
          >
            Earn{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
              20% Recurring Commission
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-6"
          >
            Refer government contractors to Procuvex and earn 20% of every subscription payment for 12 months.
            Enterprise plans start at $5,000/month — that's $1,000/month per referral.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="#apply"
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all inline-flex items-center gap-2"
            >
              Apply Now <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/partners/login"
              className="px-8 py-3 rounded-lg border border-white/10 hover:border-white/20 text-white font-semibold transition-all inline-flex items-center gap-2 justify-center"
            >
              <LogIn className="w-4 h-4" /> Partner Login
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Earnings Potential */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Earnings Potential
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-xl mx-auto">
              See how much you can earn based on the number of Enterprise customers you refer.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="overflow-x-auto"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-4 text-sm font-semibold text-slate-400">Referrals</th>
                  <th className="pb-4 text-sm font-semibold text-slate-400">Plan</th>
                  <th className="pb-4 text-sm font-semibold text-slate-400">Monthly Revenue</th>
                  <th className="pb-4 text-sm font-semibold text-slate-400">Your 20%</th>
                  <th className="pb-4 text-sm font-semibold text-slate-400">12-Month Earnings</th>
                </tr>
              </thead>
              <tbody>
                {earningsExamples.map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-4 text-white font-semibold">{row.referrals} customer{row.referrals > 1 ? 's' : ''}</td>
                    <td className="py-4 text-slate-300">{row.plan}</td>
                    <td className="py-4 text-slate-300">{row.monthly}</td>
                    <td className="py-4 text-purple-400 font-semibold">{row.commission}</td>
                    <td className="py-4 text-green-400 font-bold text-lg">{row.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-4 gap-6"
          >
            {howItWorks.map((step, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-400 font-bold text-lg">{step.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Program Features */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Program Details
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {programFeatures.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-purple-500/30 transition-colors"
              >
                <f.icon className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Key Terms */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Commission Terms at a Glance
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400">
              Full transparency — here are the key terms of the program.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
          >
            {keyTerms.map((term, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className={`flex items-center justify-between px-6 py-4 ${i < keyTerms.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <span className="text-slate-400 text-sm">{term.label}</span>
                <span className="text-white font-medium text-sm">{term.value}</span>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-6">
            <Link to="/partners/terms" className="text-purple-400 text-sm hover:text-purple-300 transition-colors">
              Read full Partner Program Terms & Conditions →
            </Link>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-20 px-4 border-t border-white/5">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Apply to Become a Partner
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400">
              Applications are reviewed within 48 hours.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-white mb-2">Application Submitted!</h3>
                <p className="text-slate-400">We'll review your application and get back to you within 48 hours at {email}.</p>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Company / Channel Name</label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Your company, YouTube channel, blog, etc."
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Audience Size (approximate)</label>
                  <input
                    type="text"
                    value={audienceSize}
                    onChange={e => setAudienceSize(e.target.value)}
                    placeholder="e.g., 5,000 LinkedIn followers, 10K YouTube subscribers"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">How will you promote Procuvex?</label>
                  <textarea
                    value={promotionMethod}
                    onChange={e => setPromotionMethod(e.target.value)}
                    placeholder="e.g., LinkedIn posts, YouTube reviews, newsletter, podcast, blog articles..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <p className="text-xs text-slate-500 mb-4">
                    By applying, you agree to the{' '}
                    <Link to="/partners/terms" className="text-purple-400 hover:text-purple-300 underline">
                      Partner Program Terms & Conditions
                    </Link>.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || !email || !name}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                    {!submitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
