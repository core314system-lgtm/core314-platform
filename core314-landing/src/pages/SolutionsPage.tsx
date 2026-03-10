import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, DollarSign, MessageSquare, Users, Brain, Eye, FileText } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const solutions = [
  {
    icon: TrendingUp,
    title: 'Sales & Revenue Operations',
    desc: 'Core314 monitors your CRM pipeline and detects signals that indicate revenue risk or opportunity. Stalled deals, pipeline velocity changes, and close-rate shifts are surfaced in Operational Briefs before they become visible in quarterly reports.',
    signals: ['Stalled deal detection', 'Pipeline velocity tracking', 'Deal stage regression alerts', 'Revenue forecast signals'],
  },
  {
    icon: DollarSign,
    title: 'Financial Operations',
    desc: 'Core314 connects to your accounting system and monitors invoice aging, payment patterns, and cash flow signals. Leadership receives clear briefs on financial health without waiting for month-end reports.',
    signals: ['Invoice aging anomalies', 'Payment pattern changes', 'Cash flow signal detection', 'Vendor payment tracking'],
  },
  {
    icon: MessageSquare,
    title: 'Team Communication Intelligence',
    desc: 'Core314 analyzes communication patterns across Slack to detect escalation signals, cross-department activity spikes, and engagement changes. These signals are correlated with sales and financial data for a complete operational picture.',
    signals: ['Communication volume patterns', 'Escalation signal detection', 'Cross-department activity', 'Engagement trend analysis'],
  },
  {
    icon: Users,
    title: 'Executive & Leadership Operations',
    desc: 'Core314 delivers AI-generated Operational Briefs directly to leadership. Instead of assembling reports from multiple systems, executives receive a single written brief explaining what is happening across the business and what actions to take.',
    signals: ['Operational Health Score', 'Cross-system signal correlation', 'Recommended action items', 'Weekly executive reports'],
  },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Operational Intelligence for Every Function
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 detects operational signals across sales, finance, and communication systems.
            Every function gets the intelligence it needs to act.
          </motion.p>
        </div>
      </section>

      {/* Solution Categories */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto space-y-16">
          {solutions.map((solution, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8 md:p-10"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center">
                    <solution.icon className="h-7 w-7 text-sky-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {solution.title}
                  </h3>
                  <p className="text-lg text-slate-600 leading-relaxed mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {solution.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {solution.signals.map((signal, i) => (
                      <span key={i} className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium">
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It All Connects */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Cross-System Intelligence
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              The real power of Core314 is connecting signals across systems. A stalled deal in HubSpot,
              an overdue invoice in QuickBooks, and a spike in Slack escalations might all be related.
              Core314 connects those dots.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Eye,
                title: 'Signal Detection',
                desc: 'Core314 monitors each connected system independently, detecting signals within sales, finance, and communication data.',
              },
              {
                icon: Brain,
                title: 'Cross-System Correlation',
                desc: 'Signals from different systems are correlated to identify patterns that would be invisible when looking at each system in isolation.',
              },
              {
                icon: FileText,
                title: 'Unified Operational Brief',
                desc: 'All correlated signals are synthesized into a single Operational Brief with a health score, impact analysis, and recommended actions.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                  <item.icon className="h-7 w-7 text-sky-600" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {item.title}
                </h3>
                <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Your Business Already Has the Data
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 tells you what it means. Connect your tools and receive your first Operational Brief.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/contact"
              className="px-10 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-semibold text-lg shadow-sm hover:shadow-md transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Contact Sales
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
