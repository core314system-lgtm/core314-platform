import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Shield,
  Lock,
  Eye,
  Server,
  BarChart3,
  FileText,
  Target,
  Activity,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  SlackLogo,
  HubSpotLogo,
  QuickBooksLogo,
  GoogleCalendarLogo,
  GmailLogo,
  JiraLogo,
  TrelloLogo,
  TeamsLogo,
  GoogleSheetsLogo,
  AsanaLogo,
  SalesforceLogo,
  ZoomLogo,
  GitHubLogo,
  ZendeskLogo,
  NotionLogo,
  MondayLogo,
} from '../components/IntegrationLogos';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const capabilities = [
  {
    icon: Activity,
    title: 'Signal Detection Engine',
    desc: 'AI continuously monitors your connected tools and identifies operational patterns, risks, and anomalies that human review would miss.',
    bullets: ['Revenue risk signals', 'Operational bottleneck detection', 'Financial behavior analysis', 'Communication pattern shifts'],
  },
  {
    icon: FileText,
    title: 'AI Operational Briefs',
    desc: 'Get clear, written intelligence that explains what is happening across your business, why it matters, and what to do about it.',
    bullets: ['Plain English explanations', 'Severity-ranked signals', 'Recommended actions', 'Business impact analysis'],
  },
  {
    icon: BarChart3,
    title: 'Operational Health Score',
    desc: 'A single score that tells you how healthy your operations are right now — and what is driving the number up or down.',
    bullets: ['Real-time scoring (0-100)', 'Category breakdowns', 'Trend tracking', 'Risk-level indicators'],
  },
  {
    icon: Target,
    title: 'Cross-System Intelligence',
    desc: 'Core314 connects data across all your tools to surface patterns that no single tool can detect on its own.',
    bullets: ['Multi-tool correlation', 'Pipeline-to-delivery alignment', 'Revenue-to-operations mapping', 'Communication-to-outcome tracking'],
  },
];

const signalTypes = [
  { icon: TrendingUp, title: 'Revenue Risk Signals', desc: 'Stalled deals, pipeline slowdowns, forecast gaps, and deal stage regression.', color: 'text-red-500', bg: 'bg-red-50' },
  { icon: Activity, title: 'Operational Activity Signals', desc: 'Communication spikes, workflow bottlenecks, response time degradation.', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: BarChart3, title: 'Financial Behavior Signals', desc: 'Invoice delays, expense anomalies, cash flow shifts, vendor irregularities.', color: 'text-sky-500', bg: 'bg-sky-50' },
];

const allIntegrations = [
  { name: 'Slack', Logo: SlackLogo },
  { name: 'HubSpot', Logo: HubSpotLogo },
  { name: 'QuickBooks', Logo: QuickBooksLogo },
  { name: 'Google Calendar', Logo: GoogleCalendarLogo },
  { name: 'Gmail', Logo: GmailLogo },
  { name: 'Jira', Logo: JiraLogo },
  { name: 'Trello', Logo: TrelloLogo },
  { name: 'Microsoft Teams', Logo: TeamsLogo },
  { name: 'Google Sheets', Logo: GoogleSheetsLogo },
  { name: 'Asana', Logo: AsanaLogo },
  { name: 'Salesforce', Logo: SalesforceLogo },
  { name: 'Zoom', Logo: ZoomLogo },
  { name: 'GitHub', Logo: GitHubLogo },
  { name: 'Zendesk', Logo: ZendeskLogo },
  { name: 'Notion', Logo: NotionLogo },
  { name: 'Monday.com', Logo: MondayLogo },
];

const securityFeatures = [
  { icon: Lock, title: 'OAuth-Only Connections', desc: 'We never store your passwords. All connections use secure OAuth tokens with limited scopes.' },
  { icon: Shield, title: 'SOC 2 Aligned', desc: 'Infrastructure follows SOC 2 security principles for data handling and access control.' },
  { icon: Server, title: 'Encrypted Everywhere', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). Never shared or sold.' },
  { icon: Eye, title: 'Read-Only Access', desc: 'Core314 only reads data. We never modify, write, or delete anything in your tools.' },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-semibold mb-6"
          >
            <Zap className="h-4 w-4" />
            Operational Intelligence Platform
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            AI That Tells You What&apos;s{' '}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">Really Happening</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8"
          >
            Core314 connects to your business tools, detects hidden risks, and delivers written briefs
            so leadership always knows what is going on — without checking a single dashboard.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-sky-600/25 transition-all">
              Start My Free 14-Day Trial
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/how-it-works" className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-colors">
              See How It Works
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Core Capabilities</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Everything You Need to Lead with Clarity
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              From signal detection to actionable briefs — Core314 gives leadership the intelligence they need to make confident decisions.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          >
            {capabilities.map((cap, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 hover:shadow-lg hover:border-sky-200 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <cap.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2">{cap.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{cap.desc}</p>
                <ul className="space-y-1.5">
                  {cap.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
                      <span className="text-sm text-slate-500">{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SIGNAL TYPES */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Signal Intelligence</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Three Categories of Operational Signals
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 monitors your systems and detects signals across revenue, operations, and finance — giving you a complete picture.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {signalTypes.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}
                className={`${s.bg} border border-slate-200 rounded-2xl p-6 lg:p-8`}
              >
                <div className="mb-4">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">16 Integrations</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Connects to the Tools You Already Use
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              One-click OAuth connections. Read-only access. No data migration required.
            </p>
          </motion.div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-8 items-center justify-items-center max-w-4xl mx-auto">
            {allIntegrations.map(({ name, Logo }) => (
              <div key={name} className="group flex flex-col items-center gap-2" title={name}>
                <Logo className="w-10 h-10 sm:w-12 sm:h-12 opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors hidden sm:block">{name}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/integrations" className="inline-flex items-center gap-2 text-sky-600 font-semibold hover:text-sky-700 transition-colors">
              View all integrations <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Enterprise-Grade Security</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Your Data Is Protected at Every Layer
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {securityFeatures.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-sm font-bold mb-2 text-slate-900">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
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
              See Core314 in Action
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Connect your tools, get your first operational brief, and experience the clarity that comes from knowing exactly what is happening in your business.
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
