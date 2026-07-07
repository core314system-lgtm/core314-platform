import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Zap, MessageSquare, Lightbulb, Crown,
  ArrowRight, CheckCircle, Play, Lock, Target, Send,
  Shield, Star,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const benefits = [
  {
    icon: Target,
    title: 'Influence the Product Roadmap',
    desc: 'Your ideas help determine what gets built.',
  },
  {
    icon: Crown,
    title: 'Full Enterprise Access',
    desc: 'Receive full Enterprise access including CRM, task assignments, activity feeds, AI proposal drafting, Slack integration, and weekly digest — all features, no restrictions.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Access to Engineering',
    desc: 'Communicate directly with the people building Procuvex.',
  },
  {
    icon: Zap,
    title: 'Rapid Innovation',
    desc: 'Many customer-driven enhancements can move from concept to implementation in days instead of months.',
  },
  {
    icon: Lightbulb,
    title: 'Build the Platform You\'ve Always Wanted',
    desc: 'Recommend workflows, reports, automations, dashboards, integrations, and AI capabilities.',
  },
  {
    icon: Lock,
    title: 'Exclusive Founding Partner Status',
    desc: 'Become one of only 30 organizations helping shape Procuvex before launch.',
  },
]

const idealApplicants = [
  'Prime Contractors',
  'Federal Subcontractors',
  'Capture Managers',
  'Proposal Managers',
  'Business Development Leaders',
  'Contracts Managers',
  'Compliance Professionals',
  'Operations Managers',
  'Government Contract Consultants',
]

const govconRoles = [
  'Prime Contractor',
  'Subcontractor',
  'Capture Manager',
  'Proposal Manager',
  'Business Development',
  'Contracts Manager',
  'Compliance',
  'Operations',
  'Consultant',
  'Other',
]

const employeeRanges = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
]

export default function FoundingPartnersPage() {
  const navigate = useNavigate()
  const formRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    jobTitle: '',
    employees: '',
    govconRole: '',
    proposalVolume: '',
    biggestChallenge: '',
    whyFoundingPartner: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToVideo() {
    videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function updateForm(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.name || !form.company) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_access',
          email: form.email.toLowerCase().trim(),
          name: form.name.trim(),
          company: form.company.trim(),
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          job_title: form.jobTitle.trim() || null,
          employees: form.employees || null,
          govcon_role: form.govconRole || null,
          proposal_volume: form.proposalVolume.trim() || null,
          biggest_challenge: form.biggestChallenge.trim() || null,
          why_founding_partner: form.whyFoundingPartner.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok || data.already_requested) {
        navigate('/founding-partners/thank-you')
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-4 py-3.5 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
  const selectClass = "w-full px-4 py-3.5 rounded-lg bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm appearance-none"
  const textareaClass = "w-full px-4 py-3.5 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm resize-none"

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-8"
          >
            <Lock className="h-3.5 w-3.5" />
            Limited to 30 Organizations
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-[1.1] tracking-tight text-gray-900"
          >
            Help Shape the Future of{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Government Contracting Software
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            We're inviting only <strong className="text-gray-900">30 government contracting organizations</strong> to become Procuvex Founding Partners. Receive Enterprise access, work directly with our engineering team, and influence the evolution of a platform built specifically for the GovCon industry.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <button
              onClick={scrollToForm}
              className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 flex items-center gap-2"
            >
              Apply to Become a Founding Partner
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToVideo}
              className="px-8 py-4 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold text-base transition-all flex items-center gap-2 hover:bg-gray-50"
            >
              <Play className="w-4 h-4" />
              Watch the 5-Minute Overview
            </button>
          </motion.div>

          {/* Visual Indicators */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Limited to 30 Companies</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-blue-600" />
              <span>Enterprise Access Included</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Direct Engineering Collaboration</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why This Program Exists */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-8 text-center">
              Why This Program Exists
            </motion.h2>
            <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
              <motion.p variants={fadeUp}>
                Traditional enterprise software forces companies to adapt to its limitations.
              </motion.p>
              <motion.p variants={fadeUp} className="text-gray-500 italic pl-4 border-l-2 border-gray-200">
                Feature requests disappear into backlogs. Important workflows are ignored. Innovation slows.
              </motion.p>
              <motion.p variants={fadeUp}>
                <strong className="text-gray-900">Procuvex was built differently.</strong>
              </motion.p>
              <motion.p variants={fadeUp}>
                Before our public launch, we're inviting experienced government contractors to help shape the platform through real-world feedback and direct collaboration.
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-4 bg-slate-50" ref={videoRef}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Watch the 5-Minute Founding Partner Overview
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-600 mb-10 max-w-2xl mx-auto">
              Learn how the program works, what you'll receive, and how your feedback will directly influence Procuvex.
            </motion.p>
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden shadow-2xl shadow-black/10 border border-gray-200">
              <video
                controls
                preload="metadata"
                className="w-full aspect-video bg-black"
              >
                <source src="/procuvex-executive-overview.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              What Founding Partners Receive
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="bg-white border border-gray-100 rounded-2xl p-8 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                  <b.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Active Participation Reward */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8 text-center"
          >
            <Star className="w-8 h-8 text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">
              Founding Partners who actively participate throughout the 30-day program will receive <span className="text-blue-600">50% off their first month</span> of the Enterprise plan.
            </p>
            <p className="text-sm text-gray-500">
              Active participation includes using the platform, providing feedback, and completing the program evaluation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Who Should Apply */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Who Should Apply
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid sm:grid-cols-2 md:grid-cols-3 gap-4"
          >
            {idealApplicants.map((role, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors"
              >
                <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-gray-700 font-medium text-sm">{role}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What We Ask From You */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4 text-center">
              Your Experience Matters More Than Anything
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              We are not simply looking for testers. We want organizations that will:
            </motion.p>
            <motion.div variants={fadeUp} className="space-y-4">
              {[
                'Use Procuvex in real-world scenarios',
                'Recommend improvements',
                'Suggest new capabilities',
                'Report issues',
                'Improve workflows',
                'Help prioritize future development',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Our Commitment */}
      <section className="py-24 px-4 bg-gradient-to-b from-blue-600 to-indigo-700">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-6 text-white">
              Every Founding Partner Suggestion Receives a Response
            </motion.h2>
            <motion.p variants={fadeUp} className="text-blue-100 text-lg leading-relaxed mb-10">
              Every feature request will be reviewed. Each request will receive a response indicating whether it is:
            </motion.p>
            <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto mb-10">
              {['Planned', 'In Development', 'Already Available', 'Future Consideration'].map((status, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-blue-200 shrink-0" />
                  <span className="text-white font-medium text-sm">{status}</span>
                </div>
              ))}
            </motion.div>
            <motion.p variants={fadeUp} className="text-blue-200 text-base italic">
              We believe transparency builds better software.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Why Only 30 */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-6">
              Why We're Limiting Participation
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-600 text-lg leading-relaxed mb-10">
              Meaningful collaboration requires direct communication. By limiting the program to 30 organizations, every Founding Partner receives personal attention and the opportunity to influence the future direction of Procuvex.
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-600 text-lg mb-10">
              Once all positions are filled, applications will close.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold"
            >
              <Shield className="w-5 h-5" />
              Only 30 Organizations Will Be Selected
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-24 px-4 bg-slate-50" ref={formRef} id="apply">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Apply to Become a Founding Partner
              </h2>
              <p className="text-gray-600">
                Applications are reviewed individually. Selected organizations will be contacted directly.
              </p>
            </motion.div>

            <motion.form
              variants={fadeUp}
              onSubmit={handleSubmit}
              className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => updateForm('name', e.target.value)}
                    placeholder="John Smith"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company *</label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={e => updateForm('company', e.target.value)}
                    placeholder="Acme Federal Services"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => updateForm('email', e.target.value)}
                    placeholder="john@company.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => updateForm('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => updateForm('website', e.target.value)}
                    placeholder="https://company.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={e => updateForm('jobTitle', e.target.value)}
                    placeholder="VP of Business Development"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Employees</label>
                  <select
                    value={form.employees}
                    onChange={e => updateForm('employees', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select range</option>
                    {employeeRanges.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Primary GovCon Role</label>
                  <select
                    value={form.govconRole}
                    onChange={e => updateForm('govconRole', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select role</option>
                    {govconRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Approximate Annual Proposal Volume</label>
                <input
                  type="text"
                  value={form.proposalVolume}
                  onChange={e => updateForm('proposalVolume', e.target.value)}
                  placeholder="e.g., 20-30 proposals per year"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Biggest Challenge Your Team Faces</label>
                <textarea
                  rows={3}
                  value={form.biggestChallenge}
                  onChange={e => updateForm('biggestChallenge', e.target.value)}
                  placeholder="What's the biggest pain point in your current procurement workflow?"
                  className={textareaClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Why Do You Want to Become a Founding Partner?</label>
                <textarea
                  rows={3}
                  value={form.whyFoundingPartner}
                  onChange={e => updateForm('whyFoundingPartner', e.target.value)}
                  placeholder="What interests you about shaping the future of Procuvex?"
                  className={textareaClass}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !form.email || !form.name || !form.company}
                className="w-full py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit My Application
                  </>
                )}
              </button>
            </motion.form>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-gradient-to-b from-gray-900 to-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-6 text-white">
              Help Define the Next Generation of GovCon Software
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 text-lg mb-10">
              Join a select group of organizations helping shape Procuvex before public launch.
            </motion.p>
            <motion.div variants={fadeUp}>
              <button
                onClick={scrollToForm}
                className="px-10 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/30 inline-flex items-center gap-2"
              >
                Apply Today
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
            <motion.p variants={fadeUp} className="text-gray-500 text-sm mt-6">
              Applications remain open until all 30 Founding Partner positions have been filled.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
