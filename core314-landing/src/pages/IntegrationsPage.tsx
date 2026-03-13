import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  MessageSquare,
  DollarSign,
  CheckCircle,
  Code,
  Users,
  BarChart3,
  FileText,
  Globe,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const current = [
  {
    name: 'HubSpot',
    icon: Briefcase,
    category: 'CRM',
    desc: 'Monitor deal pipeline, contact engagement, and revenue signals. Core314 detects stalled deals, pipeline velocity changes, and forecast deviations.',
    dataPoints: ['Deal activity and stage progression', 'Contact engagement history', 'Pipeline velocity metrics', 'Revenue forecast data'],
  },
  {
    name: 'Slack',
    icon: MessageSquare,
    category: 'Communication',
    desc: 'Analyze team communication patterns, channel activity, and response times. Detect escalation spikes and collaboration changes.',
    dataPoints: ['Channel message volume', 'Response time patterns', 'Cross-team communication', 'Escalation frequency'],
  },
  {
    name: 'QuickBooks',
    icon: DollarSign,
    category: 'Finance',
    desc: 'Track invoice patterns, payment behavior, and expense trends. Detect cash flow anomalies and vendor payment irregularities.',
    dataPoints: ['Invoice status and aging', 'Payment timing patterns', 'Expense categorization', 'Cash flow indicators'],
  },
];

const upcoming = [
  { name: 'Salesforce', icon: BarChart3 },
  { name: 'Microsoft Teams', icon: Users },
  { name: 'Jira', icon: FileText },
  { name: 'Stripe', icon: DollarSign },
  { name: 'Google Workspace', icon: Globe },
  { name: 'Xero', icon: DollarSign },
];

const howItWorks = [
  { title: 'OAuth Connection', desc: 'Secure token-based authentication. No passwords stored. Limited scope access.' },
  { title: 'Read-Only Access', desc: 'Core314 only reads data. It never modifies, writes, or deletes anything in your tools.' },
  { title: 'Continuous Monitoring', desc: 'Data is polled on a regular schedule. Signals are detected and classified automatically.' },
  { title: 'Signal Detection', desc: 'AI analyzes cross-system data to identify patterns, risks, and operational anomalies.' },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">Integrations</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Connect the Tools Your Team Already Uses
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Core314 integrates with your business systems via secure OAuth. No migration, no disruption. Setup takes less than 5 minutes.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Available Integrations</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Phase 1 integrations are live and available for all plans.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-6">
            {current.map((int, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center">
                        <int.icon className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{int.name}</h3>
                        <span className="text-xs text-slate-500">{int.category}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium ml-auto">
                        <CheckCircle className="h-3.5 w-3.5" /> Available
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{int.desc}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Data Points</h4>
                    <ul className="space-y-2">
                      {int.dataPoints.map((dp, di) => (
                        <li key={di} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-sky-500 flex-shrink-0" />
                          {dp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Coming Soon</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Core314 is designed to grow with your operational stack. More integrations are in development.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {upcoming.map((int, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div className="bg-white rounded-lg w-10 h-10 flex items-center justify-center mx-auto mb-2 border border-slate-200">
                  <int.icon className="h-5 w-5 text-slate-400" />
                </div>
                <h4 className="text-xs font-semibold text-slate-700">{int.name}</h4>
                <span className="text-xs text-slate-400">Coming Soon</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How Integrations Work</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {howItWorks.map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="mt-8 bg-white border border-slate-200 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Code className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-900">API-First Architecture</h3>
            </div>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              Core314 is built on an API-first architecture. Custom integrations are available on the Enterprise plan for organizations with proprietary or industry-specific systems.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Connect Your Tools Today
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Start with HubSpot, Slack, and QuickBooks. Receive your first Operational Brief within days.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Get Early Access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              Request an Integration
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
