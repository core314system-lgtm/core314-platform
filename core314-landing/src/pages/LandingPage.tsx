import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, Database, Zap, BarChart3, TrendingUp, Shield, CheckCircle, XCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white overflow-hidden">
      <Header />
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00BFFF]/20 via-transparent to-transparent animate-pulse" />
          </div>
          {/* Animated particles */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-[#66FCF1] rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.2, 0.8, 0.2],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(10,15,26,0.8)] to-[#0A0F1A]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 text-center px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="mb-12"
          >
            <img 
              src="/logo.png" 
              alt="Core314" 
              className="h-40 mx-auto mb-8"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(0, 191, 255, 0.6))',
                animation: 'pulse-glow 3s ease-in-out infinite'
              }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] via-[#66FCF1] to-[#00BFFF] bg-clip-text text-transparent">
              Operational Control
            </span>
            <br />
            <span className="text-white">for Scaling Businesses</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Core314 continuously monitors how your business actually operates across all your systems, proactively fixes inefficiencies before they become problems, and governs automation so actions happen safely and intentionally.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="text-lg text-gray-400 mb-12"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            Connect your tools. Core314 handles the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.1 }}
            className="flex justify-center mb-16"
          >
            <Link
              to="/pricing"
              className="px-10 py-5 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all duration-300 transform hover:scale-105"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              Start Free Trial
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="flex flex-col items-center gap-2 text-gray-400"
          >
            <span className="text-sm">Scroll to Discover</span>
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* How Core314 Works Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-[#0A0F1A] to-[#001a33]">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-6"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              How Core314 Works
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-300 text-center mb-16 max-w-3xl mx-auto"
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
                whileHover={{ scale: 1.02 }}
                className="group relative bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/20 rounded-xl p-8 hover:border-[#00BFFF] transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/5 to-[#007BFF]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="bg-gradient-to-br from-[#00BFFF]/20 to-[#007BFF]/20 rounded-full w-20 h-20 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all">
                    <pillar.icon className="h-10 w-10 text-[#00BFFF]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#66FCF1]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {pillar.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {pillar.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="py-24 px-4 bg-[#0A0F1A]">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              What to Expect After You Connect Your Systems
            </span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                <div className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8 hover:border-[#00BFFF] transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,191,255,0.3)] h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-gradient-to-br from-[#00BFFF]/20 to-[#007BFF]/20 rounded-full w-16 h-16 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(0,191,255,0.5)] transition-all">
                      <span className="text-2xl font-bold text-[#00BFFF]">{step.step}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-[#66FCF1]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {step.desc}
                  </p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-[#00BFFF] z-10">
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                      <path d="M5 15 L25 15 M25 15 L18 8 M25 15 L18 22" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Core314 Is For Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-[#0A0F1A] to-[#001a33]">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              Who Core314 Is For
            </span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Is For */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6 text-[#66FCF1] flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <CheckCircle className="h-8 w-8 text-[#00BFFF]" />
                Core314 Is For
              </h3>
              <ul className="space-y-4">
                {[
                  "Scaling businesses using multiple tools",
                  "Founders, operators, and operations leaders",
                  "Teams experiencing reactive firefighting",
                  "Organizations that want automation without losing control"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle className="h-5 w-5 text-[#00BFFF] mt-0.5 flex-shrink-0" />
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
              className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-gray-700 rounded-xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6 text-gray-400 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <XCircle className="h-8 w-8 text-gray-500" />
                Core314 Is Not For
              </h3>
              <ul className="space-y-4">
                {[
                  "Very early-stage teams with minimal tooling",
                  "Dashboard-only reporting use cases",
                  "One-off automation scripts",
                  "Experiment-only AI tools"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <XCircle className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-4 overflow-hidden">
        {/* Glowing grid background */}
        <div className="absolute inset-0 bg-[#0A0F1A]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00BFFF_1px,transparent_1px),linear-gradient(to_bottom,#00BFFF_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1A] via-transparent to-[#0A0F1A]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-bold mb-8"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] via-[#66FCF1] to-[#00BFFF] bg-clip-text text-transparent">
              Take Control of Your Operations
            </span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto space-y-4"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <p>
              Core314 gives you operational control across your business by continuously monitoring, optimizing, and governing how work actually gets done.
            </p>
            <p className="text-gray-400">
              You don't need to change your stack. You don't need to rebuild workflows. You connect your systems — Core314 handles the rest.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-6 justify-center mb-8"
          >
            <Link
              to="/pricing"
              className="px-12 py-6 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-xl hover:shadow-[0_0_40px_rgba(0,191,255,0.8)] transition-all duration-300 transform hover:scale-105"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact"
              className="px-12 py-6 bg-transparent border-2 border-[#00BFFF] rounded-lg font-semibold text-xl hover:bg-[#00BFFF]/10 transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              Contact Us
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 text-sm"
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
