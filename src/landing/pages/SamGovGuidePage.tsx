import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Shield, Globe,
  Search, FileText, BookOpen, Clock,
  Zap, ExternalLink, Database,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const registrationSteps = [
  {
    step: 1,
    title: 'Get a DUNS Number (now UEI)',
    desc: 'As of April 2022, SAM.gov automatically assigns a Unique Entity Identifier (UEI) during registration. The old DUNS number system from Dun & Bradstreet has been replaced.',
    time: 'Instant during SAM registration',
    tips: ['UEI is assigned automatically — no separate application needed', 'Keep your UEI handy; you\'ll need it for every contract action'],
  },
  {
    step: 2,
    title: 'Create a Login.gov Account',
    desc: 'SAM.gov uses Login.gov for authentication. Create an account at Login.gov first, then use it to access SAM.gov.',
    time: '5-10 minutes',
    tips: ['Use your business email, not personal', 'Set up multi-factor authentication — it\'s required'],
  },
  {
    step: 3,
    title: 'Register Your Entity on SAM.gov',
    desc: 'This is the big one. You\'ll provide business information, NAICS codes, points of contact, banking details for payment, and representations & certifications.',
    time: '1-3 hours to complete, 7-10 business days to process',
    tips: [
      'Have your EIN (tax ID), bank account info, and CAGE code ready',
      'Select ALL applicable NAICS codes — this determines which opportunities you see',
      'Complete the Representations & Certifications section carefully — incorrect answers can disqualify you',
      'Your registration must be renewed ANNUALLY or it becomes inactive',
    ],
  },
  {
    step: 4,
    title: 'Set Up Contract Opportunity Searches',
    desc: 'Once registered, configure saved searches to receive email notifications when new opportunities matching your NAICS codes and preferences are posted.',
    time: '15-30 minutes',
    tips: [
      'Save multiple searches for different NAICS codes',
      'Set filters for set-aside type, agency, and location',
      'Enable daily email digest to never miss a deadline',
    ],
  },
]

const subSearchTips = [
  {
    title: 'Search by NAICS Code',
    desc: 'Find subcontractors in your specific industry. Use 2-digit codes for broad searches (54 = Professional Services) or 6-digit for precise (541512 = Computer Systems Design).',
    icon: Search,
  },
  {
    title: 'Filter by Socioeconomic Status',
    desc: 'Find teaming partners with specific certifications: 8(a), HUBZone, SDVOSB, WOSB, Minority-Owned. This is critical for set-aside compliance and mentor-protégé arrangements.',
    icon: Shield,
  },
  {
    title: 'Search by Location',
    desc: 'Many contracts require local presence or "place of performance" requirements. Search by state, city, or zip code to find subs in the required area.',
    icon: Globe,
  },
  {
    title: 'Check Capabilities & Past Performance',
    desc: 'Review each entity\'s profile for listed capabilities, bonding limits, and contract history. Cross-reference with FPDS.gov for verified federal contract awards.',
    icon: FileText,
  },
  {
    title: 'Verify Active Registration',
    desc: 'Subcontractors must have active SAM.gov registration to work on federal contracts. Always verify their registration status before including them in your proposal.',
    icon: CheckCircle,
  },
  {
    title: 'Export & Track Results',
    desc: 'SAM.gov allows exporting search results. Build a database of qualified subs organized by trade, certification, and past performance for fast teaming on future bids.',
    icon: Database,
  },
]

const commonQuestions = [
  {
    q: 'Is SAM.gov registration free?',
    a: 'Yes, SAM.gov registration is completely free. Beware of third-party services that charge hundreds of dollars to "register you on SAM.gov" — they\'re doing something you can do yourself for free.',
  },
  {
    q: 'How long does registration take?',
    a: 'The application itself takes 1-3 hours to complete. Processing takes 7-10 business days. International entities may take longer. Don\'t wait until you find an opportunity — register proactively.',
  },
  {
    q: 'Do I need to renew my registration?',
    a: 'Yes, annually. If your registration expires, you cannot receive new contract awards and existing contract payments may be held. Set a calendar reminder 30 days before expiration.',
  },
  {
    q: 'Can I search for opportunities without registering?',
    a: 'Yes, you can search and view opportunities on SAM.gov without registering. But you must be registered to actually submit proposals and receive awards.',
  },
  {
    q: 'What NAICS codes should I select?',
    a: 'Select every NAICS code that legitimately describes your business capabilities. More codes = more opportunities in your searches. But don\'t add codes for services you can\'t actually perform.',
  },
  {
    q: 'How do I find subcontractors on SAM.gov?',
    a: 'Use the Entity Registration search (not Contract Opportunities). Search by NAICS code, location, socioeconomic status, and keywords. The entity profiles show capabilities and certifications.',
  },
]

export default function SamGovGuidePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Resource Guide
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              SAM.gov Registration &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Subcontractor Search
              </span>{' '}
              Guide
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              SAM.gov is the gateway to $760 billion in federal contracts. This guide covers everything from 
              registration to finding the right teaming partners for your next bid.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://sam.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Go to SAM.gov
              </a>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all"
              >
                Search with Procuvex Instead
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Registration Steps */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              SAM.gov Registration: Step by Step
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
              Get registered and start competing for federal contracts.
            </motion.p>

            <div className="space-y-6">
              {registrationSteps.map(s => (
                <motion.div key={s.step} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {s.time}
                        </span>
                      </div>
                      <p className="text-slate-600 mb-4">{s.desc}</p>
                      <ul className="space-y-2">
                        {s.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Subcontractor Search */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              Finding Subcontractors on SAM.gov
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-10 max-w-xl mx-auto">
              Build your teaming network by searching SAM.gov's entity database of 300,000+ registered contractors.
            </motion.p>

            <div className="grid sm:grid-cols-2 gap-4">
              {subSearchTips.map(tip => (
                <motion.div key={tip.title} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <tip.icon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">{tip.title}</h4>
                      <p className="text-sm text-slate-600">{tip.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Frequently Asked Questions
            </motion.h2>

            <div className="space-y-4">
              {commonQuestions.map((faq, i) => (
                <motion.div key={i} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="font-semibold text-slate-900 text-sm mb-2">{faq.q}</h4>
                  <p className="text-sm text-slate-600">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Procuvex CTA */}
      <section className="py-16 bg-gradient-to-b from-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
              <Zap className="w-3.5 h-3.5" />
              Beyond SAM.gov
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Procuvex Supercharges Your SAM.gov Workflow
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-xl mx-auto mb-8">
              Procuvex pulls opportunities directly from SAM.gov, scores them against your capabilities, 
              captures subcontractor data automatically, and imports everything into your bid pipeline — no 
              manual copy-pasting from SAM.gov ever again.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/guides/government-proposals"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                <FileText className="w-4 h-4" />
                Government Proposal Guide
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
