import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Shield,
  Lock,
  Eye,
  Server,
  Clock,
  TrendingUp,
  AlertTriangle,
  Zap,
  BarChart3,
  FileText,
  Target,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
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
import { PRICING, formatPrice } from '../config/pricing';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const proofMetrics = [
  { value: '16+', label: 'Integrations' },
  { value: '5 min', label: 'Setup Time' },
  { value: '100%', label: 'Read-Only Access' },
  { value: '14 days', label: 'Risk-Free Trial' },
];

const painPoints = [
  {
    icon: AlertTriangle,
    title: 'Blind Spots Kill Growth',
    desc: 'Stalled deals, overdue invoices, team bottlenecks \u2014 they compound silently until they cost you real money.',
  },
  {
    icon: Clock,
    title: 'Hours Wasted on Status Updates',
    desc: 'Leaders spend 15+ hours per week gathering information from scattered tools just to understand what is happening.',
  },
  {
    icon: TrendingUp,
    title: 'Competitors Move Faster',
    desc: 'Companies using operational intelligence make decisions 3x faster. Without it, you are always reacting \u2014 never leading.',
  },
];

const benefits = [
  {
    icon: Zap,
    title: 'Know What Is Happening \u2014 Instantly',
    desc: 'Get a written AI brief that explains exactly what is going on across your business systems. No dashboards to monitor.',
  },
  {
    icon: Target,
    title: 'Catch Problems Before They Spread',
    desc: 'Core314 detects revenue risks, operational bottlenecks, and financial anomalies before they become crises.',
  },
  {
    icon: FileText,
    title: 'Act with Confidence',
    desc: 'Every brief includes recommended actions backed by cross-system data. Stop guessing. Start deciding.',
  },
  {
    icon: BarChart3,
    title: 'Operational Health at a Glance',
    desc: 'A single score tells you how healthy your operations are today \u2014 and what is driving the number up or down.',
  },
];

const steps = [
  { num: '1', title: 'Connect Your Tools', desc: 'Link your business tools in minutes via secure OAuth. New integrations added regularly.' },
  { num: '2', title: 'Core314 Detects Signals', desc: 'AI monitors your systems and identifies patterns, risks, and anomalies in real time.' },
  { num: '3', title: 'Get Your Operational Brief', desc: 'Receive clear, written intelligence explaining what is happening and what to do next.' },
];

const briefSignals = [
  { severity: 'high', text: '[HubSpot] 5 deals stalled in the pipeline ($320,000 at risk). Acme Corp - Enterprise License ($85K, 28 days), GlobalTech - Platform Migration ($120K, 21 days), Nexus Industries - Annual Renewal ($45K, 22 days).' },
  { severity: 'high', text: '[QuickBooks] 3 overdue invoices totaling $28,750. INV-1042 (Acme Corp, $12,500, 35 days overdue), INV-1038 (GlobalTech, $8,750, 52 days overdue), INV-1035 (Nexus Industries, $7,500, 28 days overdue).' },
  { severity: 'medium', text: '[Slack] Average response time is 45 minutes across 4 monitored channels. Communication volume is below typical thresholds (3 messages across 4 channels).' },
  { severity: 'medium', text: '[Monday + Trello] 3 overdue items on Monday.com (33% completion) and 7 Trello cards past due across 3 boards. Project delivery at risk.' },
];

const briefActions = [
  'John Smith: Re-engage Acme Corp deal ($85K, Qualified to Buy) \u2014 within 48 hours.',
  'Sarah Lee: Follow up with GlobalTech on presentation ($120K) \u2014 within 72 hours.',
  'Finance Team: Pursue overdue invoice payment from Acme Corp (INV-1042, $12,500, 35 days overdue) \u2014 immediately.',
  'IT Team: Re-authorize Slack app with groups:read scope to monitor private channels \u2014 within 24 hours.',
];

const testimonials = [
  {
    quote: 'Core314 showed us revenue risks we had no idea existed. We caught a $200K pipeline problem before it was too late.',
    name: 'Operations Director',
    company: 'Mid-Market SaaS Company',
  },
  {
    quote: 'Instead of spending hours pulling reports from 5 different tools, I get one brief that tells me exactly what I need to know.',
    name: 'CEO & Founder',
    company: 'Professional Services Firm',
  },
  {
    quote: 'The operational health score alone is worth it. We finally have a single number that tells us how the business is running.',
    name: 'VP of Operations',
    company: 'Growth-Stage Startup',
  },
];

const securityFeatures = [
  { icon: Lock, title: 'OAuth-Only Connections', desc: 'We never store your passwords. All connections use secure OAuth tokens with limited scopes.' },
  { icon: Shield, title: 'SOC 2 Aligned Practices', desc: 'Infrastructure follows SOC 2 security principles for data handling, access control, and monitoring.' },
  { icon: Server, title: 'Data Encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). Your business data is never shared.' },
  { icon: Eye, title: 'Read-Only Access', desc: 'Core314 only reads data. We never modify, write, or delete anything in your tools.' },
];

const faqs = [
  {
    q: 'What is Core314?',
    a: 'Core314 is an Operational Intelligence Platform. It connects to your existing business tools, detects patterns and risks across your operations, and delivers written AI-powered briefs that tell leadership what is happening and what to do about it.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most teams are up and running in under 5 minutes. You connect your tools via OAuth (one click per tool), and Core314 starts detecting signals immediately. No migration, no IT team required.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. Core314 uses OAuth-only connections with read-only access. We never store passwords, never modify your data, and encrypt everything in transit and at rest. Your data is never shared or sold.',
  },
  {
    q: 'What tools does Core314 connect to?',
    a: 'Core314 integrates with popular business platforms including Slack, HubSpot, QuickBooks, Jira, Salesforce, Google Calendar, Gmail, Microsoft Teams, and more. New integrations are added regularly.',
  },
  {
    q: 'Can I try it before I commit?',
    a: 'Yes. Every plan includes a 14-day risk-free trial. Your card will not be charged during the trial period, and you can cancel anytime before it ends. If Core314 does not deliver value in 14 days, you pay nothing.',
  },
  {
    q: 'What makes this different from a dashboard tool?',
    a: 'Dashboards show you charts and expect you to find the problems yourself. Core314 does the analysis for you and delivers a written brief that explains what is happening, why it matters, and what actions to take.',
  },
  {
    q: 'How much does it cost?',
    a: `Plans start at ${formatPrice(PRICING.intelligence.monthly)}/month for the Intelligence plan (1 user, 3 integrations, 30 briefs/month). The Command Center plan is ${formatPrice(PRICING.commandCenter.monthly)}/month for teams (5 users, 10 integrations, unlimited briefs).`,
  },
  {
    q: 'Do I need technical skills to use Core314?',
    a: 'Not at all. Core314 is built for business leaders, not engineers. Connecting tools takes one click, and briefs are written in plain English. If you can read an email, you can use Core314.',
  },
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

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Your competitors are already using AI to lead. Are you?
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
            >
              Stop Guessing.{' '}
              <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                Start Knowing.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4"
            >
              Core314 connects your business tools and delivers AI-powered briefs that tell you
              exactly what is happening, what is at risk, and what to do next.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-base text-slate-500 mb-8"
            >
              No dashboards. No reports. Just clear, written intelligence for leadership.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-4"
            >
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-sky-600/25 transition-all duration-200"
              >
                Start My Free 14-Day Trial
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
              >
                See How It Works
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="text-sm text-slate-400"
            >
              Card not charged during trial &middot; Set up in under 5 minutes &middot; Cancel anytime
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-14 max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
              {proofMetrics.map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{m.value}</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* INTEGRATION LOGOS BAR */}
      <section className="py-12 border-y border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-8">
            Connects with the tools your team already uses
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-6 items-center justify-items-center">
            {allIntegrations.map(({ name, Logo }) => (
              <div key={name} className="group flex flex-col items-center gap-1.5" title={name}>
                <Logo className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors hidden sm:block">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM / AGITATION */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-3">The Hidden Cost of Not Knowing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Every Day Without Visibility Is Costing You Money
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Most leaders don&apos;t find out about problems until they&apos;ve already done damage.
              Stalled deals, late invoices, team friction &mdash; they compound fast.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {painPoints.map((p, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 lg:p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <p.icon className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold mb-3">{p.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-12"
          >
            <p className="text-lg font-semibold text-amber-400">
              You can&apos;t fix what you can&apos;t see. Core314 makes the invisible visible.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SOLUTION / BENEFITS */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Operational Intelligence, Delivered
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Core314 turns your scattered business data into clear, actionable intelligence &mdash; so you lead with confidence, not guesswork.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8"
          >
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 hover:shadow-lg hover:border-sky-200 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <b.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{b.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* OPERATIONAL BRIEF PROOF */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">See It In Action</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              This Is What Your Brief Looks Like
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Not a dashboard. Not a chart. A clear, written explanation of what is happening
              inside your business &mdash; generated by AI from real operational data.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto bg-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-slate-700"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-sky-400 text-xs font-medium uppercase tracking-wider mb-1">Core314 Operational Brief</div>
                <h3 className="text-xl font-bold text-white">Full Operational Slowdown Detected</h3>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium">Health: 10 / 100</span>
                <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium">Critical</span>
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
              <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs">Cross-System Correlation</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                5 stalled deals in HubSpot ($320,000 pipeline) correlate with 3 overdue invoices in QuickBooks ($28,750),
                indicating a breakdown between sales conversion and billing execution. Revenue at risk: $320,000.
                Overdue cash: $28,750. Low Slack engagement and overdue project tasks in Monday + Trello compound the risk.
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

      {/* HOW IT WORKS */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Simple Setup</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              From Connected to Confident in 3 Steps
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              No IT team required. No migration. No disruption. Just connect and go.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {steps.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-sky-600/20">
                  <span className="text-2xl font-extrabold text-white">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-12"
          >
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-2 text-sky-600 font-semibold hover:text-sky-700 transition-colors"
            >
              See the full walkthrough
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SOCIAL PROOF / TESTIMONIALS */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">What Leaders Are Saying</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Built for Leaders Who Want Answers, Not Dashboards
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 flex flex-col"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, si) => (
                    <svg key={si} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-sm text-slate-700 leading-relaxed mb-6 flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.company}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Enterprise-Grade Security</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Your Data Is Protected. Period.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              We built Core314 with security at every layer. Your business data is never shared, sold, or at risk.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {securityFeatures.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
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

      {/* FAQ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-600">Everything you need to know before getting started.</p>
          </motion.div>

          <div className="border-t border-slate-200">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              Limited: 14-Day Risk-Free Trial
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Stop Losing Money to Problems<br className="hidden sm:block" /> You Didn&apos;t Know Existed
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Every week without operational intelligence is another week of invisible risks compounding.
              Start your free trial today and see what you&apos;ve been missing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-2xl transition-all"
              >
                Start My Free 14-Day Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-sm text-slate-400">
              Card not charged during trial &middot; Set up in under 5 minutes &middot; Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
