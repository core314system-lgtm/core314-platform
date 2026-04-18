import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Eye,
  TrendingUp,
  BarChart3,
  Zap,
  Target,
  CheckCircle,
  Users,
  Building,
  Briefcase,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const personas = [
  {
    icon: Eye,
    title: 'CEOs & Founders',
    subtitle: 'See the full picture without digging through dashboards',
    painPoints: [
      'You spend hours in status meetings trying to understand what is happening',
      'Problems surface too late — after they have already done damage',
      'You rely on incomplete reports from different teams and tools',
    ],
    outcomes: [
      'Get one brief that covers your entire operation',
      'Know exactly what is at risk and what to prioritize',
      'Save 10+ hours per week on status gathering',
      'Make confident decisions backed by cross-system data',
    ],
    color: 'sky',
  },
  {
    icon: TrendingUp,
    title: 'Revenue Leaders',
    subtitle: 'Detect pipeline risks before they become lost deals',
    painPoints: [
      'Deals stall without anyone noticing until the quarter is at risk',
      'Pipeline visibility depends on reps updating the CRM consistently',
      'Forecast accuracy suffers because you cannot see early warning signs',
    ],
    outcomes: [
      'Automatic detection of stalled deals and pipeline slowdowns',
      'Early warning on forecast gaps and deal stage regression',
      'Revenue risk signals ranked by severity and impact',
      'Recommended actions to protect pipeline health',
    ],
    color: 'emerald',
  },
  {
    icon: BarChart3,
    title: 'Operations Leaders',
    subtitle: 'Identify bottlenecks and breakdowns across teams',
    painPoints: [
      'Workflow bottlenecks hide in the gaps between systems',
      'Cross-team communication issues escalate before you see them',
      'Process failures are only discovered when they cause visible problems',
    ],
    outcomes: [
      'Cross-system pattern detection finds hidden bottlenecks',
      'Communication spike alerts flag team friction early',
      'Operational health score gives you a real-time pulse',
      'Actionable recommendations to improve efficiency',
    ],
    color: 'amber',
  },
  {
    icon: Briefcase,
    title: 'Finance Leaders',
    subtitle: 'Catch financial anomalies before they compound',
    painPoints: [
      'Invoice payment delays go unnoticed until cash flow is affected',
      'Expense anomalies surface only during monthly reconciliation',
      'Vendor payment irregularities are hard to spot across accounts',
    ],
    outcomes: [
      'Real-time detection of payment delay patterns',
      'Expense anomaly signals ranked by financial impact',
      'Cash flow shift warnings before they affect operations',
      'Clear actions to address financial risks immediately',
    ],
    color: 'violet',
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; light: string }> = {
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'text-sky-600', light: 'bg-sky-100' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', light: 'bg-emerald-100' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', light: 'bg-amber-100' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', light: 'bg-violet-100' },
};

const useCases = [
  {
    icon: Building,
    title: 'Growth-Stage Companies (20-200 employees)',
    desc: 'You have outgrown spreadsheets but are not ready for a full BI team. Core314 gives you operational intelligence without the overhead.',
    benefits: ['No BI team required', 'Scales with your growth', 'ROI in the first week'],
  },
  {
    icon: Users,
    title: 'Multi-Tool Teams',
    desc: 'Your team uses 5+ tools daily but no one has the full picture. Core314 connects the dots across all your systems.',
    benefits: ['Cross-tool signal correlation', '16 integrations available', 'One unified brief'],
  },
  {
    icon: Target,
    title: 'Leadership Teams Making Weekly Decisions',
    desc: 'You need reliable intelligence for Monday morning decisions, not another dashboard to check. Core314 delivers exactly that.',
    benefits: ['Weekly operational briefs', 'Severity-ranked signals', 'Recommended actions'],
  },
];

export default function SolutionsPage() {
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
            Solutions for Every Leadership Role
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            Intelligence Built for{' '}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">How You Lead</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8"
          >
            Whether you run the company, the revenue engine, operations, or finance — Core314 surfaces
            the signals that matter most to your role.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-sky-600/25 transition-all">
              Start My Free 14-Day Trial
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* PERSONA SECTIONS */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {personas.map((persona, i) => {
              const colors = colorMap[persona.color];
              return (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className={`${colors.bg} border ${colors.border} rounded-2xl p-6 lg:p-10`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center`}>
                          <persona.icon className={`h-6 w-6 ${colors.icon}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{persona.title}</h3>
                          <p className="text-sm text-slate-600">{persona.subtitle}</p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">The Problem</h4>
                        <ul className="space-y-2.5">
                          {persona.painPoints.map((pp, pi) => (
                            <li key={pi} className="flex items-start gap-2.5">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                              <span className="text-sm text-slate-600 leading-relaxed">{pp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">With Core314</h4>
                      <ul className="space-y-2.5">
                        {persona.outcomes.map((o, oi) => (
                          <li key={oi} className="flex items-start gap-2.5">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-slate-700 leading-relaxed">{o}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Who Core314 Is For</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Built for Teams That Want Answers
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 is designed for companies that have outgrown manual reporting but do not want the complexity of traditional BI tools.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {useCases.map((uc, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <uc.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{uc.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{uc.desc}</p>
                <ul className="space-y-1.5">
                  {uc.benefits.map((b, bi) => (
                    <li key={bi} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* COST OF INACTION */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.5 }}>
            <p className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-4">The Cost of Waiting</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Every Week Without Operational Intelligence Is a Gamble
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              While you are gathering information manually, problems are compounding silently. Stalled deals turn into
              lost revenue. Late invoices turn into cash flow crises. Team friction turns into turnover.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <div className="text-3xl font-extrabold text-amber-400 mb-1">15+</div>
                <p className="text-sm text-slate-400">Hours per week leaders spend gathering status</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <div className="text-3xl font-extrabold text-amber-400 mb-1">3x</div>
                <p className="text-sm text-slate-400">Faster decisions with operational intelligence</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <div className="text-3xl font-extrabold text-amber-400 mb-1">$200K+</div>
                <p className="text-sm text-slate-400">Average pipeline risk caught per quarter</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-amber-400">
              Can you afford to keep guessing?
            </p>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              14-Day Risk-Free Trial
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Start Leading with Intelligence, Not Guesswork
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Join the leaders who have already stopped wasting hours on status gathering and started making decisions backed by real operational data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-2xl transition-all">
                Start My Free 14-Day Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-sm text-slate-400">No credit card required &middot; Set up in under 5 minutes &middot; Cancel anytime</p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
