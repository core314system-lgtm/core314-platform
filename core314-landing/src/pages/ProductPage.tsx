import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Database, Zap, BarChart3, Shield, Network, Eye, Brain, Lock } from 'lucide-react';
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
            The Operations Platform
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 is a system hub that connects your business tools, monitors operations in real time, and helps you maintain control as you scale.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Link
              to="/pricing"
              className="inline-block px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Product Overview Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
                          System Hub for Operations
                        </h2>
                        <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Core314 acts as the central orchestration layer for your business operations. Instead of managing each tool separately, Core314 provides a unified control point where all your systems connect and communicate.
                        </p>
                        <p className="text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Core314 observes signals, behavioral patterns, and variance across connected systems to build intelligence over time.
                        </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Network className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Central Control Point
              </h3>
              <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Connect your CRM, support tools, billing systems, and other business applications to a single platform. Core314 normalizes data across tools and provides a unified view of your operations.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Zap className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Real-Time Data Flow
              </h3>
              <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Data flows between your connected systems in real time. When something changes in one tool, Core314 captures it immediately and makes that information available across your operational view.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How Core314 Connects Systems */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              How Core314 Connects Systems
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 integrates with your existing tools through secure API connections. No data migration required.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Connect",
                desc: "Authenticate your business tools through Core314's integration hub. Each connection is established through secure OAuth or API key authentication."
              },
              {
                step: "2",
                title: "Sync",
                desc: "Core314 begins monitoring data flow across your connected systems. It learns your operational patterns and establishes baselines for normal activity."
              },
              {
                step: "3",
                title: "Control",
                desc: "View unified operational data, receive alerts when patterns change, and manage cross-system workflows from a single interface."
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="bg-sky-500 text-white rounded-full w-12 h-12 flex items-center justify-center mb-6 text-xl font-bold">
                  {item.step}
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

      {/* Operational Visibility & Monitoring */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Operational Visibility
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              See how work flows across your organization. Core314 provides continuous monitoring of your connected systems.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-sky-50 border border-sky-200 rounded-2xl p-8"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Eye className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Unified Dashboard
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                View operational metrics from all connected systems in one place. Track key indicators across sales, support, fulfillment, and other business functions without switching between tools.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-sky-50 border border-sky-200 rounded-2xl p-8"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <BarChart3 className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Operational Scores
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                Core314 generates operational health scores based on data from your connected systems. These scores help you understand at a glance whether operations are running normally or require attention.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Intelligence & Insights */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
                      <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
                        Intelligence & Insights
                      </h2>
                      <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Core314 analyzes operational data to surface patterns and potential issues.
                      </p>
                      <p className="text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Intelligence strengthens as consistent patterns emerge across time and systems.
                      </p>
                      <p className="text-base text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Integrations provide signals. Core314 provides understanding.
                      </p>
                    </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Brain className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Pattern Detection
              </h3>
              <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Core314 monitors operational data continuously and identifies when patterns deviate from established baselines. This helps surface potential issues before they escalate.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="bg-sky-100 rounded-xl w-14 h-14 flex items-center justify-center mb-6">
                <Database className="h-7 w-7 text-sky-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Cross-System Correlation
              </h3>
              <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Because Core314 connects multiple systems, it can identify relationships between events that occur across different tools. This provides context that would be difficult to see when viewing each system in isolation.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Enterprise Architecture */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
                      <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
                        Enterprise-Ready Architecture
                      </h2>
                      <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Core314 is built with security and reliability as foundational requirements.
                      </p>
                      <p className="text-lg text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Core314 prioritizes correctness over speed.
                      </p>
                    </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Lock,
                title: "Secure by Design",
                desc: "All data is encrypted in transit and at rest. Core314 uses industry-standard authentication protocols and maintains strict access controls."
              },
              {
                icon: Shield,
                title: "Compliance Ready",
                desc: "Core314's architecture supports compliance requirements for data handling and privacy. Audit logs track all system access and changes."
              },
              {
                icon: Database,
                title: "Reliable Infrastructure",
                desc: "Built on cloud infrastructure with redundancy and failover capabilities. Core314 is designed for high availability and consistent performance."
              }
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
            Ready to Connect Your Operations?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Start with a 14-day free trial. Connect your tools and see how Core314 can provide visibility across your operations.
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
              className="px-10 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
            >
              Start Free Trial
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
