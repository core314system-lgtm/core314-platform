import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Briefcase,
  MessageSquare,
  DollarSign,
  Eye,
  TrendingUp,
  Zap,
  Shield,
  BarChart3,
  Target,
  FileText,
  Lock,
  Server,
  CheckCircle,
  Activity,
  PieChart,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const signalCategories = [
  {
    icon: TrendingUp,
    title: 'Revenue Risk Signals',
    color: 'red' as const,
    signals: ['Stalled deals with no follow-up', 'Pipeline velocity slowdowns', 'Deal stage regression', 'Forecast gap detection'],
  },
  {
    icon: Activity,
    title: 'Operational Activity Signals',
    color: 'amber' as const,
    signals: ['Communication pattern changes', 'Cross-team escalation spikes', 'Workflow bottlenecks', 'Response time degradation'],
  },
  {
    icon: PieChart,
    title: 'Financial Behavior Signals',
    color: 'blue' as const,
    signals: ['Invoice payment delays', 'Expense anomalies', 'Cash flow pattern shifts', 'Vendor payment irregularities'],
  },
];

const colorMap = {
  red: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500', dot: 'bg-red-400' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', dot: 'bg-amber-400' },
  blue: { bg: 'bg-sky-50', border: 'border-sky-100', icon: 'text-sky-500', dot: 'bg-sky-400' },
};

const howItWorksSteps = [
  { step: '01', title: 'Connect Your Tools', desc: 'Link HubSpot, Slack, QuickBooks via secure OAuth. No migration required.', icon: Target },
  { step: '02', title: 'Core314 Detects Signals', desc: 'AI monitors your systems and identifies operational patterns, risks, and anomalies.', icon: BarChart3 },
  { step: '03', title: 'Receive Operational Briefs', desc: 'Get written intelligence explaining what is happening and what to do next.', icon: FileText },
  { step: '04', title: 'Act with Confidence', desc: 'Make informed leadership decisions backed by cross-system intelligence.', icon: Zap },
];

const currentIntegrations = [
  { name: 'HubSpot', icon: Briefcase, category: 'CRM' },
  { name: 'Slack', icon: MessageSquare, category: 'Communication' },
  { name: 'QuickBooks', icon: DollarSign, category: 'Finance' },
];

const leadershipRoles = [
  {
    icon: Eye,
    title: 'CEOs & Founders',
    desc: 'See the full operational picture without digging through dashboards. Understand what is happening across your entire business in one brief.',
    bullets: ['Cross-system visibility', 'Risk-aware decision making', 'Time saved on status meetings'],
  },
  {
    icon: TrendingUp,
    title: 'Revenue Leaders',
    desc: 'Detect pipeline risks before they become lost deals. Understand the signals behind revenue performance.',
    bullets: ['Deal velocity monitoring', 'Pipeline health signals', 'Forecast risk detection'],
  },
  {
    icon: BarChart3,
    title: 'Operations Leaders',
    desc: 'Identify bottlenecks, communication breakdowns, and process failures across teams and systems.',
    bullets: ['Workflow bottleneck detection', 'Cross-team pattern analysis', 'Operational efficiency signals'],
  },
];

const securityFeatures = [
  { icon: Lock, title: 'OAuth-Only Connections', desc: 'We never store your passwords. All integrations connect via secure OAuth tokens with limited scopes.' },
  { icon: Shield, title: 'SOC 2 Aligned Practices', desc: 'Our infrastructure follows SOC 2 security principles for data handling, access control, and monitoring.' },
  { icon: Server, title: 'Data Encryption', desc: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Your business data is never shared or sold.' },
  { icon: Eye, title: 'Read-Only Access', desc: 'Core314 only reads data from your connected systems. We never modify, write, or delete anything in your tools.' },
];

const briefSignals = [
  { severity: 'high', text: '7 deals in your pipeline have not received follow-up in over 5 days.' },
  { severity: 'medium', text: 'Invoice payment times increased 32% this month compared to last month.' },
  { severity: 'medium', text: 'Slack communication between sales and delivery teams increased 41%.' },
  { severity: 'low', text: 'QuickBooks expense categorization shows 3 new vendor accounts this week.' },
];

const briefActions = [
  'Follow up on stalled deals \u2014 prioritize the 3 deals closest to closing.',
  'Review overdue invoices and escalate accounts over 45 days past due.',
  'Investigate the sales-delivery communication spike for potential delivery bottleneck.',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* ===== HERO ===== */}
      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Operational Intelligence Platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Detect Hidden Business Problems{' '}
              <span className="text-sky-600">Before They Damage Your Company</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4"
            >
              Core314 connects your business systems, detects operational signals, and delivers
              written intelligence \u2014 so leadership always knows what is happening and what to do next.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-base text-slate-500 mb-10"
            >
              No dashboards to monitor. No reports to build. Just clear, actionable briefs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
            >
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Get Early Access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
              >
                See How It Works
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Works With Popular Business Platforms
              </p>
              <p className="text-sm text-slate-500 max-w-xl mx-auto mb-6 leading-relaxed">
                Core314 connects to many of the systems companies already rely on to run their business — including platforms like Slack, QuickBooks, and HubSpot — with additional integrations continuously being added.
              </p>
              <div className="flex items-center justify-center gap-8 sm:gap-12">
                <img src="/logos/slack.svg" alt="Slack" className="h-8 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                <img src="/logos/quickbooks.svg" alt="QuickBooks" className="h-8 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                <img src="/logos/hubspot.svg" alt="HubSpot" className="h-8 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-200" />
                <span className="text-sm font-medium text-slate-400 border-l border-slate-200 pl-6 sm:pl-8">+ Many More</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== OPERATIONAL BRIEF PROOF ===== */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <p className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">
              Example AI Operational Brief
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              The Operational Brief
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Not a dashboard. Not a chart. A clear, written explanation of what is happening
              inside your business \u2014 generated by AI from real operational data.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto bg-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-sky-400 text-xs font-medium uppercase tracking-wider mb-1">Core314 Operational Brief</div>
                <h3 className="text-xl font-bold text-white">Weekly Operations Summary</h3>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full text-xs font-medium">Score: 68 / 100</span>
                <span className="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full text-xs font-medium">Moderate Risk</span>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs">Detected Signals</h4>
              <div className="space-y-2.5">
                {briefSignals.map((signal, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${signal.severity === 'high' ? 'bg-red-400' : signal.severity === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                    <p className="text-slate-300 text-sm leading-relaxed">{signal.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs">Business Impact</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                Pipeline velocity has decreased this week, with multiple high-value deals showing no activity.
                Combined with the increase in invoice payment times, there is a moderate risk of revenue impact
                this quarter. The spike in sales-delivery communication may indicate emerging delivery constraints
                that could further slow deal progression.
              </p>
            </div>

            <div>
              <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs">Recommended Actions</h4>
              <div className="space-y-2.5">
                {briefActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <ChevronRight className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-300 text-sm leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== SIGNAL CATEGORIES ===== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Operational Signals Core314 Detects
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 continuously monitors your connected systems and surfaces the signals that matter most to leadership.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {signalCategories.map((cat, index) => {
              const colors = colorMap[cat.color];
              return (
                <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className={`${colors.bg} border ${colors.border} rounded-xl p-6 lg:p-8`}>
                  <cat.icon className={`h-8 w-8 ${colors.icon} mb-4`} />
                  <h3 className="text-lg font-bold mb-4 text-slate-900">{cat.title}</h3>
                  <ul className="space-y-2.5">
                    {cat.signals.map((sig, si) => (
                      <li key={si} className="flex items-start gap-2.5">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <span className="text-sm text-slate-600 leading-relaxed">{sig}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">How Core314 Works</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">Four steps from connection to clarity. No disruption to your existing workflows.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {howItWorksSteps.map((item, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="relative">
                <div className="bg-white border border-slate-200 rounded-xl p-6 h-full hover:border-sky-200 hover:shadow-md transition-all duration-200">
                  <div className="text-sky-500/20 text-4xl font-extrabold mb-3">{item.step}</div>
                  <item.icon className="h-6 w-6 text-sky-600 mb-3" />
                  <h3 className="text-base font-bold mb-2 text-slate-900">{item.title}</h3>
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

      {/* ===== INTEGRATIONS ===== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">Connects Across Your Business Systems</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">Core314 integrates with the platforms your team already uses \u2014 no migration, no disruption.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-4xl mx-auto"
          >
            {currentIntegrations.map((integration, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white border border-slate-200 rounded-xl p-6 text-center hover:border-sky-200 hover:shadow-md transition-all duration-200">
                <div className="bg-sky-50 rounded-lg w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <integration.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{integration.name}</h3>
                <p className="text-xs text-slate-500 mb-2">{integration.category}</p>
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Available
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-slate-500 mt-8"
          >
            Upcoming: Salesforce, Microsoft Teams, Jira, Stripe, Google Workspace, and Xero.
          </motion.p>
        </div>
      </section>

      {/* ===== BUILT FOR LEADERSHIP ===== */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">Built for Leadership Teams</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">Core314 is designed for the people who need to understand the full operational picture \u2014 not just one tool at a time.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {leadershipRoles.map((role, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
                <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center mb-4">
                  <role.icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{role.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{role.desc}</p>
                <ul className="space-y-2">
                  {role.bullets.map((bullet, bi) => (
                    <li key={bi} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 text-sky-500 flex-shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECURITY ===== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">Enterprise-Grade Security</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">Your business data is sensitive. Core314 is built with security as a foundation \u2014 not an afterthought.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          >
            {securityFeatures.map((feat, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.4 }} className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="bg-white rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <feat.icon className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold mb-1 text-slate-900">{feat.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== WHY CORE314 ===== */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Why Leadership Teams Choose Core314</h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="space-y-3"
          >
            {[
              'Replaces manual reporting with AI-generated operational intelligence',
              'Detects cross-system patterns no single tool can see',
              'Delivers written briefs \u2014 not dashboards, not charts',
              'Saves 5+ hours per week on operational review',
              'Identifies risks before they become crises',
              'Works with the tools your team already uses',
              'Trial begins after your first integration is connected',
            ].map((bullet, index) => (
              <motion.div key={index} variants={fadeUp} transition={{ duration: 0.3 }} className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg p-4">
                <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700 leading-relaxed">{bullet}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4"
          >
            See What Your Business Is Telling You
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto"
          >
            Your business already has the data. Core314 tells you what it means. Connect your tools and receive your first Operational Brief.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Get Early Access
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              Contact Us
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
