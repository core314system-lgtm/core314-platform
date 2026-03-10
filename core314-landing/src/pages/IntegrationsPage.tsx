import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Eye, Zap, MessageSquare, Briefcase, DollarSign, Code } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const currentIntegrations = [
  {
    icon: Briefcase,
    name: 'HubSpot',
    category: 'CRM',
    status: 'Available',
    desc: 'Monitor pipeline velocity, detect stalled deals, track deal progression, and identify revenue risks. Core314 connects via secure OAuth and reads deal, contact, and company data.',
    signals: ['Deal velocity changes', 'Stalled deal detection', 'Pipeline stage regression', 'Revenue forecast signals'],
  },
  {
    icon: MessageSquare,
    name: 'Slack',
    category: 'Communication',
    status: 'Available',
    desc: 'Analyze team communication patterns, detect escalation signals, identify cross-department activity spikes, and surface buried operational insights from your team conversations.',
    signals: ['Communication volume patterns', 'Escalation detection', 'Cross-team activity', 'Engagement trends'],
  },
  {
    icon: DollarSign,
    name: 'QuickBooks',
    category: 'Finance',
    status: 'Available',
    desc: 'Track invoice aging, detect payment anomalies, monitor cash flow patterns, and correlate financial signals with operational activity across your other connected systems.',
    signals: ['Invoice aging anomalies', 'Payment pattern changes', 'Cash flow signals', 'Vendor payment tracking'],
  },
];

const upcomingIntegrations = [
  { name: 'Salesforce', category: 'CRM' },
  { name: 'Microsoft Teams', category: 'Communication' },
  { name: 'Jira', category: 'Project Management' },
  { name: 'Stripe', category: 'Payments' },
  { name: 'Google Workspace', category: 'Productivity' },
  { name: 'Xero', category: 'Finance' },
];

export default function IntegrationsPage() {
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
            Integrations
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 connects to the tools your team already uses. Secure OAuth connections,
            read-only access, and zero workflow disruption.
          </motion.p>
        </div>
      </section>

      {/* Current Integrations */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Available Integrations
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-slate-600 text-center mb-16 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Connect these systems today and begin receiving operational signals and AI-powered briefs.
          </motion.p>

          <div className="space-y-8">
            {currentIntegrations.map((integration, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center">
                      <integration.icon className="h-7 w-7 text-sky-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {integration.name}
                      </h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                        {integration.status}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-medium">
                        {integration.category}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {integration.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {integration.signals.map((signal, i) => (
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
        </div>
      </section>

      {/* Upcoming Integrations */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Coming Soon
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-slate-600 text-center mb-16 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            We are actively building integrations with these platforms. Command Center tier members get early access.
          </motion.p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {upcomingIntegrations.map((integration, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-slate-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {integration.name}
                </h3>
                <span className="text-sm text-slate-500">{integration.category}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How Integrations Work */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            How Integrations Work
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Secure OAuth Connection',
                desc: 'All integrations use OAuth 2.0. You authorize Core314 through the provider\'s own consent screen. No passwords are shared or stored.',
              },
              {
                icon: Eye,
                title: 'Read-Only Monitoring',
                desc: 'Core314 requests only read access to your data. It never creates, modifies, or deletes anything in your connected systems.',
              },
              {
                icon: Zap,
                title: 'Continuous Signal Ingestion',
                desc: 'Once connected, Core314 continuously polls your systems for new data. Operational signals are detected automatically and fed into the intelligence engine.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8"
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

      {/* API-First Note */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mx-auto mb-6">
              <Code className="h-7 w-7 text-sky-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Need a Custom Integration?
            </h2>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Enterprise customers can work with our team to build custom integrations for proprietary systems.
              Core314 is built on an API-first architecture designed for extensibility.
            </p>
            <Link
              to="/contact?plan=enterprise"
              className="inline-flex items-center gap-2 px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Contact Enterprise Sales
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
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
            Connect Your Systems Today
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Start with HubSpot, Slack, or QuickBooks. Your trial begins after your first integration is connected.
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
