import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield, Brain, Zap, Users, Star, ArrowRight,
  CheckCircle, Rocket, Lock, BarChart3, Kanban, Mail,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

const benefits = [
  {
    icon: Brain,
    title: 'AI-Powered Document Analysis',
    desc: 'Upload SOWs and get instant requirement extraction, risk identification, and compliance mapping.',
  },
  {
    icon: Kanban,
    title: 'Full Pipeline Visibility',
    desc: 'Track every project from intake to award with kanban boards, status tracking, and deadline alerts.',
  },
  {
    icon: Users,
    title: 'Subcontractor Intelligence',
    desc: 'Search 130,000+ subcontractors, send RFQs, and manage quotes — all in one platform.',
  },
  {
    icon: BarChart3,
    title: 'Cross-Project Analytics',
    desc: 'Win rate trends, competitor patterns, and pricing intelligence that gets smarter with every bid.',
  },
  {
    icon: Shield,
    title: 'Compliance Automation',
    desc: 'Auto-generated compliance matrices mapped to FAR/DFARS requirements. Never miss a clause.',
  },
  {
    icon: Zap,
    title: 'AI Agent Hub',
    desc: 'Autonomous agents that monitor opportunities, check compliance, and draft responses 24/7.',
  },
  {
    icon: Mail,
    title: 'Custom Email Domains',
    desc: 'Send RFQs and outreach from your own domain with your branding. Full DNS verification and deliverability tracking.',
  },
]

const foundingPerks = [
  { icon: Shield, text: 'Complimentary Enterprise-level access for the full 30-day program' },
  { icon: Lock, text: 'Priority access to new features before general release' },
  { icon: Users, text: 'Direct access to the product team for feedback and requests' },
  { icon: Rocket, text: 'Shape the roadmap — your input drives what we build next' },
  { icon: CheckCircle, text: '"Founding Partner" designation on your account — permanently' },
]

export default function BetaLandingPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_access',
          email: email.toLowerCase().trim(),
          name: name.trim(),
          company: company.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok || data.already_requested) {
        setSubmitted(true)
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6"
          >
            <Rocket className="h-4 w-4" />
            Founding Partner Program — Limited Seats
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
          >
            Join the Procuvex{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Private Beta
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10"
          >
            AI-powered procurement intelligence for government contractors.
            Analyze SOWs, manage subcontractors, and win more bids — all from one platform.
          </motion.p>

          {/* Waitlist Form */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-lg mx-auto"
          >
            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-white mb-2">You're on the list!</h3>
                <p className="text-slate-400">We'll send your invitation link shortly. Check your inbox.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Work email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Company name (optional)"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !email || !name}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Submitting...' : 'Request Beta Access'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
                {error && <p className="text-red-400 text-sm">{error}</p>}
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* What You Get */}
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
              Everything You Need to Win More Bids
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-xl mx-auto">
              Procuvex combines AI analysis, pipeline management, and subcontractor intelligence in one platform.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/30 transition-colors"
              >
                <b.icon className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Founding Partner Perks */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4"
            >
              <Star className="h-4 w-4" />
              Founding Partner Benefits
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              More Than Early Access
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400">
              Beta participants become Founding Partners with exclusive, permanent benefits.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="space-y-4"
          >
            {foundingPerks.map((p, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-start gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <p.icon className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed pt-2">{p.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Ready to Transform How You Win Bids?
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="text-slate-400 mb-8"
          >
            Seats are limited. Join the beta and start using AI to win more contracts.
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all inline-flex items-center gap-2"
            >
              Request Beta Access <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/demo"
              className="px-8 py-3 rounded-lg border border-white/10 hover:border-white/20 text-white font-semibold transition-all"
            >
              Watch Demo First
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
