import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Plug, Eye, Brain, FileText, Zap, BarChart3, Shield } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const steps = [
  {
    number: '01',
    icon: Plug,
    title: 'Connect Your Systems',
    desc: 'Link Core314 to the tools your team already uses. Secure OAuth connections mean no passwords, no agents to install, and no workflow changes. Core314 connects in minutes.',
    details: ['HubSpot CRM', 'Slack', 'QuickBooks', 'More integrations coming soon'],
  },
  {
    number: '02',
    icon: Eye,
    title: 'Core314 Monitors Continuously',
    desc: 'Once connected, Core314 begins continuously monitoring your systems for operational signals. It watches deal velocity, communication patterns, financial activity, and more — without disrupting your team.',
    details: ['Deal pipeline changes', 'Invoice and payment patterns', 'Team communication activity', 'Cross-system correlations'],
  },
  {
    number: '03',
    icon: Brain,
    title: 'Signals Are Detected',
    desc: 'Core314 identifies meaningful operational signals across your connected systems. These are not generic alerts — they are specific patterns that indicate something important is happening inside your business.',
    details: ['Stalled deals and pipeline risks', 'Invoice aging anomalies', 'Communication escalation patterns', 'Revenue velocity changes'],
  },
  {
    number: '04',
    icon: FileText,
    title: 'Operational Briefs Are Generated',
    desc: 'Instead of raw data or dashboards, Core314 generates AI-powered Operational Briefs. Each brief explains what is happening, analyzes business impact, and provides specific recommended actions for leadership.',
    details: ['Operational Health Score (0–100)', 'Detected signals summary', 'Business impact narrative', 'Prioritized action items'],
  },
  {
    number: '05',
    icon: Zap,
    title: 'Leadership Takes Action',
    desc: 'Operational Briefs are delivered to the Command Center and optionally via Slack or email. Leadership reviews the brief, understands the current operational state, and takes action based on AI-generated recommendations.',
    details: ['Command Center dashboard', 'Slack delivery', 'Email delivery', 'Brief history and trend tracking'],
  },
];

const timeline = [
  { time: 'Day 1', label: 'Connect integrations and begin monitoring', icon: Plug },
  { time: 'Week 1', label: 'First operational signals detected across systems', icon: Eye },
  { time: 'Week 2', label: 'AI begins generating Operational Briefs with recommendations', icon: Brain },
  { time: 'Month 1', label: 'Signal trends and operational patterns become visible', icon: BarChart3 },
  { time: 'Ongoing', label: 'Continuous intelligence improves as more data flows through', icon: Zap },
];

export default function HowItWorksPage() {
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
            How Core314 Works
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            From connection to intelligence in five steps. Core314 transforms raw business
            data into clear, actionable Operational Briefs.
          </motion.p>
        </div>
      </section>

      {/* Intelligence Lifecycle Steps */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            The Intelligence Lifecycle
          </motion.h2>

          <div className="space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 md:p-10"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="bg-sky-500 text-white rounded-xl w-14 h-14 flex items-center justify-center font-bold text-lg"
                      style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {step.number}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-3 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {step.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {step.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {step.details.map((detail, i) => (
                        <span key={i} className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium">
                          {detail}
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

      {/* System Learning Timeline */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            System Learning Timeline
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-slate-600 text-center mb-16 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 gets smarter over time. Here is what to expect as the system learns your operations.
          </motion.p>

          <div className="space-y-6">
            {timeline.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-6 bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="bg-sky-100 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-6 w-6 text-sky-600" />
                </div>
                <div>
                  <span className="text-sky-600 font-bold text-sm uppercase tracking-wide">{item.time}</span>
                  <p className="text-slate-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>{item.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Alignment */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Choose Your Intelligence Level
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl text-slate-600 text-center mb-16 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Each tier builds on the previous one, giving you deeper operational intelligence as your needs grow.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                icon: Eye,
                name: 'Monitor',
                price: '$99/mo',
                focus: 'Early Warning',
                desc: 'Connect your systems and start detecting operational signals. Get your first Operational Briefs and Health Score.',
              },
              {
                icon: Brain,
                name: 'Intelligence',
                price: '$299/mo',
                focus: 'Understand',
                desc: 'Unlimited AI Operational Briefs, Command Center access, signal trend analysis, and executive brief delivery.',
                popular: true,
              },
              {
                icon: BarChart3,
                name: 'Command Center',
                price: '$799/mo',
                focus: 'Continuous Intelligence',
                desc: 'Advanced signal analytics, operational pattern detection, weekly executive reports, and early access to new integrations.',
              },
              {
                icon: Shield,
                name: 'Enterprise',
                price: 'Custom',
                focus: 'Infrastructure',
                desc: 'Custom integrations, dedicated onboarding, priority signal processing, SLA guarantees, and a dedicated success manager.',
              },
            ].map((tier, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-2xl p-6 border ${tier.popular ? 'border-sky-400 bg-sky-50 shadow-lg' : 'border-slate-200 bg-white'}`}
              >
                {tier.popular && (
                  <span className="inline-block px-3 py-1 bg-sky-500 text-white text-xs font-bold rounded-full mb-3">
                    Most Popular
                  </span>
                )}
                <div className="bg-sky-100 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                  <tier.icon className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {tier.name}
                </h3>
                <p className="text-sky-600 font-bold text-lg mb-1">{tier.price}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">{tier.focus}</p>
                <p className="text-slate-600 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {tier.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              View Full Pricing
              <ArrowRight className="h-5 w-5" />
            </Link>
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
            Ready to See Inside Your Operations?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Connect your systems and receive your first Operational Brief.
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
