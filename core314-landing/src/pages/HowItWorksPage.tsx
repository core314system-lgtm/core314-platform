import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Target,
  BarChart3,
  FileText,
  Zap,
  Clock,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

const steps = [
  {
    num: '01',
    icon: Target,
    title: 'Connect Your Business Tools',
    desc: 'Link your business tools to Core314 using secure OAuth — HubSpot, Slack, QuickBooks, Jira, Salesforce, and 11 more. No passwords stored, no data migration. Core314 reads data only — it never modifies anything in your systems.',
    detail: 'Setup takes less than 5 minutes per integration. Core314 supports 16 integrations across CRM, communication, finance, project management, and more.',
  },
  {
    num: '02',
    icon: BarChart3,
    title: 'Core314 Detects Operational Signals',
    desc: 'Our AI continuously monitors your connected systems and identifies operational patterns, risks, and anomalies across revenue, communication, and financial activity.',
    detail: 'Signals are classified by severity (high, medium, low) and category (revenue risk, operational activity, financial behavior).',
  },
  {
    num: '03',
    icon: FileText,
    title: 'Receive Your Operational Brief',
    desc: 'Core314 generates written Operational Briefs that explain what is happening inside your business, why it matters, and what actions leadership should take next.',
    detail: 'Each brief includes an Operational Health Score (0\u2013100), detected signals, business impact analysis, and recommended actions.',
  },
  {
    num: '04',
    icon: Zap,
    title: 'Act with Confidence',
    desc: 'Make informed leadership decisions backed by cross-system intelligence. No more guessing, no more relying on incomplete status reports from individual tools.',
    detail: 'Core314 continuously learns your operational patterns and improves signal detection accuracy over time.',
  },
];

const timeline = [
  { time: 'Day 1', label: 'Connect integrations and begin data ingestion' },
  { time: 'Day 2\u20133', label: 'Core314 establishes baseline operational patterns' },
  { time: 'Day 4\u20137', label: 'First Operational Briefs generated with signal detection' },
  { time: 'Week 2+', label: 'Pattern detection improves as more operational data is analyzed' },
  { time: 'Week 4+', label: 'Full operational intelligence with failure pattern detection' },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">How It Works</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              From Connection to Clarity in Four Steps
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Core314 connects to your existing business tools, detects operational signals, and delivers written intelligence. No disruption to your workflows.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-8">
            {steps.map((step, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <div className="text-sky-500/20 text-3xl font-extrabold leading-none">{step.num}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-sky-50 rounded-lg w-9 h-9 flex items-center justify-center">
                        <step.icon className="h-5 w-5 text-sky-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">{step.desc}</p>
                    <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">{step.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Intelligence Timeline</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Core314 begins working immediately. Intelligence quality improves as more operational data is analyzed.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-4">
            {timeline.map((t, i) => (
              <motion.div key={i} variants={fadeUp} className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 flex-shrink-0 w-28">
                  <Clock className="h-4 w-4 text-sky-500" />
                  <span className="text-sm font-bold text-slate-900">{t.time}</span>
                </div>
                <p className="text-sm text-slate-600">{t.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to Get Started?
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Connect your first integration and receive your first Operational Brief. Setup takes less than 5 minutes.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              View Pricing
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
