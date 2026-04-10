import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  BarChart3,
  FileText,
  Zap,
  Target,
  AlertTriangle,
  TrendingDown,
  Search,
  CheckCircle,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { SampleBrief } from '../components/SampleBrief';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ===== SECTION 2 DATA: WHAT YOU GET ===== */
const whatYouGet = [
  {
    icon: Activity,
    title: 'Spot risks before they escalate',
    desc: 'Core314 monitors your connected systems and surfaces signals that indicate revenue risk, delivery delays, or cash flow problems before they become costly.',
  },
  {
    icon: BarChart3,
    title: 'See the full picture across tools',
    desc: 'A stalled deal in HubSpot combined with overdue invoices in QuickBooks tells a story. Core314 connects signals across systems so you see what no single tool can show.',
  },
  {
    icon: TrendingDown,
    title: 'Understand the real business impact',
    desc: 'Every signal is tied to a dollar amount, a timeline, or a client outcome. Know exactly what is at stake and how much it could cost your business.',
  },
  {
    icon: Search,
    title: 'Know why problems are happening',
    desc: 'Core314 identifies the root cause behind connected signals. Stop treating symptoms and start fixing the source of operational breakdowns.',
  },
  {
    icon: Zap,
    title: 'Get clear next steps with accountability',
    desc: 'Each brief includes specific recommended actions: who should do what, by when. Turn operational intelligence into immediate decisions.',
  },
];

/* ===== SECTION 3 DATA: HOW IT WORKS ===== */
const howItWorksSteps = [
  {
    step: '01',
    title: 'Connect',
    desc: 'Link your business tools via secure OAuth. HubSpot, Slack, QuickBooks, Google Calendar, and more. No migration required.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Detect',
    desc: 'Core314 continuously monitors your connected systems and identifies operational patterns, risks, and anomalies across every data source.',
    icon: Activity,
  },
  {
    step: '03',
    title: 'Brief',
    desc: 'Receive an AI-generated narrative explaining what is happening, why it matters, and the business impact — in plain language, not charts.',
    icon: FileText,
  },
  {
    step: '04',
    title: 'Act',
    desc: 'Clear recommended actions with accountability — who should do what, by when. Turn intelligence into decisions immediately.',
    icon: Zap,
  },
];

/* ===== SECTION 5 DATA: INTEGRATIONS ===== */
const integrations = [
  { name: 'Slack', logo: '/logos/slack.svg' },
  { name: 'HubSpot', logo: '/logos/hubspot.svg' },
  { name: 'QuickBooks', logo: '/logos/quickbooks.svg' },
  { name: 'Google Calendar', logo: '/logos/google-calendar.svg' },
  { name: 'Gmail', logo: '/logos/gmail.svg' },
  { name: 'Trello', logo: '/logos/trello.svg' },
  { name: 'Microsoft Teams', logo: '/logos/teams.svg' },
  { name: 'Google Sheets', logo: '/logos/google-sheets.svg' },
];

const comingSoon = ['Salesforce', 'Notion', 'Monday.com', 'ADP'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* ================================================================
          SECTION 1 — HERO
          ================================================================ */}
      <section className="pt-24 pb-14 lg:pt-28 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left: Copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-medium mb-5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Operational Intelligence Platform
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-5"
              >
                Know what&apos;s breaking in your business{' '}
                <span className="text-sky-600">before it costs you.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-slate-600 leading-relaxed mb-5"
              >
                Core314 analyzes your systems and delivers an AI-generated operational brief
                explaining what&apos;s happening, why it&apos;s happening, and what to do next.
              </motion.p>

              <motion.ul
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="space-y-2 mb-6"
              >
                {[
                  'Detects revenue risk, delivery delays, and cash flow issues across connected tools',
                  'Delivers a written brief with root cause analysis and recommended next steps',
                  'Tells you who should do what, by when — with clear accountability',
                ].map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </motion.ul>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-6"
              >
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Generate Your First Brief
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#sample-brief"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
                >
                  View Example Brief
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Connects With Your Systems
                </p>
                <div className="flex items-center gap-6 sm:gap-8">
                  <img src="/logos/slack.svg" alt="Slack" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <img src="/logos/quickbooks.svg" alt="QuickBooks" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <img src="/logos/hubspot.svg" alt="HubSpot" className="h-7 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                  <span className="text-sm font-medium text-slate-400 border-l border-slate-200 pl-6">+ 5 More</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Mini brief visual */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block"
            >
              <SampleBrief compact />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — WHAT YOU GET
          ================================================================ */}
      <section className="py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Not dashboards. Decisions.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Every brief delivers structured intelligence — from detection to action — so you
              can make informed decisions, not review more data.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5"
          >
            {whatYouGet.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-sky-200 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-base font-bold mb-2 text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3 — HOW IT WORKS
          ================================================================ */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              How Core314 Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Four steps from connection to clarity. No disruption to your existing workflows.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {howItWorksSteps.map((item, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="relative">
                <div className="bg-white border border-slate-200 rounded-xl p-6 h-full hover:border-sky-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sky-500/20 text-4xl font-extrabold mb-3">{item.step}</div>
                  <item.icon className="h-6 w-6 text-sky-600 mb-3" />
                  <h3 className="text-lg font-bold mb-2 text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-slate-300 z-10">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4 — SAMPLE OPERATIONAL BRIEF (PRIMARY CONVERSION ASSET)
          ================================================================ */}
      <section id="sample-brief" className="py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <p className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">
              See What You Get
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              A Real Operational Brief
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Not a dashboard. Not a chart. A clear, written explanation of what is happening
              inside your business — generated by AI from real operational data.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <SampleBrief />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-8"
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Generate Your First Brief
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — INTEGRATIONS
          ================================================================ */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Connects Across Your Business Systems
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 integrates with the platforms your team already uses — no migration, no disruption. New integrations added continuously.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-5 max-w-4xl mx-auto"
          >
            {integrations.map((integration, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-xl p-5 text-center hover:border-sky-200 hover:shadow-md transition-all duration-200"
              >
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <img src={integration.logo} alt={integration.name} className="h-10 w-10 object-contain" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{integration.name}</h3>
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Available
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Coming Soon */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-slate-500 mb-2">
              <span className="font-semibold text-slate-700">{comingSoon.join(', ')}</span> and more coming soon.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-4"
          >
            <Link
              to="/integrations"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors"
            >
              Request an Integration
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6 — POSITIONING
          ================================================================ */}
      <section className="py-16 lg:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <AlertTriangle className="h-10 w-10 text-sky-500 mx-auto mb-5" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-5">
              Built for operators who need clarity — not more dashboards.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
              Your business already has the data. Core314 tells you what it means.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { label: 'Eliminate hours spent on manual operational reviews', icon: FileText },
                { label: 'Surface cross-system patterns no single tool can reveal', icon: BarChart3 },
                { label: 'Receive written intelligence — not more dashboards to check', icon: Activity },
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-xl p-5">
                  <item.icon className="h-6 w-6 text-sky-500" />
                  <p className="text-sm text-slate-700 font-medium text-center leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 7 — FINAL CTA
          ================================================================ */}
      <section className="py-16 lg:py-24 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-white"
          >
            See What Your Business Is Telling You
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto"
          >
            Connect your tools and receive your first Operational Brief.
            No dashboards to build. No reports to configure. Just clarity.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
            >
              Generate Your First Brief
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-300 border border-slate-600 hover:border-slate-400 rounded-lg transition-colors"
            >
              View Pricing
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
