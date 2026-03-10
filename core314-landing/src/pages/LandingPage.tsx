import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MessageSquare,
  DollarSign,
  Eye,
  AlertTriangle,
  TrendingUp,
  Zap,
  Shield,
  ArrowRight,
  ChevronRight,
  BarChart3,
  Clock,
  Target,
  FileText,
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

const problemCards = [
  {
    icon: Briefcase,
    title: 'CRM Shows Sales Activity',
    desc: 'Deals, pipeline stages, and follow-ups live in HubSpot — but leadership only sees snapshots.',
  },
  {
    icon: MessageSquare,
    title: 'Slack Shows Communication',
    desc: 'Team conversations, escalations, and cross-department patterns are invisible to decision-makers.',
  },
  {
    icon: DollarSign,
    title: 'Accounting Shows Financials',
    desc: 'Invoices, payments, and cash flow sit in QuickBooks — disconnected from operational context.',
  },
];

const solutionCards = [
  {
    icon: Eye,
    title: 'Watches Your Operations',
    desc: 'Core314 continuously monitors signals from your connected tools without disrupting workflows.',
  },
  {
    icon: AlertTriangle,
    title: 'Detects Signals',
    desc: 'Pattern detection identifies stalled deals, communication spikes, invoice delays, and more.',
  },
  {
    icon: FileText,
    title: 'Explains What Is Happening',
    desc: 'AI generates a written Operational Brief — like a business analyst who never sleeps.',
  },
  {
    icon: Zap,
    title: 'Tells You What To Do',
    desc: 'Every brief includes specific, actionable recommendations prioritized by business impact.',
  },
];

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

const howItWorksSteps = [
  {
    step: '01',
    title: 'Connect Your Tools',
    desc: 'Link HubSpot, Slack, and QuickBooks in minutes. No migration, no workflow changes. Secure OAuth connections.',
    icon: Target,
  },
  {
    step: '02',
    title: 'Core314 Detects Signals',
    desc: 'The platform continuously monitors your tools, detecting operational patterns, risks, and anomalies automatically.',
    icon: BarChart3,
  },
  {
    step: '03',
    title: 'Receive Operational Briefings',
    desc: 'Get AI-generated Operational Briefs that explain what is happening and what to do next — delivered daily or on-demand.',
    icon: Clock,
  },
];

const benefitCards = [
  {
    icon: AlertTriangle,
    title: 'Detect Problems Early',
    desc: 'Surface operational risks before they become crises. Catch stalled deals, payment delays, and communication bottlenecks.',
  },
  {
    icon: TrendingUp,
    title: 'Understand Operational Patterns',
    desc: 'See the full picture across sales, communication, and finance — not just isolated metrics in separate dashboards.',
  },
  {
    icon: Shield,
    title: 'Make Better Leadership Decisions',
    desc: 'Every decision backed by cross-system intelligence. No more guessing what is happening inside your business.',
  },
  {
    icon: DollarSign,
    title: 'Prevent Revenue Loss',
    desc: 'Identify revenue risks from pipeline slowdowns, invoice aging, and operational bottlenecks before they impact the bottom line.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <Header />

      {/* ===== HERO SECTION ===== */}
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
            <span className="text-slate-900">Understand What Is</span>
            <br />
            <span className="text-sky-600">Actually Happening</span>
            <br />
            <span className="text-slate-900">Inside Your Business.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-slate-600 mb-4 max-w-4xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Core314 analyzes your HubSpot pipeline, Slack communication, and QuickBooks financial data to detect operational risks and opportunities automatically.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg text-slate-500 mb-10 max-w-3xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            No dashboards to check. No reports to build. Just clear, written intelligence delivered to you.
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
              Connect Your Business
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>

          {/* Integration Logos */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex items-center justify-center gap-8 text-slate-400"
          >
            <span className="text-sm font-medium uppercase tracking-wider">Works with</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-slate-500">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">Slack</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Briefcase className="h-5 w-5" />
                <span className="font-medium">HubSpot</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <DollarSign className="h-5 w-5" />
                <span className="font-medium">QuickBooks</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== PROBLEM SECTION ===== */}
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
              Your Business Runs on Disconnected Tools
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Leadership cannot see the full operational picture. Critical signals are buried across platforms that never talk to each other.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {problemCards.map((card, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <card.icon className="h-10 w-10 text-slate-400 mb-4" />
                <h3
                  className="text-xl font-bold mb-3 text-slate-800"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {card.title}
                </h3>
                <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SOLUTION SECTION ===== */}
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
              Core314 Connects Your Tools and
              <br />
              <span className="text-sky-600">Explains What Is Happening</span>
            </h2>
            <p
              className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              An AI-powered operational intelligence layer that observes your business systems and produces clear, written explanations — like having an analyst who never sleeps.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {solutionCards.map((card, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-white border border-sky-100 rounded-2xl p-6 hover:shadow-lg hover:border-sky-200 transition-all duration-300"
              >
                <div className="bg-sky-50 rounded-xl w-12 h-12 flex items-center justify-center mb-4">
                  <card.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3
                  className="text-lg font-bold mb-2 text-slate-800"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {card.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== OPERATIONAL BRIEF EXAMPLE ===== */}
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

      {/* ===== HOW IT WORKS ===== */}
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
              Three simple steps. No disruption to your existing workflows.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {howItWorksSteps.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg hover:border-sky-200 transition-all duration-300 h-full">
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
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-sky-300 z-10">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== BENEFITS SECTION ===== */}
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
              Why Business Leaders Choose Core314
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {benefitCards.map((card, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-sky-50 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <card.icon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <h3
                      className="text-xl font-bold mb-2 text-slate-800"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
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
            Your business already has the data.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl text-sky-600 font-semibold mb-8"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Core314 tells you what it means.
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
