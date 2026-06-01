import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Cpu, Headphones, Lock, Settings, BarChart3 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Cpu,
    title: 'Custom AI Models',
    desc: 'Purpose-built AI models trained on your operational data and tailored to your specific industry and use cases.',
  },
  {
    icon: Settings,
    title: 'Custom Integrations',
    desc: 'Connect to proprietary systems, internal databases, and specialized tools that your organization relies on.',
  },
  {
    icon: Shield,
    title: 'SLA Guarantees',
    desc: 'Committed uptime, response time, and performance guarantees backed by service level agreements.',
  },
  {
    icon: Headphones,
    title: 'Dedicated Onboarding',
    desc: 'Hands-on implementation support with a dedicated team to ensure successful deployment and adoption.',
  },
  {
    icon: Lock,
    title: 'Advanced Security',
    desc: 'SSO, custom data retention policies, audit logging, and compliance certifications for regulated industries.',
  },
  {
    icon: BarChart3,
    title: 'Executive Reporting',
    desc: 'Custom dashboards and reporting tailored to your leadership team and board requirements.',
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3"
            >
              Enterprise Solutions
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Custom Intelligence for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">
                Large Organizations
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 leading-relaxed mb-8"
            >
              We partner with enterprise organizations to build tailored intelligence
              solutions that address their unique operational challenges at scale.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Contact Our Enterprise Team
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Enterprise-Grade Capabilities
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything in our standard products, plus dedicated resources and custom capabilities
              built specifically for your organization.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="p-2.5 bg-sky-50 rounded-lg w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8 text-center">
                How We Work With Enterprise Clients
              </motion.h2>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Discovery', desc: 'We start by understanding your operational landscape, pain points, and goals.' },
                  { step: '02', title: 'Architecture', desc: 'We design a solution architecture that fits your existing infrastructure and security requirements.' },
                  { step: '03', title: 'Implementation', desc: 'Our team builds and deploys the solution with dedicated onboarding and change management support.' },
                  { step: '04', title: 'Optimization', desc: 'Ongoing tuning, monitoring, and optimization to ensure the solution delivers measurable results.' },
                ].map((item) => (
                  <motion.div
                    key={item.step}
                    variants={fadeUp}
                    className="flex gap-6 bg-white border border-slate-200 rounded-xl p-6"
                  >
                    <div className="text-2xl font-extrabold text-sky-600/20">{item.step}</div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl p-10 lg:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Let Us Build Something Together
            </h2>
            <p className="text-lg text-slate-300 max-w-xl mx-auto mb-8">
              Tell us about your operational challenges and we will show you how
              Core314 Technologies can help.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
            >
              Schedule a Consultation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
