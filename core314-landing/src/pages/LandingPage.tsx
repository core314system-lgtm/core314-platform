import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MessageSquare,
  DollarSign,
  Eye,
  TrendingUp,
  Zap,
  Shield,
  ArrowRight,
  ChevronRight,
  BarChart3,
  Target,
  FileText,
  Users,
  Lock,
  Server,
  CheckCircle,
  Activity,
  PieChart,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

/* ===== Section 3: Operational Signals ===== */
const signalCategories = [
  {
    icon: TrendingUp,
    title: 'Revenue Risk Signals',
    color: 'red' as const,
    signals: [
      'Stalled deals with no follow-up',
      'Pipeline velocity slowdowns',
      'Deal stage regression',
      'Forecast gap detection',
    ],
  },
  {
    icon: Activity,
    title: 'Operational Activity Signals',
    color: 'amber' as const,
    signals: [
      'Communication pattern changes',
      'Cross-team escalation spikes',
      'Workflow bottlenecks',
      'Response time degradation',
    ],
  },
  {
    icon: PieChart,
    title: 'Financial Behavior Signals',
    color: 'blue' as const,
    signals: [
      'Invoice payment delays',
      'Expense anomalies',
      'Cash flow pattern shifts',
      'Vendor payment irregularities',
    ],
  },
];

/* ===== Section 4: How It Works (4 steps) ===== */
const howItWorksSteps = [
  {
    step: '01',
    title: 'Connect Your Tools',
    desc: 'Link HubSpot, Slack, QuickBooks — secure OAuth, no migration required.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Core314 Detects Signals',
    desc: 'AI monitors your connected systems and identifies operational patterns, risks, and anomalies.',
    icon: BarChart3,
  },
  {
    step: '03',
    title: 'Receive Operational Briefs',
    desc: 'Get written intelligence explaining what is happening and what to do — delivered daily or on-demand.',
    icon: FileText,
  },
  {
    step: '04',
    title: 'Act with Confidence',
    desc: 'Make informed leadership decisions backed by cross-system operational intelligence.',
    icon: Zap,
  },
];

/* ===== Section 6: Integration Ecosystem ===== */
const currentIntegrations = [
  { name: 'HubSpot', icon: Briefcase },
  { name: 'Slack', icon: MessageSquare },
  { name: 'QuickBooks', icon: DollarSign },
];

const plannedIntegrations = [
  { name: 'Salesforce', icon: Briefcase },
  { name: 'Microsoft Teams', icon: MessageSquare },
  { name: 'Xero', icon: DollarSign },
  { name: 'Stripe', icon: DollarSign },
  { name: 'Jira', icon: Target },
  { name: 'Google Workspace', icon: Users },
];

/* ===== Section 7: Built for Leadership Teams ===== */
const leadershipRoles = [
  {
    icon: Eye,
    title: 'CEOs & Founders',
    desc: 'See the full operational picture without digging through dashboards. Understand what is happening across your entire business in one brief.',
    bullets: [
      'Cross-system visibility',
      'Risk-aware decision making',
      'Time saved on status meetings',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Revenue Leaders',
    desc: 'Detect pipeline risks before they become lost deals. Understand the signals behind revenue performance.',
    bullets: [
      'Deal velocity monitoring',
      'Pipeline health signals',
      'Forecast risk detection',
    ],
  },
  {
    icon: BarChart3,
    title: 'Operations Leaders',
    desc: 'Identify bottlenecks, communication breakdowns, and process failures across teams and systems.',
    bullets: [
      'Workflow bottleneck detection',
      'Cross-team pattern analysis',
      'Operational efficiency signals',
    ],
  },
];

/* ===== Section 8: Why Leadership Teams Use Core314 ===== */
const whyBullets = [
  'Replaces manual reporting with AI-generated operational intelligence',
  'Detects cross-system patterns no single tool can see',
  'Delivers written briefs — not dashboards, not charts',
  'Saves 5+ hours per week on operational review',
  'Identifies risks before they become crises',
  'Works with the tools your team already uses',
  'Trial begins after your first integration is connected — not a countdown timer',
];

/* ===== Brief Example Data ===== */
const briefSignals = [
  { severity: 'high', text: '7 deals in your pipeline have not received follow-up in over 5 days.' },
  { severity: 'medium', text: 'Invoice payment times increased 32% this month compared to last month.' },
  { severity: 'medium', text: 'Slack communication between sales and delivery teams increased 41%.' },
  { severity: 'low', text: 'QuickBooks expense categorization shows 3 new vendor accounts this week.' },
];

const briefActions = [
  'Follow up on stalled deals — prioritize the 3 deals closest to closing.',
  'Review overdue invoices and escalate accounts over 45 days past due.',
  'Investigate the sales-delivery communication spike for potential delivery bottleneck.',
];

/* ===== Section 9: Security Features ===== */
const securityFeatures = [
  {
    icon: Lock,
    title: 'OAuth-Only Connections',
    desc: 'We never store your passwords. All integrations connect via secure OAuth tokens with limited scopes.',
  },
  {
    icon: Shield,
    title: 'SOC 2 Aligned Practices',
    desc: 'Our infrastructure follows SOC 2 security principles for data handling, access control, and monitoring.',
  },
  {
    icon: Server,
    title: 'Data Encryption',
    desc: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Your business data is never shared or sold.',
  },
  {
    icon: Eye,
    title: 'Read-Only Access',
    desc: 'Core314 only reads data from your connected systems. We never modify, write, or delete anything in your tools.',
  },
];

const colorMap = {
  red: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500', dot: 'bg-red-400' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', dot: 'bg-amber-400' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500', dot: 'bg-blue-400' },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <Header />

      {/* ===== SECTION 1: HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50/50 to-white" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-200 rounded-full blur-3xl" />
            <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-100 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="relative z-20 text-center px-4 max-w-6xl mx-auto py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="mb-8"
          >
            <img src="/logo-icon.svg" alt="Core314" className="h-16 w-16 mx-auto" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="text-slate-900">AI-Powered Operational Intelligence</span>
            <br />
            <span className="text-sky-600">for Leadership Teams</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Core314 connects your business systems, detects operational signals, and delivers written intelligence — so leadership always knows what is happening and what to do next.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            No dashboards to monitor. No reports to build. Just clear, actionable briefs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
          >
            <Link
              to="/signup"
              className="px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Get Early Access
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/how-it-works"
              className="px-10 py-4 bg-white border-2 border-sky-500 text-sky-600 rounded-lg font-semibold text-lg hover:bg-sky-50 transition-all duration-300 flex items-center justify-center"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              See How It Works
            </Link>
          </motion.div>

          {/* Integration Logos with hover animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex items-center justify-center gap-8 text-slate-400"
          >
            <span className="text-sm font-medium uppercase tracking-wider">Works with</span>
            <div className="flex items-center gap-6">
              {[
                { Icon: Briefcase, label: 'HubSpot' },
                { Icon: MessageSquare, label: 'Slack' },
                { Icon: DollarSign, label: 'QuickBooks' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-slate-500 transition-all duration-300 hover:text-sky-600 hover:scale-110 cursor-default"
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 2: EXAMPLE AI OPERATIONAL BRIEF ===== */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p
              className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Example AI Operational Brief
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              The Operational Brief
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Not a dashboard. Not a chart. A clear, written explanation of what is happening inside your business — generated by AI from real operational data.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sky-400 text-sm font-medium uppercase tracking-wider mb-1">
                  Core314 Operational Brief
                </div>
                <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Weekly Operations Summary
                </h3>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
                  Score: 68 / 100
                </div>
                <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
                  Moderate Risk
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-sm">
                Detected Signals
              </h4>
              <div className="space-y-3">
                {briefSignals.map((signal, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        signal.severity === 'high'
                          ? 'bg-red-400'
                          : signal.severity === 'medium'
                          ? 'bg-amber-400'
                          : 'bg-green-400'
                      }`}
                    />
                    <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {signal.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-sm">
                Business Impact
              </h4>
              <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Pipeline velocity has decreased this week, with multiple high-value deals showing no activity. Combined with the increase in invoice payment times, there is a moderate risk of revenue impact this quarter. The spike in sales-delivery communication may indicate emerging delivery constraints that could further slow deal progression.
              </p>
            </div>

            <div>
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-sm">
                Recommended Actions
              </h4>
              <div className="space-y-3">
                {briefActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <ChevronRight className="h-5 w-5 text-sky-400 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 3: OPERATIONAL SIGNALS CORE314 DETECTS ===== */}
      <section className="py-24 px-4 bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Operational Signals Core314 Detects
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Core314 continuously monitors your connected systems and surfaces the signals that matter most to leadership.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {signalCategories.map((cat, index) => {
              const colors = colorMap[cat.color];
              return (
                <motion.div
                  key={index}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className={`${colors.bg} border ${colors.border} rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300`}
                >
                  <cat.icon className={`h-10 w-10 ${colors.icon} mb-4`} />
                  <h3
                    className="text-xl font-bold mb-4 text-slate-800"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {cat.title}
                  </h3>
                  <ul className="space-y-3">
                    {cat.signals.map((sig, si) => (
                      <li key={si} className="flex items-start gap-3">
                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <span className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {sig}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 4: HOW CORE314 WORKS (4-step) ===== */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              How Core314 Works
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Four steps from connection to clarity. No disruption to your existing workflows.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {howItWorksSteps.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-300 h-full">
                  <div className="text-sky-500 text-5xl font-bold mb-4 opacity-20" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {item.step}
                  </div>
                  <item.icon className="h-8 w-8 text-sky-600 mb-4" />
                  <h3
                    className="text-xl font-bold mb-3 text-slate-800"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {item.desc}
                  </p>
                </div>
                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-sky-300 z-10">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 5: CONNECTS ACROSS YOUR BUSINESS SYSTEMS ===== */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Connects Across Your Business Systems
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Core314 integrates with the platforms your team already uses — no migration, no disruption.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8"
          >
            {currentIntegrations.map((integration, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-sky-50 border border-sky-100 rounded-2xl p-8 text-center shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 cursor-default"
              >
                <div className="bg-white rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <integration.icon className="h-8 w-8 text-sky-600" />
                </div>
                <h3
                  className="text-xl font-bold mb-2 text-slate-800"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {integration.name}
                </h3>
                <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Live
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 6: EXPANDING INTEGRATION ECOSYSTEM ===== */}
      <section className="py-24 px-4 bg-gradient-to-b from-white to-sky-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Expanding Integration Ecosystem
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              More integrations are coming. Core314 is designed to grow with your operational stack.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6"
          >
            {plannedIntegrations.map((integration, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-300 hover:scale-105 cursor-default"
              >
                <div className="bg-slate-50 rounded-xl w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <integration.icon className="h-6 w-6 text-slate-400" />
                </div>
                <h4
                  className="text-sm font-semibold text-slate-700"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {integration.name}
                </h4>
                <span className="text-xs text-slate-400 font-medium">Coming Soon</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 7: BUILT FOR LEADERSHIP TEAMS ===== */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Built for Leadership Teams
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Core314 is designed for the people who need to understand the full operational picture — not just one tool at a time.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {leadershipRoles.map((role, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="bg-sky-50 rounded-xl w-12 h-12 flex items-center justify-center mb-4">
                  <role.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3
                  className="text-xl font-bold mb-3 text-slate-800"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {role.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {role.desc}
                </p>
                <ul className="space-y-2">
                  {role.bullets.map((bullet, bi) => (
                    <li key={bi} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 text-sky-500 flex-shrink-0" />
                      <span style={{ fontFamily: 'Inter, sans-serif' }}>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 8: WHY LEADERSHIP TEAMS USE CORE314 ===== */}
      <section className="py-24 px-4 bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Why Leadership Teams Use Core314
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="space-y-4"
          >
            {whyBullets.map((bullet, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <CheckCircle className="h-6 w-6 text-sky-500 mt-0.5 flex-shrink-0" />
                <p className="text-lg text-slate-700 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {bullet}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 9: ENTERPRISE-GRADE SECURITY ===== */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Enterprise-Grade Security
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Your business data is sensitive. Core314 is built with security as a foundation — not an afterthought.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {securityFeatures.map((feat, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-sky-50 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <feat.icon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <h3
                      className="text-xl font-bold mb-2 text-slate-800"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {feat.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {feat.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECTION 10: FINAL CTA ===== */}
      <section className="relative py-24 px-4 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            See What Your Business Is Telling You
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl text-sky-600 font-semibold mb-8"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Your business already has the data. Core314 tells you what it means.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Connect your tools. Receive your first Operational Brief. Understand what is actually happening inside your business.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/signup"
              className="px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Get Early Access
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/contact"
              className="px-10 py-4 bg-white border-2 border-sky-500 text-sky-600 rounded-lg font-semibold text-lg hover:bg-sky-50 transition-all duration-300 flex items-center justify-center"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Contact Us
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
