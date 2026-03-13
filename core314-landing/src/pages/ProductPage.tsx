import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  MessageSquare,
  DollarSign,
  FileText,
  BarChart3,
  Shield,
  Lock,
  Eye,
  Server,
  Activity,
  Zap,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const capabilities = [
  {
    icon: Activity,
    title: 'Signal Detection',
    desc: 'Core314 monitors connected systems and detects operational signals across revenue, communication, and financial activity. Signals are classified by severity and category.',
  },
  {
    icon: FileText,
    title: 'Operational Briefs',
    desc: 'AI-generated written intelligence explaining what is happening inside your business, why it matters, and what actions leadership should take. Not a dashboard — a brief.',
  },
  {
    icon: BarChart3,
    title: 'Health Scoring',
    desc: 'Every brief includes an Operational Health Score from 0\u2013100, giving leadership an instant measure of business health based on real cross-system data.',
  },
  {
    icon: Zap,
    title: 'Pattern Detection',
    desc: 'Core314 identifies failure patterns across systems — like revenue pipeline stagnation or communication breakdowns — before they become visible in any single tool.',
  },
];

const integrations = [
  { name: 'HubSpot', icon: Briefcase, desc: 'CRM pipeline, deal activity, contact engagement, and revenue signals.' },
  { name: 'Slack', icon: MessageSquare, desc: 'Communication patterns, channel activity, response times, and team collaboration signals.' },
  { name: 'QuickBooks', icon: DollarSign, desc: 'Invoice status, payment patterns, expense trends, and cash flow signals.' },
];

const security = [
  { icon: Lock, title: 'OAuth-Only', desc: 'No passwords stored. Secure token-based connections with limited scopes.' },
  { icon: Shield, title: 'SOC 2 Aligned', desc: 'Security practices aligned with SOC 2 standards for data handling.' },
  { icon: Server, title: 'Encrypted', desc: 'TLS 1.3 in transit, AES-256 at rest. Data never shared or sold.' },
  { icon: Eye, title: 'Read-Only', desc: 'Core314 reads data only. Never modifies anything in your systems.' },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">Product</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Operational Intelligence Platform for Leadership Teams
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed mb-8">
              Core314 connects your business systems, detects operational signals, and delivers written intelligence so leadership always knows what is happening and what to do next.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
                Get Early Access <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
                See How It Works
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">What Core314 Does</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Core314 turns fragmented operational data into clear, actionable intelligence for leadership teams.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {capabilities.map((cap, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
                <div className="bg-sky-50 rounded-lg w-10 h-10 flex items-center justify-center mb-4">
                  <cap.icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-900">{cap.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Connected Systems</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Core314 reads data from the platforms your team already uses. No migration. No disruption.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {integrations.map((int, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-slate-200 rounded-xl p-6 text-center hover:border-sky-200 hover:shadow-md transition-all duration-200">
                <div className="bg-sky-50 rounded-lg w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <int.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{int.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{int.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Enterprise-Grade Security</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Your business data is sensitive. Security is built into the foundation of Core314.</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {security.map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-5">
                <div className="bg-slate-100 rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <s.icon className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to See What Your Business Is Telling You?
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Connect your tools and receive your first Operational Brief. No credit card required for trial.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
              Get Early Access <ArrowRight className="h-4 w-4" />
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
