import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, CheckCircle, Brain, Shield, Kanban,
  BarChart3, Building2, HardHat, Monitor, ShoppingCart,
  FileText, Users, Zap, Play,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const proofMetrics = [
  { value: '11+', label: 'AI Modules' },
  { value: '5', label: 'Industries' },
  { value: 'Seconds', label: 'To Analyze Documents' },
  { value: '100%', label: 'Your Data, Your Control' },
]

const capabilities = [
  { icon: Brain, title: 'AI Document Analysis', desc: 'Upload SOWs and get requirements, risks, and compliance items extracted in seconds.' },
  { icon: Shield, title: 'Auto Compliance Matrix', desc: 'One-click compliance matrices mapping every requirement to your response status.' },
  { icon: Users, title: 'Subcontractor Matching', desc: 'Database of 170K+ verified subs with radius-based matching to your project site.' },
  { icon: Kanban, title: 'Pipeline Management', desc: 'Track every bid across workflow stages with real-time visibility and deadlines.' },
  { icon: BarChart3, title: 'Cross-Project Analytics', desc: 'Win rates, trends, and intelligence that learns from your bid history.' },
  { icon: FileText, title: 'RFQ Composer', desc: 'Generate branded quote requests and send them directly to matched subcontractors.' },
]

const industries = [
  { icon: Building2, name: 'Government Contractors' },
  { icon: HardHat, name: 'Construction & Engineering' },
  { icon: Monitor, name: 'IT Services & Consulting' },
  { icon: ShoppingCart, name: 'Commercial Procurement' },
]

export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(true)

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    // Store referral code in localStorage with 60-day expiry
    const referralData = {
      code,
      timestamp: Date.now(),
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000,
    }
    localStorage.setItem('procuvex_referral', JSON.stringify(referralData))

    // Set cookie for server-side access
    const expires = new Date(referralData.expires).toUTCString()
    document.cookie = `procuvex_ref=${code}; expires=${expires}; path=/; SameSite=Lax`

    // Validate the referral code and get partner name
    fetch(`/.netlify/functions/partner-program?action=track&code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setPartnerName(data.partner_name || null)
          setValid(true)
        } else {
          setValid(false)
        }
      })
      .catch(() => {
        // On error, still show the page — just without partner name
        setValid(true)
      })
      .finally(() => setLoading(false))
  }, [code, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // If the code is invalid, redirect to homepage
  if (!valid) {
    navigate('/', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {partnerName && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6"
            >
              <CheckCircle className="h-4 w-4" />
              Referred by {partnerName}
            </motion.div>
          )}

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
          >
            Win More Bids.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Waste Less Time.
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-4"
          >
            Procuvex is an AI-powered procurement platform that analyzes your bid documents,
            generates compliance matrices, and gives you intelligence across every project —
            so your team spends time winning, not searching.
          </motion.p>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-sm text-slate-500 mb-8"
          >
            Government. Construction. IT. Commercial. One platform for all procurement.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/create-account"
              className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all inline-flex items-center gap-2 text-lg"
            >
              Start Your 7-Day Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/demo"
              className="px-8 py-3.5 rounded-lg border border-white/10 hover:border-white/20 text-white font-semibold transition-all inline-flex items-center gap-2 justify-center text-lg"
            >
              <Play className="w-5 h-5" /> Watch Demo
            </Link>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-sm text-slate-500 mt-4"
          >
            7-day free trial &middot; No commitment &middot; Cancel anytime
          </motion.p>
        </div>
      </section>

      {/* Social Proof Metrics */}
      <section className="py-12 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {proofMetrics.map((m, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">{m.value}</div>
                <div className="text-sm text-slate-400 mt-1">{m.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-2xl md:text-3xl font-bold mb-10"
          >
            Built for How Your Industry Bids
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {industries.map((ind, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/30 transition-colors"
              >
                <ind.icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-white">{ind.name}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-bold mb-4">
              Everything You Need to Win
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-xl mx-auto">
              From document upload to contract award — Procuvex handles the entire procurement lifecycle with AI.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {capabilities.map((cap, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/30 transition-colors"
              >
                <cap.icon className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Executive Overview Video */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-bold mb-4">
              See Procuvex in Action
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-xl mx-auto">
              Watch a 5-minute overview of the platform and how it transforms procurement workflows.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl shadow-blue-500/10"
          >
            <video
              controls
              preload="metadata"
              className="w-full aspect-video"
            >
              <source src="/procuvex-executive-overview.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </div>
      </section>

      {/* Pricing Preview + CTA */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-bold mb-4">
              Start Your Free Trial Today
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-xl mx-auto mb-8">
              Try Procuvex free for 7 days. Plans start at $2,500/month for Growth teams
              and $5,000/month for Enterprise. No credit card required to start your trial.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                to="/create-account"
                className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all inline-flex items-center gap-2 text-lg"
              >
                Start 7-Day Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/pricing"
                className="px-8 py-3.5 rounded-lg border border-white/10 hover:border-white/20 text-white font-semibold transition-all inline-flex items-center gap-2 justify-center"
              >
                View Full Pricing
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-blue-400" /> Set up in minutes</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-blue-400" /> AES-256 encryption</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-blue-400" /> Cancel anytime</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
