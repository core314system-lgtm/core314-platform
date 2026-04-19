import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Shield,
  CheckCircle,
  Zap,
  Target,
  FileText,
  ChevronRight,
  Lock,
  Eye,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  SlackLogo,
  HubSpotLogo,
  QuickBooksLogo,
  JiraLogo,
  SalesforceLogo,
  TeamsLogo,
} from '../components/IntegrationLogos';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const mainSteps = [
  {
    num: '1',
    title: 'Connect Your Business Tools',
    desc: 'Link the platforms your team already uses. One click per tool. No migration, no IT team, no disruption to your workflows.',
    details: [
      'Choose from available integrations (CRM, finance, communication, project management)',
      'Secure OAuth connections — no passwords stored',
      'Read-only access — Core314 never modifies your data',
      'Most teams are fully connected in under 5 minutes',
    ],
    visual: 'integrations',
  },
  {
    num: '2',
    title: 'Core314 Detects Operational Signals',
    desc: 'Our AI engine monitors your connected tools and identifies patterns, risks, and anomalies across three signal categories.',
    details: [
      'Revenue risk signals: stalled deals, pipeline gaps, forecast risks',
      'Operational activity signals: bottlenecks, communication spikes, delays',
      'Financial behavior signals: invoice delays, expense anomalies, cash flow shifts',
      'Cross-system correlation finds patterns no single tool can detect',
    ],
    visual: 'signals',
  },
  {
    num: '3',
    title: 'Receive Your Operational Brief',
    desc: 'Get a clear, written AI-generated brief that tells you what is happening, why it matters, and what to do next.',
    details: [
      'Plain English explanations — no charts to interpret',
      'Severity-ranked signals so you know what to address first',
      'Recommended actions backed by cross-system data',
      'Operational health score (0-100) for instant status',
    ],
    visual: 'brief',
  },
];

const keyLogos = [
  { Logo: SlackLogo, name: 'Slack' },
  { Logo: HubSpotLogo, name: 'HubSpot' },
  { Logo: QuickBooksLogo, name: 'QuickBooks' },
  { Logo: JiraLogo, name: 'Jira' },
  { Logo: SalesforceLogo, name: 'Salesforce' },
  { Logo: TeamsLogo, name: 'Teams' },
];

const whyDifferent = [
  {
    icon: FileText,
    title: 'Written Intelligence, Not Dashboards',
    desc: 'You get a brief that explains what is happening in plain English — not a dashboard you have to interpret yourself.',
  },
  {
    icon: Target,
    title: 'Cross-System Correlation',
    desc: 'Core314 connects data across all your tools to find patterns that no single tool can detect on its own.',
  },
  {
    icon: Zap,
    title: 'Proactive, Not Reactive',
    desc: 'Core314 surfaces risks before they become problems. You act with foresight, not hindsight.',
  },
  {
    icon: Clock,
    title: '5-Minute Setup, Zero Maintenance',
    desc: 'Connect your tools and go. No configuration, no training, no ongoing maintenance required.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-semibold mb-6"
          >
            <Zap className="h-4 w-4" />
            From Connected to Confident in Minutes
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            How Core314{' '}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">Works</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8"
          >
            Three simple steps to go from scattered tools to clear operational intelligence.
            No IT team. No training. No disruption.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-6 text-sm text-slate-500"
          >
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> 5-minute setup</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> No code required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> 14-day free trial</span>
          </motion.div>
        </div>
      </section>

      {/* MAIN STEPS */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-24">
            {mainSteps.map((step, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
              >
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="inline-flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-600/20">
                      <span className="text-lg font-extrabold text-white">{step.num}</span>
                    </div>
                    <span className="text-sm font-bold text-sky-600 uppercase tracking-wider">Step {step.num}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">{step.title}</h2>
                  <p className="text-lg text-slate-600 leading-relaxed mb-6">{step.desc}</p>
                  <ul className="space-y-3">
                    {step.details.map((d, di) => (
                      <li key={di} className="flex items-start gap-2.5">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600 leading-relaxed">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                  {step.visual === 'integrations' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8">
                      <div className="grid grid-cols-3 gap-6">
                        {keyLogos.map(({ Logo, name }) => (
                          <div key={name} className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">
                              <Logo className="w-10 h-10" />
                            </div>
                            <span className="text-xs text-slate-500">{name}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-center text-xs text-slate-400 mt-6">+ many more — growing based on user requests</p>
                    </div>
                  )}
                  {step.visual === 'signals' && (
                    <div className="bg-slate-900 rounded-2xl p-6 text-white">
                      <div className="text-xs text-sky-400 font-medium uppercase tracking-wider mb-4">Signal Detection</div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                          <p className="text-sm text-slate-300">[HubSpot] 5 deals stalled ($320K at risk) &mdash; Acme Corp $85K, GlobalTech $120K</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                          <p className="text-sm text-slate-300">[QuickBooks] 3 overdue invoices totaling $28,750 &mdash; oldest 52 days past due</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          <p className="text-sm text-slate-300">[Slack] Response time 45 min avg, communication volume below threshold</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          <p className="text-sm text-slate-300">[Monday + Trello] 10 overdue items across project boards</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {step.visual === 'brief' && (
                    <div className="bg-slate-900 rounded-2xl p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xs text-sky-400 font-medium uppercase tracking-wider">Operational Brief</div>
                        <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium">Health: 10/100</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed mb-4">
                        5 stalled deals in HubSpot ($320K) correlate with 3 overdue invoices in QuickBooks ($28,750),
                        indicating a breakdown between sales conversion and billing execution.
                      </p>
                      <div className="text-xs text-sky-400 font-medium uppercase tracking-wider mb-2">Actions</div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-300">John Smith: Re-engage Acme Corp ($85K) &mdash; within 48 hours</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-300">Finance Team: Pursue INV-1042 payment ($12,500) &mdash; immediately</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY DIFFERENT */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Why Core314</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Not Another Dashboard Tool
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 is fundamentally different from BI tools and dashboards. Here is why.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto"
          >
            {whyDifferent.map((w, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 hover:shadow-lg hover:border-sky-200 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <w.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{w.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECURITY NOTE */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Security at Every Step</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every connection uses OAuth with read-only access. Core314 never stores passwords, never modifies your data,
                and encrypts everything in transit (TLS 1.3) and at rest (AES-256). Your business data is never shared or sold.
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <Lock className="h-3.5 w-3.5" /> OAuth Only
                </span>
                <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <Eye className="h-3.5 w-3.5" /> Read-Only Access
                </span>
                <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <Shield className="h-3.5 w-3.5" /> SOC 2 Aligned
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              14-Day Risk-Free Trial
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Ready to See What You&apos;ve Been Missing?
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Connect your tools in minutes, get your first brief, and experience what operational intelligence feels like.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-2xl transition-all">
                Start My Free 14-Day Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-sm text-slate-400">Card not charged during trial &middot; Set up in under 5 minutes &middot; Cancel anytime</p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
