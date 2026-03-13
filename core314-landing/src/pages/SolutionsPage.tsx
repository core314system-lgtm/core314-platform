import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Eye,
  CheckCircle,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const solutions = [
  {
    icon: TrendingUp,
    title: 'Sales & Revenue Operations',
    desc: 'Detect pipeline risks before they become lost revenue. Core314 monitors deal velocity, follow-up gaps, and forecast deviations across your CRM.',
    signals: [
      'Stalled deals with no recent activity',
      'Pipeline velocity slowdowns by stage',
      'Deal stage regression patterns',
      'Follow-up gaps on high-value opportunities',
      'Forecast deviation detection',
    ],
  },
  {
    icon: DollarSign,
    title: 'Finance & Cash Flow',
    desc: 'Monitor invoice patterns, payment behavior, and expense anomalies across your financial systems to maintain healthy cash flow.',
    signals: [
      'Invoice payment delays and aging trends',
      'Expense categorization anomalies',
      'Cash flow pattern shifts',
      'New vendor account activity',
      'Payment irregularity detection',
    ],
  },
  {
    icon: MessageSquare,
    title: 'Communication Intelligence',
    desc: 'Understand how your teams communicate and collaborate. Detect escalation spikes, response time degradation, and cross-team communication patterns.',
    signals: [
      'Communication volume pattern changes',
      'Cross-team escalation frequency',
      'Response time degradation',
      'Channel activity anomalies',
      'Collaboration pattern shifts',
    ],
  },
  {
    icon: Eye,
    title: 'Executive Operations',
    desc: 'Get the full operational picture without digging through multiple dashboards. AI-generated briefs give leadership clear, written intelligence.',
    signals: [
      'Cross-system operational health scoring',
      'Failure pattern detection across systems',
      'Operational momentum tracking',
      'Risk-prioritized action recommendations',
      'Weekly operational trend analysis',
    ],
  },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">Solutions</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Operational Intelligence for Every Business Function
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Core314 detects signals across sales, finance, communication, and executive operations. One platform, complete visibility.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-8">
            {solutions.map((sol, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                  <div>
                    <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center mb-4">
                      <sol.icon className="h-5 w-5 text-sky-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900">{sol.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{sol.desc}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Signals Detected</h4>
                    <ul className="space-y-2">
                      {sol.signals.map((sig, si) => (
                        <li key={si} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-sky-500 flex-shrink-0" />
                          {sig}
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Cross-System Intelligence</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The real power of Core314 is connecting signals across systems. A stalled deal in HubSpot combined with a Slack communication spike and an overdue invoice in QuickBooks tells a story no single tool can see.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            See Core314 in Action
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Connect your tools and receive your first Operational Brief. Understand what is actually happening inside your business.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Get Early Access <ArrowRight className="h-4 w-4" />
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
