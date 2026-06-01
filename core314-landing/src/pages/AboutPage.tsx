import { motion } from 'framer-motion';
import { Target, Lightbulb, Shield, Users } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const values = [
  {
    icon: Target,
    title: 'Precision',
    desc: 'We build software that does one thing exceptionally well. No feature bloat. No distractions. Every product solves a specific, high-value problem.',
  },
  {
    icon: Lightbulb,
    title: 'Intelligence',
    desc: 'Our platforms do not just collect data — they interpret it. AI-powered analysis transforms raw information into clear, actionable recommendations.',
  },
  {
    icon: Shield,
    title: 'Trust',
    desc: 'Enterprise-grade security is not an add-on. Every product is built with encryption, access controls, and audit trails from day one.',
  },
  {
    icon: Users,
    title: 'Accountability',
    desc: 'We stand behind what we build. Our customers have direct access to the team that designs and ships the product.',
  },
];

export default function AboutPage() {
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
              About Us
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Building the Future of{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">
                Business Intelligence
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 leading-relaxed"
            >
              Core314 Technologies LLC is a software company focused on building
              AI-powered platforms that help organizations make better decisions, faster.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6">
                Our Story
              </motion.h2>
              <motion.div variants={fadeUp} className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  Core314 Technologies was founded on a simple observation: modern businesses generate
                  enormous amounts of operational data, but very few have the tools to turn that data
                  into timely, actionable intelligence.
                </p>
                <p>
                  Leadership teams rely on scattered dashboards, manual reports, and gut instinct
                  to make decisions that shape the future of their organizations. We believe they
                  deserve better.
                </p>
                <p>
                  Our mission is to build purpose-built software products that connect to the systems
                  businesses already use, analyze the data flowing through them, and deliver clear
                  intelligence that drives confident decision-making.
                </p>
                <p>
                  Every product we ship is designed with the same principles: security first, AI-powered
                  analysis, seamless integration, and zero disruption to existing workflows.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">
              What We Stand For
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Our Values
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto"
          >
            {values.map((val) => (
              <motion.div
                key={val.title}
                variants={fadeUp}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="p-2.5 bg-sky-50 rounded-lg w-fit mb-4">
                  <val.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{val.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{val.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Patent Pending */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
                Patent-Pending Technology
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-slate-600 leading-relaxed">
                Core314 Technologies develops proprietary AI and data intelligence systems.
                Our core technology is protected by pending patent applications, reflecting
                our commitment to innovation and building defensible products.
              </motion.p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
