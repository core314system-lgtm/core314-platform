import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = 'How Core314 Works | System Intelligence, Not Guesswork';
  }, []);
  const lifecycleSteps = [
    {
      step: "1",
      title: "Connect",
      desc: "Secure, read-only connections to your existing tools. No disruption. No automation."
    },
    {
      step: "2",
      title: "Observe",
      subtitle: "System Calibration Phase",
      desc: "Core314 discovers metrics, maps relationships, and establishes behavioral baselines.",
      note: "AI insights and scoring are intentionally locked."
    },
    {
      step: "3",
      title: "Analyze",
      subtitle: "Active System Intelligence",
      desc: "Metrics activate. Dashboards go live. The Global Fusion Score becomes dynamic. AI explanations are grounded in observed behavior."
    },
    {
      step: "4",
      title: "Predict",
      desc: "Core314 identifies trends, risks, and early-warning indicators before issues occur."
    },
    {
      step: "5",
      title: "Act",
      desc: "Governed automation, self-healing logic, and optimization with full auditability."
    }
  ];

  const differentiators = [
    "Cross-integration behavioral memory",
    "Temporal learning over time",
    "Causal understanding of system interactions",
    "Governed automation with fail-closed safety",
    "Intelligence that compounds, not resets"
  ];

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
            Core314 Is Not Installed — It's Learned
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            True system intelligence requires observation before optimization.
          </motion.p>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Most "AI Platforms" Fail
            </h2>
            <div className="space-y-6 text-lg text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p>
                Organizations run on fragmented tools. Dashboards display numbers without context. Alerts fire after damage occurs. AI systems generate conclusions before understanding how a system actually operates.
              </p>
              <p className="font-semibold text-slate-800">
                That is noise, not intelligence.
              </p>
              <p>
                Core314 enforces system-level intelligence where most platforms fail.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intelligence Lifecycle Section */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              The Core314 Intelligence Lifecycle
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {lifecycleSteps.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="bg-sky-500 text-white rounded-full w-10 h-10 flex items-center justify-center mb-4 text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-1 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-sky-600 text-sm font-medium mb-3">{item.subtitle}</p>
                )}
                <p className="text-slate-600 text-sm leading-relaxed mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {item.desc}
                </p>
                {item.note && (
                  <p className="text-slate-500 text-xs italic">{item.note}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Observe Is Required Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Core314 Does Not Guess
            </h2>
            <div className="space-y-6 text-lg text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p>
                Most platforms skip calibration and generate insights immediately. Core314 refuses.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 my-8">
                <p className="font-semibold text-slate-800 mb-4">Until observation completes:</p>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="text-slate-400">•</span>
                    <span>AI insights remain locked</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-slate-400">•</span>
                    <span>Scores remain at baseline</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-slate-400">•</span>
                    <span>No predictions or optimizations execute</span>
                  </li>
                </ul>
              </div>
              <p className="font-semibold text-slate-800">
                This is how Core314 protects organizations from false intelligence.
              </p>
              <p>
                Observation is the foundation. Not a limitation.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Alignment Section */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Pricing Aligned to System Maturity
            </h2>
            <div className="space-y-4 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="font-semibold text-slate-800">
                  <Link to="/pricing" className="text-sky-600 hover:text-sky-700">Observe</Link>
                  <span className="text-slate-600 font-normal ml-2">— System calibration and discovery (required starting point)</span>
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="font-semibold text-slate-800">
                  <Link to="/pricing" className="text-sky-600 hover:text-sky-700">Analyze</Link>
                  <span className="text-slate-600 font-normal ml-2">— Live intelligence, scoring, and AI explanations</span>
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="font-semibold text-slate-800">
                  <Link to="/pricing" className="text-sky-600 hover:text-sky-700">Predict & Act</Link>
                  <span className="text-slate-600 font-normal ml-2">— Forecasting, autonomous optimization, and governance</span>
                </p>
              </div>
            </div>
            <div className="text-lg text-slate-600 leading-relaxed mb-10" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p className="mb-2">Core314 does not sell features.</p>
              <p className="font-semibold text-slate-800">Intelligence unlocks when your system is ready.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/pricing"
                className="inline-block px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-semibold text-center transition-all duration-300 border border-slate-300"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
              >
                View Pricing
              </Link>
              <Link
                to="/signup?plan=starter"
                className="inline-block px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-center shadow-lg hover:shadow-xl transition-all duration-300"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
              >
                Begin System Calibration
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Core314 Is Different Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Why Core314 Can't Be Replicated
            </h2>
            <div className="space-y-4">
              {differentiators.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 text-lg text-slate-700"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <div className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            Ready to Begin?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Start with Observe. Connect your tools. Core314 learns your system before it acts.
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
              className="inline-block px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-semibold transition-all duration-300 border border-slate-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              View Pricing
            </Link>
            <Link
              to="/signup?plan=starter"
              className="inline-block px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Begin System Calibration
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
