import { motion, useInView } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, BadgeCheck, Zap, Shield, Globe, ArrowRight,
  CheckCircle, Building2, HardHat, Wrench, ChevronDown, ChevronUp,
  Star, TrendingUp, Send, Brain, FileCheck, Mail,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../../lib/supabase'
import { useNetworkStats } from '../hooks/useNetworkStats'

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

// --- Animated Counter ---
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, end, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// --- Stats Section ---
function LiveStats() {
  const stats = useNetworkStats()

  const metrics = [
    { value: stats.total, label: 'Subcontractors Listed', suffix: '+' },
    { value: stats.verified, label: 'Verified Profiles', suffix: '+' },
    { value: 50, label: 'States Covered', suffix: '' },
    { value: stats.tradeCategories, label: 'Trade Categories', suffix: '+' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
      {metrics.map((m, i) => (
        <motion.div key={i} variants={fadeUp} className="text-center">
          <div className="text-3xl md:text-4xl font-bold text-white">
            {stats.loading ? (
              <span className="inline-block w-24 h-8 bg-white/10 rounded animate-pulse" />
            ) : (
              <AnimatedCounter end={m.value} suffix={m.suffix} />
            )}
          </div>
          <div className="text-sm text-blue-200 mt-1">{m.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// --- Lookup Tool ---
function LookupTool() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)

    const { data } = await supabase
      .from('master_subcontractors')
      .select('id, company_name, city, state, trade_categories, verification_status, claim_token')
      .ilike('company_name', `%${query.trim()}%`)
      .limit(5)

    setResults(data || [])
    setLoading(false)
  }

  function handleClaim(sub: any) {
    if (sub.claim_token) {
      navigate(`/claim/${sub.claim_token}`)
    } else {
      // Generate a claim flow for unclaimed profiles
      navigate(`/claim-lookup/${sub.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter your company name..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-lg outline-none transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searched && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">We found you! Select your company to claim your profile:</p>
              {results.map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all">
                  <div>
                    <p className="font-semibold text-gray-900">{sub.company_name}</p>
                    <p className="text-sm text-gray-500">
                      {sub.city}, {sub.state}
                      {sub.trade_categories?.[0] && ` • ${sub.trade_categories[0]}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {sub.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                    {sub.verification_status === 'claimed' ? (
                      <span className="text-sm text-gray-400">Already claimed</span>
                    ) : (
                      <button
                        onClick={() => handleClaim(sub)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Claim Profile →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-600 mb-2">We don't have <strong>"{query}"</strong> in our network yet.</p>
              <p className="text-sm text-gray-500 mb-4">No worries — you can create your profile now and start getting found by prime contractors.</p>
              <button
                onClick={() => navigate('/create-sub-profile')}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
              >
                Create Your Profile →
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// --- Trade Grid ---
const topTrades = [
  { name: 'Electrical', icon: Zap },
  { name: 'HVAC / Mechanical', icon: Wrench },
  { name: 'General Construction', icon: Building2 },
  { name: 'Roofing', icon: HardHat },
  { name: 'IT / Cybersecurity', icon: Shield },
  { name: 'Janitorial / Facilities', icon: Star },
  { name: 'Engineering Services', icon: TrendingUp },
  { name: 'Landscaping / Grounds', icon: Globe },
]

// --- FAQ ---
const faqs = [
  {
    q: 'Is it free to be listed?',
    a: 'Yes — claiming your existing profile or creating a new one is completely free. You get a searchable profile visible to prime contractors at no cost.',
  },
  {
    q: 'What does "Verified" mean?',
    a: 'Verified subcontractors have confirmed their identity and business credentials. They receive a verified badge, priority search placement, automatic opportunity matching, and certification expiration alerts.',
  },
  {
    q: 'Who can see my profile?',
    a: 'Your profile is visible to registered prime contractors searching for subcontractors on the Procuvex platform. Your contact information is only shared with primes actively looking to team.',
  },
  {
    q: 'How do I update my information?',
    a: 'Once you claim your profile, you have full edit access to update your company description, trade categories, geographic coverage, certifications, and contact information at any time.',
  },
  {
    q: 'What are the benefits of being verified?',
    a: 'Verified subcontractors get priority placement in search results, a trust badge on their profile, automatic matching to relevant RFQ opportunities, and alerts before certifications expire.',
  },
  {
    q: 'How does auto-matching work?',
    a: 'Our system continuously monitors new opportunities and matches them to verified subcontractors based on trade categories, geographic coverage, certifications, and past performance. You get notified automatically.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="font-semibold text-gray-900 text-lg">{q}</span>
        {open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>
      {open && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pb-5 text-gray-600 leading-relaxed"
        >
          {a}
        </motion.p>
      )}
    </div>
  )
}

// --- Contact Form ---
function ContactForm() {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
        <p className="text-gray-600">We'll get back to you within 24 hours.</p>
      </div>
    )
  }

  return (
    <form
      name="subcontractor-inquiry"
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form) as any).toString(),
        }).then(() => setSubmitted(true)).catch(() => setSubmitted(true))
      }}
      className="space-y-4 max-w-lg mx-auto"
    >
      <input type="hidden" name="form-name" value="subcontractor-inquiry" />
      <p className="hidden"><input name="bot-field" /></p>
      <div className="grid grid-cols-2 gap-4">
        <input
          name="name"
          type="text"
          required
          placeholder="Your Name"
          className="px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
        />
        <input
          name="company"
          type="text"
          required
          placeholder="Company Name"
          className="px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
        />
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email Address"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
      />
      <textarea
        name="message"
        rows={4}
        required
        placeholder="How can we help?"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
      />
      <button
        type="submit"
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
      >
        <Send size={18} />
        Send Message
      </button>
    </form>
  )
}

// --- Main Page ---
export default function ForSubcontractorsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 pt-28 pb-20">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-40 right-40 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Network grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-blue-200 mb-6">
              <BadgeCheck size={16} className="text-green-400" />
              The trusted subcontractor network for government contracting
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Get Found. Get Verified.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Get Hired.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-xl text-blue-200 max-w-2xl mx-auto mb-12">
              Join thousands of subcontractors already being matched with prime contractors for government teaming opportunities.
            </motion.p>

            {/* Live Rolling Stats */}
            <motion.div variants={fadeUp}>
              <LiveStats />
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12">
              <a
                href="#lookup"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-900 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl"
              >
                Check If You're Already Listed
                <ArrowRight size={20} />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* What Is This Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Your Gateway to Government Contracts
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 max-w-3xl mx-auto">
              Procuvex maintains a comprehensive verified subcontractor network for government contracting. Prime contractors use this network to find qualified, certified subcontractors for teaming opportunities, task orders, and RFQs.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8"
          >
            {[
              {
                icon: Search,
                title: 'Get Discovered',
                desc: 'Prime contractors search by trade, location, and certification. Your profile puts you in front of decision-makers actively looking to team.',
                color: 'blue',
              },
              {
                icon: BadgeCheck,
                title: 'Build Trust',
                desc: 'Verified subcontractors earn a trust badge that signals credibility. Primes prefer verified partners when building their teams.',
                color: 'green',
              },
              {
                icon: Zap,
                title: 'Get Matched Automatically',
                desc: 'Our system matches your capabilities to open opportunities and sends them directly to you. No more hunting for RFQs.',
                color: 'purple',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all group"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 ${
                  card.color === 'blue' ? 'bg-blue-100' : card.color === 'green' ? 'bg-green-100' : 'bg-purple-100'
                }`}>
                  <card.icon size={28} className={
                    card.color === 'blue' ? 'text-blue-600' : card.color === 'green' ? 'text-green-600' : 'text-purple-600'
                  } />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
                <p className="text-gray-600 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* AI Quote Compliance — Sub Benefit */}
      <section className="py-20 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-purple-200 mb-6">
              <Brain size={16} className="text-purple-300" />
              AI-Powered Quality Assurance
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Submit Once. Know Exactly Where You Stand.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-purple-200 max-w-3xl mx-auto leading-relaxed">
              Every quote you submit through Procuvex is automatically reviewed by AI against the Statement of Work. If anything is missing, you'll know exactly what — no guessing, no surprises.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {[
              {
                icon: FileCheck,
                title: 'Instant Compliance Check',
                desc: 'AI scans your quote against every SOW requirement in seconds. You get a compliance score (0–100%) showing exactly how well your quote covers the scope.',
                color: 'from-blue-500 to-indigo-500',
              },
              {
                icon: Mail,
                title: 'Specific Gap Feedback',
                desc: 'If your quote misses any requirements, you receive a detailed email listing exactly what\'s missing — specific SOW items, pricing gaps, and clear recommendations.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: CheckCircle,
                title: 'Revise & Win',
                desc: 'Fix the gaps, resubmit through the portal, and your revised quote is re-analyzed automatically. Better quotes mean faster awards and more wins.',
                color: 'from-green-500 to-emerald-500',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:bg-white/15 transition-all"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <card.icon size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{card.title}</h3>
                <p className="text-purple-200 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl">
              <Brain size={20} className="text-purple-300" />
              <span className="text-sm text-purple-100">
                <strong className="text-white">No more guessing.</strong> Our AI tells you exactly what primes need — so you can deliver it.
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Lookup Tool */}
      <section id="lookup" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Are You Already In Our Network?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 max-w-2xl mx-auto">
              Search below to see if your company is already listed. If so, claim your profile to take control. If not, create one in minutes.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <LookupTool />
          </motion.div>
        </div>
      </section>

      {/* Why Get Verified */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Free Profile vs. Verified Profile
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every subcontractor gets a free listing. Verified subcontractors unlock premium visibility and automatic opportunity matching.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="max-w-4xl mx-auto"
          >
            <div className="grid md:grid-cols-2 gap-8">
              {/* Free */}
              <div className="bg-white rounded-2xl p-8 border border-gray-200">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Free Profile</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">$0</p>
                  <p className="text-sm text-gray-500">Forever free</p>
                </div>
                <ul className="space-y-3">
                  {[
                    'Listed in subcontractor database',
                    'Basic company information',
                    'Searchable by prime contractors',
                    'Trade category listing',
                    'Edit your profile anytime',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle size={18} className="text-gray-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Verified */}
              <div className="bg-white rounded-2xl p-8 border-2 border-blue-500 relative shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full">
                  RECOMMENDED
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Verified Profile</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">$99<span className="text-lg text-gray-500">/year</span></p>
                  <p className="text-sm text-orange-600 font-medium">Introductory pricing — limited time</p>
                </div>
                <ul className="space-y-3">
                  {[
                    'Everything in Free, plus:',
                    'Verified badge on your profile',
                    'Priority placement in search results',
                    'Automatic RFQ opportunity matching',
                    'Certification expiration alerts',
                    'Enhanced profile visibility',
                    'Direct prime contractor connections',
                  ].map((item, i) => (
                    <li key={i} className={`flex items-center gap-3 ${i === 0 ? 'text-gray-500 text-sm' : 'text-gray-700 font-medium'}`}>
                      {i === 0 ? null : <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />}
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 text-center">
                  <a
                    href="#lookup"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all"
                  >
                    Get Verified <ArrowRight size={16} />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {[
              { step: '1', title: 'Check Your Listing', desc: 'Search to see if your company is already in our network. Many qualified subcontractors are already listed.' },
              { step: '2', title: 'Claim or Create Your Profile', desc: 'Take ownership of your listing. Add your trades, certifications, geographic coverage, and capabilities.' },
              { step: '3', title: 'Get Matched With Primes', desc: 'Prime contractors find you through search. Verified subs are automatically matched to relevant opportunities.' },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Trades We Cover */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trades We Cover
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600">
              From construction to IT, we connect primes with subs across every government contracting trade.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {topTrades.map((trade, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <trade.icon size={20} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800">{trade.name}</span>
              </motion.div>
            ))}
          </motion.div>
          <p className="text-center text-gray-500 text-sm mt-6">And 200+ more specializations</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </motion.h2>
          </motion.div>

          <div className="divide-y divide-gray-200 border-t border-gray-200">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Have Questions?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600">
              We'll get back to you within 24 hours.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <ContactForm />
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
