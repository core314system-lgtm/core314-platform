import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Network, Code, Plug, ArrowRight, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { integrationLogos } from '../components/IntegrationLogos';

export default function IntegrationsPage() {
  // Integration categories with examples
  const integrationCategories = [
    {
      category: "Communication",
      integrations: ["Slack", "Microsoft Teams", "Discord"]
    },
    {
      category: "Email",
      integrations: ["Gmail", "Outlook", "SendGrid"]
    },
    {
      category: "CRM",
      integrations: ["Salesforce", "HubSpot", "Pipedrive"]
    },
    {
      category: "Project Management",
      integrations: ["Jira", "Asana", "Trello", "Monday.com"]
    },
    {
      category: "Development",
      integrations: ["GitHub", "GitLab", "Bitbucket"]
    },
    {
      category: "Productivity",
      integrations: ["Notion", "Google Drive", "Dropbox"]
    },
    {
      category: "Support",
      integrations: ["Zendesk", "Intercom", "Freshdesk"]
    },
    {
      category: "Analytics",
      integrations: ["Google Analytics", "Mixpanel", "Amplitude"]
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
            Integrations
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Connect your business tools to Core314. Our integration hub supports the systems you already use.
          </motion.p>
        </div>
      </section>

      {/* How Integrations Work */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              How Integrations Work
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 connects to your tools through secure API connections. Your data stays in your systems while Core314 monitors and orchestrates operations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Plug,
                title: "Secure Connection",
                desc: "Each integration uses OAuth or API key authentication. Core314 requests only the permissions needed to monitor and interact with your data."
              },
              {
                icon: Network,
                title: "Central Orchestration",
                desc: "All connected systems feed into Core314's central hub. Data is normalized and correlated to provide a unified operational view."
              },
              {
                icon: Code,
                title: "API-First Design",
                desc: "Core314 is built API-first. Every integration follows consistent patterns, and custom integrations can be built using our API."
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

      {/* Integration Grid */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Available Integrations
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 connects with tools across categories. New integrations are added continuously.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrationCategories.map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-sky-200 transition-all duration-300"
              >
                <h3 className="text-lg font-bold mb-4 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {category.category}
                </h3>
                <ul className="space-y-3">
                  {category.integrations.map((integration, i) => {
                    const LogoComponent = integrationLogos[integration];
                    return (
                      <li key={i} className="flex items-center gap-3 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {LogoComponent ? (
                          <LogoComponent className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 bg-slate-200 rounded flex-shrink-0" />
                        )}
                        <span className="text-sm">{integration}</span>
                      </li>
                    );
                  })}
                </ul>
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
            Shown: a sample of available integrations. Contact us for the full list or to request a specific integration.
          </motion.p>
        </div>
      </section>

      {/* Custom Integrations */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
                Custom Integrations
              </h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Need to connect a system that isn't in our standard library? Core314 supports custom integrations through our API.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "REST API for custom data ingestion",
                  "Webhook support for real-time events",
                  "Documentation and integration guides",
                  "Technical support for custom builds"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle className="h-5 w-5 text-sky-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 font-semibold transition-colors"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Contact us about custom integrations
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6 text-slate-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Integration Capabilities
              </h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Data Sync
                  </h4>
                  <p className="text-slate-600 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Pull data from connected systems on configurable schedules or in real time via webhooks.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Actions
                  </h4>
                  <p className="text-slate-600 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Trigger actions in connected systems based on rules and workflows defined in Core314.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Monitoring
                  </h4>
                  <p className="text-slate-600 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Track the health and status of all integrations from the Core314 dashboard.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* API-First Note */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>
              Built API-First
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Core314 is designed with an API-first architecture. Every feature available in the UI is also available through our API, enabling programmatic access and custom automation.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-3">
                <span className="text-slate-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>REST API</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-3">
                <span className="text-slate-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Webhooks</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-3">
                <span className="text-slate-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>OAuth 2.0</span>
              </div>
            </div>
          </motion.div>
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
            Connect Your Stack
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Start your free trial and connect your first integrations. See how Core314 brings your systems together.
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
              Request an Integration
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
