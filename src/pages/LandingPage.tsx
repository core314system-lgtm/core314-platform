import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, ChevronDown, Database, Zap, BarChart3, TrendingUp, Shield, Slack } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white overflow-hidden">
      <Header />
      {/* Hero Section - Cinematic Intro */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background Placeholder - Using gradient animation instead */}
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
              Command Every Operation
            </span>
            <br />
            <span className="text-white">from One Core.</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            The future of business orchestration, powered by AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link
              to="/pricing"
              className="px-10 py-5 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all duration-300 transform hover:scale-105"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              Start Free Trial
            </Link>
            <button 
              onClick={() => setShowVideo(true)}
              className="px-10 py-5 bg-transparent border-2 border-[#00BFFF] rounded-lg font-semibold text-lg hover:bg-[#00BFFF]/10 transition-all duration-300 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              <Play className="h-5 w-5" />
              Watch Demo Video
            </button>
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

      {/* Value Story Section 1 - The Vision */}
      <section className="relative py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
        {/* Ambient particles */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-[#66FCF1] rounded-full blur-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold mb-8"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              The Vision
            </span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-300 leading-relaxed space-y-6"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
          >
            <p>
              Disconnected systems, data silos, and slow insights cost enterprises billions.
            </p>
            <p className="text-2xl md:text-3xl text-[#00BFFF] font-semibold">
              Core314 ends operational fragmentation — replacing chaos with intelligence.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Value Story Section 2 - How Core314 Works */}
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
              How Core314 Works
            </span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {[
              { icon: Database, title: "Connect", desc: "Integrate all business systems" },
              { icon: Zap, title: "Sync", desc: "AI unifies and learns from data" },
              { icon: BarChart3, title: "Monitor", desc: "Real-time intelligence dashboard" },
              { icon: TrendingUp, title: "Optimize", desc: "Autonomous performance tuning" }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                className="relative group"
              >
                <div className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl p-8 hover:border-[#00BFFF] transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,191,255,0.3)] transform hover:scale-105">
                  <div className="bg-gradient-to-br from-[#00BFFF]/20 to-[#007BFF]/20 rounded-full w-20 h-20 flex items-center justify-center mb-6 mx-auto group-hover:shadow-[0_0_20px_rgba(0,191,255,0.5)] transition-all">
                    <step.icon className="h-10 w-10 text-[#00BFFF]" />
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-3 text-[#66FCF1]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
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

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-xl text-gray-300 max-w-4xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 doesn't just display data — <span className="text-[#00BFFF] font-semibold">it learns, predicts, and acts.</span>
          </motion.p>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-24 px-4 bg-[#0A0F1A]">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-6"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              Patent-Pending Intelligence Systems
            </span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {[
              {
                icon: Zap,
                title: "Fusion & Scoring Intelligence Layer™",
                desc: "Learns behavioral and operational patterns to score efficiency in real time."
              },
              {
                icon: TrendingUp,
                title: "Proactive Optimization Engine™",
                desc: "Detects and resolves inefficiencies before they occur."
              },
              {
                icon: Shield,
                title: "Autonomous Governance Framework™",
                desc: "Ensures compliance, stability, and trust across connected systems."
              }
            ].map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                whileHover={{ scale: 1.05 }}
                className="group relative bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/20 rounded-xl p-8 hover:border-[#00BFFF] transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/5 to-[#007BFF]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,191,255,0.2)]" />
                </div>
                <div className="relative z-10">
                  <div className="bg-gradient-to-br from-[#00BFFF]/20 to-[#007BFF]/20 rounded-full w-20 h-20 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all">
                    <tech.icon className="h-10 w-10 text-[#00BFFF]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#66FCF1]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {tech.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {tech.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Map */}
      <section className="py-32 px-4 bg-gradient-to-b from-[#0A0F1A] to-[#001a33] overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-16"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
              Universal Integration
            </span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative w-full max-w-2xl mx-auto h-96 mb-12"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <img 
                  src="/logo-icon.png" 
                  alt="Core314" 
                  className="h-32 w-32 relative z-10"
                  style={{
                    filter: 'drop-shadow(0 0 40px rgba(0, 191, 255, 0.8))',
                    animation: 'pulse-glow 3s ease-in-out infinite'
                  }}
                />
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-br from-[#00BFFF]/30 to-[#007BFF]/30 rounded-lg flex items-center justify-center border border-[#00BFFF]/50 backdrop-blur-sm"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-150px) rotate(-${angle}deg)`,
                      animation: `orbit ${20 + i * 2}s linear infinite`
                    }}
                  >
                    <Slack className="h-8 w-8 text-[#00BFFF]" />
                  </motion.div>
                ))}
                {/* Connection lines */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <div
                    key={`line-${i}`}
                    className="absolute top-1/2 left-1/2 w-[150px] h-[2px] bg-gradient-to-r from-[#00BFFF]/50 to-transparent origin-left"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold text-[#66FCF1]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            One Core. Infinite Control.
          </motion.p>
        </div>
      </section>

      {/* Impact Metrics */}
      <section className="py-24 px-4 bg-[#0A0F1A]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { metric: "42%", label: "Faster Decision Cycles" },
              { metric: "38%", label: "Reduction in Operational Bottlenecks" },
              { metric: "100%", label: "AI Governance Transparency" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                className="text-center p-12 bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-xl hover:border-[#00BFFF] hover:shadow-[0_0_40px_rgba(0,191,255,0.3)] transition-all duration-300"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 + 0.3, duration: 1 }}
                  className="text-6xl md:text-7xl font-bold mb-4"
                  style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
                >
                  <span className="bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent">
                    {stat.metric}
                  </span>
                </motion.div>
                <div className="text-xl text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-2xl text-gray-300 mt-16 italic"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            When logic orchestrates your business, <span className="text-[#00BFFF] font-semibold">performance follows.</span>
          </motion.p>
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
              Your Operations.
            </span>
            <br />
            <span className="text-white">Unified by Logic.</span>
          </motion.h2>

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
            Built with patent-pending Fusion & Scoring Intelligence Layer™
          </motion.p>
        </div>
      </section>

      <Footer />

      {/* Demo Video Modal */}
      {showVideo && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVideo(false)}
        >
          <div className="max-w-4xl w-full bg-[#0A0F1A] border border-[#00BFFF] rounded-xl p-8">
            <div className="aspect-video bg-gradient-to-br from-[#001a33] to-[#0A0F1A] rounded-lg flex items-center justify-center">
              <p className="text-gray-400 text-xl">Demo Video Placeholder</p>
            </div>
            <button 
              onClick={() => setShowVideo(false)}
              className="mt-6 px-6 py-3 bg-[#00BFFF] rounded-lg font-semibold hover:bg-[#007BFF] transition-colors w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
