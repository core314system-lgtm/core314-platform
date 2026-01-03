import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Settings, Building2, ArrowRight, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function SolutionsPage() {
  const solutions = [
    {
      icon: TrendingUp,
      title: "Scaling Companies",
      problem: "As companies grow, operational complexity increases. More tools, more data, more processes to manage. Teams spend increasing time coordinating across systems instead of executing.",
      solution: "Core314 provides a central point of control that scales with your business. Connect new tools as you add them, maintain visibility across all systems, and keep operations coordinated without adding headcount.",
      benefits: [
        "Unified view across all business systems",
        "Reduced time spent switching between tools",
        "Operational visibility that grows with your stack"
      ]
    },
    {
      icon: Users,
      title: "Operations-Heavy Teams",
      problem: "Operations teams often work reactively, responding to issues after they occur. Manual monitoring across multiple dashboards is time-consuming and error-prone.",
      solution: "Core314 monitors your connected systems continuously and surfaces issues early. Instead of checking multiple dashboards, your team gets a single operational view with alerts when attention is needed.",
      benefits: [
        "Proactive issue detection",
        "Single dashboard for cross-system visibility",
        "Reduced manual monitoring burden"
      ]
    },
    {
      icon: Settings,
      title: "Engineering & DevOps",
      problem: "Engineering teams need visibility into how technical systems affect business operations. Disconnected monitoring tools make it difficult to correlate technical events with business impact.",
      solution: "Core314 connects technical and business systems, providing context that helps engineering teams understand the operational impact of technical changes and incidents.",
      benefits: [
        "Correlation between technical and business metrics",
        "API-first architecture for custom integrations",
        "Audit trails for operational changes"
      ]
    },
    {
      icon: Building2,
      title: "Enterprise Operations Leadership",
      problem: "Operations leaders need visibility across departments and systems to make informed decisions. Getting this visibility typically requires manual reporting and data aggregation.",
      solution: "Core314 provides operational scores and metrics that aggregate data from across your connected systems. Leaders get a clear view of operational health without waiting for manual reports.",
      benefits: [
        "Executive-level operational dashboards",
        "Cross-department visibility",
        "Data-driven operational insights"
      ]
    }
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
            Solutions for Your Team
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Core314 serves teams that need operational visibility and control across multiple business systems.
          </motion.p>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-16">
            {solutions.map((solution, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-8 md:p-12 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Icon and Title */}
                  <div className="md:w-1/3">
                    <div className="bg-sky-100 rounded-xl w-16 h-16 flex items-center justify-center mb-6">
                      <solution.icon className="h-8 w-8 text-sky-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {solution.title}
                    </h2>
                  </div>

                  {/* Problem and Solution */}
                  <div className="md:w-2/3 space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        The Challenge
                      </h3>
                      <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {solution.problem}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        How Core314 Helps
                      </h3>
                      <p className="text-slate-600 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {solution.solution}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Key Benefits
                      </h3>
                      <ul className="space-y-2">
                        {solution.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                            <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* RevOps Section */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Revenue Operations
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              RevOps teams use Core314 to connect sales, marketing, and customer success systems for unified revenue visibility.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Pipeline Visibility",
                desc: "Connect CRM, marketing automation, and sales tools to see the complete revenue pipeline in one view."
              },
              {
                title: "Handoff Tracking",
                desc: "Monitor how leads and customers move between teams. Identify where handoffs slow down or break."
              },
              {
                title: "Revenue Metrics",
                desc: "Aggregate revenue-related metrics from across your stack without manual data pulls."
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
            Find Your Solution
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Start with a 14-day free trial to see how Core314 can help your team gain operational visibility.
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
              Talk to Sales
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
