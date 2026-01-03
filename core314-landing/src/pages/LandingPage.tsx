import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, Database, Zap, BarChart3, TrendingUp, Shield, CheckCircle, XCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { HeroIllustration } from '../components/illustrations';
import AppScreenshotCarousel from '../components/AppScreenshotCarousel';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <Header />
      {/* Hero Section - Light gradient with subtle accent */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50/50 to-white" />
          {/* Subtle decorative elements */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-200 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-20 text-center px-4 max-w-6xl mx-auto py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-8"
          >
            <img 
              src="/logo-icon.svg" 
              alt="Core314" 
              className="h-16 w-16 mx-auto"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="text-sky-600">
              Operational Control
            </span>
            <br />
            <span className="text-slate-800">for Scaling Businesses</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-slate-600 mb-8 max-w-4xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Core314 is an AI-powered operations platform that connects your systems, monitors performance in real time, and catches operational issues before they impact customers or revenue.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg text-slate-500 mb-10"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Connect your tools. Core314 handles the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex justify-center mb-12"
          >
            <Link
              to="/pricing"
              className="px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
            </Link>
          </motion.div>

          {/* Hero Illustration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mb-12"
          >
            <HeroIllustration />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="flex flex-col items-center gap-2 text-slate-400"
          >
            <span className="text-sm">Scroll to Discover</span>
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* App Screenshot Carousel */}
      <AppScreenshotCarousel />

      {/* Before vs After Core314 Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Before vs After Core314
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Before Core314 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <h3 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <XCircle className="h-8 w-8 text-red-500" />
                Before Core314
              </h3>
              <ul className="space-y-4">
                {[
                  "Constantly reacting to incidents after they happen",
                  "Manually checking dashboards across multiple tools",
                  "No visibility into cross-system dependencies",
                  "Automation runs without guardrails or oversight",
                  "Teams firefighting instead of improving"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <XCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* After Core314 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-sky-50 border border-sky-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <h3 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <CheckCircle className="h-8 w-8 text-sky-500" />
                After Core314
              </h3>
              <ul className="space-y-4">
                {[
                  "Catch issues before they impact customers",
                  "Unified operational view across all systems",
                  "Real-time visibility into how work actually flows",
                  "Automation with built-in governance and approval",
                  "Teams focused on growth, not firefighting"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Concrete Use Case Section */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm hover:shadow-lg transition-shadow duration-300"
          >
            <h3 className="text-2xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Real Example: Operations Team Managing 8+ Systems
            </h3>
            <p className="text-slate-600 mb-6 text-lg leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              A growing operations team juggles CRM, support tickets, billing, inventory, and fulfillment across multiple platforms. Before Core314:
            </p>
            <ul className="space-y-3 mb-6">
              {[
                "They discover SLA breaches hours after they happen",
                "No one knows when a fulfillment delay will cascade into support tickets",
                "Automation scripts run without anyone reviewing their impact"
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span className="text-red-400 font-bold">-</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-slate-600 mb-6 text-lg leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              With Core314:
            </p>
            <ul className="space-y-3">
              {[
                "Early signals surface before SLAs are breached",
                "Cross-system dependencies are visible in real time",
                "Automation actions require approval when risk is high"
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Who Core314 Is For Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Who Core314 Is For
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Is For */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-sky-50 border border-sky-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <h3 className="text-2xl font-bold mb-6 text-sky-700 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <CheckCircle className="h-8 w-8 text-sky-500" />
                Core314 Is For
              </h3>
              <ul className="space-y-4">
                {[
                  "Scaling businesses using multiple tools",
                  "Founders, operators, and operations leaders",
                  "Teams experiencing reactive firefighting",
                  "Organizations that want automation without losing control"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Is Not For */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <h3 className="text-2xl font-bold mb-6 text-slate-500 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <XCircle className="h-8 w-8 text-slate-400" />
                Core314 Is Not For
              </h3>
              <ul className="space-y-4">
                {[
                  "Very early-stage teams with minimal tooling",
                  "Dashboard-only reporting use cases",
                  "One-off automation scripts",
                  "Experiment-only AI tools"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-500 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <XCircle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How Core314 Works Section */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            How Core314 Works
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 text-center mb-16 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            A simple control loop for complex operations. Core314 does not replace your tools — it brings them under control.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Database,
                title: "Fuse & Score Your Operations",
                desc: "Core314 connects to your existing systems and continuously monitors how work actually flows across your business. It normalizes operational data across tools, correlates activity in real time, and generates clear operational scores that show what's working, what's drifting, and where risk is building — without relying on static dashboards or manual reporting."
              },
              {
                icon: TrendingUp,
                title: "Proactively Optimize Before Problems Occur",
                desc: "Instead of waiting for alerts or failures, Core314 detects early signs of inefficiency, overload, or instability. When performance begins to drift, Core314 automatically recommends or initiates corrective actions — such as reprioritizing work, rebalancing workflows, or escalating issues — before they impact customers or revenue."
              },
              {
                icon: Shield,
                title: "Govern Automation Safely and Intentionally",
                desc: "Automation without control creates risk. Core314 prevents that. Every automated action is evaluated against governance rules, risk thresholds, and operational context. Low-risk actions can execute automatically, while higher-risk actions require review or approval."
              }
            ].map((pillar, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                className="group relative bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:border-sky-200 transition-all duration-300"
              >
                <div className="bg-sky-100 rounded-xl w-16 h-16 flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                  <pillar.icon className="h-8 w-8 text-sky-600" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {pillar.title}
                </h3>
                <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {pillar.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            What to Expect After You Connect Your Systems
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                icon: Database,
                step: "1",
                title: "Connect Your Existing Tools",
                desc: "You connect the systems you already use. There is no data migration, no workflow replacement, and no forced reconfiguration."
              },
              {
                icon: BarChart3,
                step: "2",
                title: "Core314 Monitors and Scores Operations",
                desc: "Core314 observes how work flows across your systems and establishes operational baselines. During this phase, no actions are taken."
              },
              {
                icon: Zap,
                step: "3",
                title: "Optimization and Automation Are Introduced Gradually",
                desc: "You decide how Core314 acts — recommendations only, assisted execution, or governed automation within defined guardrails."
              },
              {
                icon: TrendingUp,
                step: "4",
                title: "Continuous Improvement Over Time",
                desc: "As outcomes are observed, Core314 continuously refines scoring, optimization, and governance behavior."
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="relative group"
              >
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-sky-200 transition-all duration-300 h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-sky-500 rounded-full w-12 h-12 flex items-center justify-center shadow-md">
                      <span className="text-xl font-bold text-white">{step.step}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {step.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {step.desc}
                  </p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-sky-400 z-10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12 L19 12 M19 12 L14 7 M19 12 L14 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 px-4 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50">
        {/* Subtle decorative background */}
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-8 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Take Control of Your Operations
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto space-y-4 leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <p>
              Core314 gives you operational control across your business by continuously monitoring, optimizing, and governing how work actually gets done.
            </p>
            <p className="text-slate-500">
              You don't need to change your stack. You don't need to rebuild workflows. You connect your systems — Core314 handles the rest.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            <Link
              to="/pricing"
              className="px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact"
              className="px-10 py-4 bg-white border-2 border-sky-500 text-sky-600 rounded-lg font-semibold text-lg hover:bg-sky-50 transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Contact Us
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-slate-500 text-sm"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            No disruption. No forced automation. Full control from day one.
          </motion.p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
