import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Shield, Target, Brain, Building2,
  Award, Globe, Zap, Users, Lock,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const values = [
  {
    icon: Target,
    title: 'Mission-Driven',
    desc: 'We exist to help contractors win more bids and deliver better outcomes. Every feature is designed around real procurement workflows, not theoretical use cases.',
  },
  {
    icon: Shield,
    title: 'Security First',
    desc: 'Government contractors handle sensitive information. Our architecture is built with row-level security, AES-256 encryption, and server-side AI processing from day one.',
  },
  {
    icon: Brain,
    title: 'AI With Purpose',
    desc: 'We use AI to eliminate tedious work — requirement extraction, compliance mapping, risk analysis — so your team can focus on strategy and relationships.',
  },
  {
    icon: Users,
    title: 'Built by Practitioners',
    desc: 'Our team has direct experience in government contracting, procurement operations, and bid management. We build tools we would use ourselves.',
  },
]

const milestones = [
  { year: '2024', title: 'Founded', desc: 'Core314 Technologies LLC established to modernize procurement operations with AI.' },
  { year: '2025', title: 'Platform Launch', desc: 'Procuvex platform launched with AI document analysis, compliance automation, and pipeline management.' },
  { year: '2025', title: 'SAM.gov Integration', desc: 'Direct integration with SAM.gov for opportunity discovery, match scoring, and subcontractor search.' },
  { year: '2026', title: 'Founding Partner Program', desc: 'Exclusive beta program for early adopters shaping the future of AI-powered procurement.' },
]

const capabilities = [
  'AI document analysis and requirement extraction',
  'Automated compliance matrix generation',
  'SAM.gov opportunity discovery with AI match scoring',
  'Subcontractor search, capture, and RFQ management',
  'Pricing risk analysis with market rate intelligence',
  'Pipeline management with kanban workflow',
  'Bid/No-Bid decision engine',
  'Post-award transition and debrief tracking',
  'Executive summary and export generation',
  'Multi-industry support (Government, Construction, IT, Commercial)',
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <Building2 className="w-3.5 h-3.5" />
              About Core314 Technologies
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              We&apos;re Building the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Future of Procurement
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Core314 Technologies LLC builds Procuvex — an AI-powered procurement operating system that helps 
              contractors find opportunities, analyze documents, build compliance matrices, manage subcontractors, 
              and win more bids.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-white">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-lg text-blue-100 leading-relaxed mb-6">
                The procurement industry runs on manual processes: spreadsheets for compliance tracking, 
                email chains for subcontractor coordination, and copy-paste workflows for every new bid. 
                We believe AI can eliminate the tedious work — freeing procurement teams to focus on 
                strategy, relationships, and winning.
              </p>
              <p className="text-blue-200">
                Procuvex is our answer: a purpose-built operating system for procurement that handles 
                document analysis, compliance automation, opportunity discovery, and pipeline intelligence 
                in a single platform.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              What We Stand For
            </motion.h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {values.map(v => (
                <motion.div key={v.title} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-600">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Our Journey
            </motion.h2>
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <motion.div key={i} variants={fadeUp} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-16 text-right">
                    <span className="text-sm font-bold text-blue-600">{m.year}</span>
                  </div>
                  <div className="flex-shrink-0 w-3 h-3 rounded-full bg-blue-600 mt-1.5" />
                  <div>
                    <h3 className="font-bold text-slate-900">{m.title}</h3>
                    <p className="text-sm text-slate-600">{m.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              Platform Capabilities
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-10 max-w-xl mx-auto">
              Everything your procurement team needs in a single platform.
            </motion.p>
            <div className="grid sm:grid-cols-2 gap-3">
              {capabilities.map(cap => (
                <motion.div key={cap} variants={fadeUp} className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-4 py-3">
                  <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{cap}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Security & Compliance
            </motion.h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Shield, label: 'SOC 2 Type II Architecture' },
                { icon: Lock, label: 'AES-256 Encryption' },
                { icon: Globe, label: 'ITAR / CUI Capable' },
                { icon: Award, label: 'FedRAMP: Not Currently Pursued' },
              ].map(badge => (
                <motion.div key={badge.label} variants={fadeUp} className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
                  <badge.icon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-700">{badge.label}</span>
                </motion.div>
              ))}
            </div>
            <motion.div variants={fadeUp} className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-3">Enterprise Security Posture</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Row-level security (RLS) ensures complete tenant isolation — no organization can access another&apos;s data</li>
                <li>• All AI processing occurs server-side — no API keys, document content, or analysis results are exposed to the browser</li>
                <li>• Data encrypted at rest (AES-256) and in transit (TLS 1.3)</li>
                <li>• Built on Supabase enterprise infrastructure with SOC 2 Type II compliance</li>
                <li>• Regular security audits and penetration testing</li>
                <li>• GDPR and CCPA compliant data handling practices</li>
                <li>• Data Processing Agreement (DPA) available for enterprise customers</li>
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Ready to Transform Your Procurement?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-lg mx-auto mb-8">
              Join procurement teams using Procuvex to find, analyze, and win more bids.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                Contact Our Team
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
