import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, BarChart3, Shield, Brain, FileText, Eye, ArrowRight, MessageSquare, Briefcase, DollarSign } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            AI Operational Intelligence Platform
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 connects your business systems, detects operational signals, and generates
            AI-powered Operational Briefs that explain what is happening inside your company.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/pricing"
              className="inline-block px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact?demo=true"
              className="px-10 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-semibold text-lg shadow-sm hover:shadow-md transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Book Demo
            </Link>
          </motion.div>
        </div>
      </section>

      {/* What Core314 Does */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Operational Intelligence, Not Another Dashboard
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 is not a BI tool or monitoring platform. It is an AI-powered operational
              intelligence layer that continuously observes your business systems and produces
              clear, written explanations of what is happening.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Eye,
                title: 'Continuous Monitoring',
                desc: 'Core314 watches your connected systems around the clock, detecting changes in sales activity, financial patterns, and team communication without disrupting workflows.',
              },
              {
                icon: Brain,
                title: 'Signal Detection',
                desc: 'The platform identifies operational signals — stalled deals, invoice anomalies, communication spikes — and correlates them across systems to build a complete operational picture.',
              },
              {
                icon: FileText,
                title: 'AI Operational Briefs',
                desc: 'Instead of dashboards and charts, Core314 generates written Operational Briefs that explain what is happening, why it matters, and what leadership should do about it.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                  <item.icon className="h-7 w-7 text-sky-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
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

      {/* Connected Systems */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Your Business Systems, Connected
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 ingests signals from the tools your team already uses. No migration, no workflow changes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Briefcase,
                title: 'HubSpot CRM',
                desc: 'Monitor pipeline velocity, detect stalled deals, track deal progression, and identify revenue risks before they impact the bottom line.',
              },
              {
                icon: MessageSquare,
                title: 'Slack',
                desc: 'Analyze team communication patterns, detect escalation signals, identify cross-department activity spikes, and surface buried operational insights.',
              },
              {
                icon: DollarSign,
                title: 'QuickBooks',
                desc: 'Track invoice aging, detect payment anomalies, monitor cash flow patterns, and correlate financial signals with operational activity.',
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

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-slate-500 mt-8 text-sm"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Upcoming: Salesforce, Microsoft Teams, Jira, Stripe, and Google Workspace.
          </motion.p>
        </div>
      </section>

      {/* The Operational Brief */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              The Operational Brief
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Not a dashboard. Not a chart. A clear, written explanation of what is happening
              inside your business — generated by AI from real operational data.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Zap,
                title: 'Detected Signals',
                desc: 'Every brief starts with the operational signals Core314 has detected across your connected systems — stalled deals, payment delays, communication patterns, and more.',
              },
              {
                icon: BarChart3,
                title: 'Operational Health Score',
                desc: 'A composite score (0–100) reflecting the overall health of your operations, calculated from signals detected across all connected systems.',
              },
              {
                icon: Brain,
                title: 'Business Impact Analysis',
                desc: 'AI-generated narrative explaining what the detected signals mean for your business, connecting dots across systems that would be invisible in isolated dashboards.',
              },
              {
                icon: Shield,
                title: 'Recommended Actions',
                desc: 'Every brief includes specific, prioritized recommendations so leadership knows exactly what to do next — not just what happened.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-sky-50 border border-sky-200 rounded-2xl p-8"
              >
                <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                  <item.icon className="h-7 w-7 text-sky-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
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

      {/* Command Center */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Command Center
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              A single view of your entire operational landscape. See health scores, active signals,
              and the latest Operational Briefs in one place.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Operational Health Score',
                desc: 'A real-time composite score reflecting the health of your operations across all connected systems. See at a glance whether things are running smoothly or need attention.',
              },
              {
                title: 'Signal Dashboard',
                desc: 'View all detected operational signals in one place — categorized by severity, source, and type. Track signal trends over time to identify recurring patterns.',
              },
              {
                title: 'Brief History',
                desc: 'Access current and past Operational Briefs. Compare how your operational landscape has changed over time and track whether recommended actions produced results.',
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

      {/* Security & Architecture */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Built for Security and Reliability
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 uses secure OAuth connections, encrypted data handling, and enterprise-grade infrastructure.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Secure by Design',
                desc: 'All integrations use OAuth 2.0 authentication. Data is encrypted in transit and at rest. No passwords stored.',
              },
              {
                icon: Eye,
                title: 'Read-Only Access',
                desc: 'Core314 observes your systems through read-only connections. It never modifies your data or disrupts your workflows.',
              },
              {
                icon: BarChart3,
                title: 'Reliable Infrastructure',
                desc: 'Built on cloud infrastructure with redundancy and failover. Designed for consistent performance and high availability.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
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

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            See What Your Business Is Telling You
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Connect your tools and receive your first Operational Brief.
            Trial begins after your first integration is connected.
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
