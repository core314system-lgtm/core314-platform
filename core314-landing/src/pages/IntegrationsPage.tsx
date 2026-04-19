import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Lock,
  Eye,
  Server,
  Clock,
  CheckCircle,
  ChevronDown,
  Zap,
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

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const integrations = [
  { name: 'Slack', Logo: SlackLogo, category: 'Communication', desc: 'Monitor team communication patterns, escalation frequency, and response times across channels.' },
  { name: 'HubSpot', Logo: HubSpotLogo, category: 'CRM', desc: 'Track deal pipeline velocity, follow-up gaps, deal stage regression, and forecast risks.' },
  { name: 'QuickBooks', Logo: QuickBooksLogo, category: 'Finance', desc: 'Detect invoice payment delays, expense anomalies, cash flow shifts, and vendor payment patterns.' },
  { name: 'Google Calendar', Logo: GoogleCalendarLogo, category: 'Scheduling', desc: 'Analyze meeting patterns, availability bottlenecks, and scheduling conflicts across teams.' },
  { name: 'Gmail', Logo: GmailLogo, category: 'Communication', desc: 'Track email response times, communication volume shifts, and thread escalation patterns.' },
  { name: 'Jira', Logo: JiraLogo, category: 'Project Management', desc: 'Monitor sprint velocity, blocked tickets, scope creep, and delivery timeline risks.' },
  { name: 'Trello', Logo: TrelloLogo, category: 'Project Management', desc: 'Track board activity, card aging, bottleneck columns, and team throughput patterns.' },
  { name: 'Microsoft Teams', Logo: TeamsLogo, category: 'Communication', desc: 'Detect communication spikes, cross-team collaboration patterns, and meeting overload signals.' },
  { name: 'Google Sheets', Logo: GoogleSheetsLogo, category: 'Data', desc: 'Monitor spreadsheet-based workflows, data entry patterns, and manual process bottlenecks.' },
  { name: 'Asana', Logo: AsanaLogo, category: 'Project Management', desc: 'Track task completion rates, overdue work, workload distribution, and project health signals.' },
  { name: 'Salesforce', Logo: SalesforceLogo, category: 'CRM', desc: 'Monitor opportunity pipeline, lead conversion rates, account health, and revenue forecasting signals.' },
  { name: 'Zoom', Logo: ZoomLogo, category: 'Communication', desc: 'Analyze meeting frequency, duration patterns, attendee engagement, and scheduling efficiency.' },
  { name: 'GitHub', Logo: GitHubLogo, category: 'Development', desc: 'Track pull request velocity, code review bottlenecks, deployment frequency, and development health.' },
  { name: 'Zendesk', Logo: ZendeskLogo, category: 'Support', desc: 'Monitor ticket volume, response times, escalation patterns, and customer satisfaction trends.' },
  { name: 'Notion', Logo: NotionLogo, category: 'Knowledge', desc: 'Track documentation activity, knowledge base gaps, and team collaboration on shared workspaces.' },
  { name: 'Monday.com', Logo: MondayLogo, category: 'Project Management', desc: 'Monitor workflow automation health, board activity, deadline tracking, and team productivity signals.' },
];

const categories = ['All', 'CRM', 'Communication', 'Finance', 'Project Management', 'Development', 'Support', 'Data', 'Knowledge', 'Scheduling'];

const connectionSteps = [
  { num: '1', title: 'Click Connect', desc: 'Select any integration from your dashboard and click the connect button.' },
  { num: '2', title: 'Authorize via OAuth', desc: 'Securely authorize Core314 with read-only access. No passwords stored.' },
  { num: '3', title: 'Signals Start Flowing', desc: 'Core314 immediately begins detecting operational signals from your connected tool.' },
];

const faqs = [
  {
    q: 'How do integrations connect?',
    a: 'All integrations use OAuth for secure, one-click connection. You authorize Core314 with read-only access to your tool, and signals start flowing immediately. No API keys, no passwords, no IT team required.',
  },
  {
    q: 'Is my data safe when connected?',
    a: 'Absolutely. Core314 uses read-only OAuth connections — we never modify, write, or delete anything in your tools. All data is encrypted in transit and at rest. Your data is never shared or sold.',
  },
  {
    q: 'Can I disconnect an integration?',
    a: 'Yes, you can disconnect any integration at any time from your dashboard. When disconnected, Core314 immediately stops accessing that tool and removes any cached data.',
  },
  {
    q: 'How many integrations can I connect?',
    a: 'It depends on your plan: Intelligence allows 3 integrations, Command Center allows 10, and Enterprise allows unlimited. You choose which ones matter most to your business.',
  },
  {
    q: 'What kind of signals does Core314 detect?',
    a: 'Core314 detects three categories of signals: revenue risk signals (pipeline issues, deal stalls), operational activity signals (bottlenecks, communication spikes), and financial behavior signals (payment delays, expense anomalies).',
  },
  {
    q: 'Are new integrations being added?',
    a: 'Yes. We are continuously adding new integrations based on customer requests. If you need a specific tool that is not listed, contact us and we will prioritize it.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
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

export default function IntegrationsPage() {
  const [filter, setFilter] = useState('All');
  const filtered = filter === 'All' ? integrations : integrations.filter((i) => i.category === filter);

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
            16+ Integrations &middot; One-Click Connect
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            Connect Your Tools.{' '}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">Get Intelligence.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4"
          >
            Core314 integrates with the platforms your team already uses — turning scattered data into
            clear operational intelligence.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-6 text-sm text-slate-500"
          >
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Read-only access</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> OAuth secured</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> No migration needed</span>
          </motion.div>
        </div>
      </section>

      {/* INTEGRATION GRID */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === cat ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {filtered.map((intg) => (
              <motion.div
                key={intg.name}
                variants={fadeUp}
                transition={{ duration: 0.3 }}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-sky-200 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <intg.Logo className="w-10 h-10 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{intg.name}</h3>
                    <span className="text-xs text-slate-400">{intg.category}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{intg.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW CONNECTION WORKS */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-sky-600 text-sm font-bold uppercase tracking-wider mb-3">Simple Setup</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Connect in Under 60 Seconds
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              No IT team. No migration. No disruption. Just click, authorize, and go.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {connectionSteps.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-sky-600/20">
                  <span className="text-2xl font-extrabold text-white">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Security-First Integration Design
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Every integration is built with security at the foundation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Lock, title: 'OAuth Only', desc: 'No passwords stored. Secure token-based connections.' },
              { icon: Eye, title: 'Read-Only', desc: 'We never modify, write, or delete your data.' },
              { icon: Server, title: 'Encrypted', desc: 'TLS 1.3 in transit. AES-256 at rest.' },
              { icon: Shield, title: 'SOC 2 Aligned', desc: 'Following enterprise security best practices.' },
            ].map((s, i) => (
              <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-5 text-center">
                <s.icon className="h-6 w-6 text-green-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-xs text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Integration FAQ</h2>
            <p className="text-lg text-slate-600">Common questions about connecting your tools.</p>
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
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              14-Day Risk-Free Trial
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Connect Your Tools Today
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Start your free trial and connect your first integrations in under 5 minutes.
              See what operational intelligence looks like for your business.
            </p>
            <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-2xl transition-all">
              Start My Free 14-Day Trial
              <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <p className="text-sm text-slate-400 mt-4">Card not charged during trial &middot; Cancel anytime</p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
