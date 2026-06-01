import { motion } from 'framer-motion';
import { ArrowRight, FileText, Shield, BarChart3, Users, Zap, CheckCircle } from 'lucide-react';
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
    icon: FileText,
    title: 'Task Order Intelligence',
    desc: 'AI-powered analysis of task orders, RFPs, and procurement documents. Instantly understand requirements, compliance obligations, and competitive positioning.',
  },
  {
    icon: Shield,
    title: 'Compliance Matrix Generation',
    desc: 'Automatically generate compliance matrices that map requirements to your capabilities. Reduce manual effort and eliminate coverage gaps.',
  },
  {
    icon: BarChart3,
    title: 'Bid Decision Engine',
    desc: 'Data-driven bid/no-bid recommendations based on win probability, resource availability, competitive landscape, and strategic alignment.',
  },
  {
    icon: Users,
    title: 'Subcontractor Management',
    desc: 'Track and manage teaming partners, capture capabilities, and match subcontractors to task order requirements.',
  },
  {
    icon: Zap,
    title: 'Executive Summaries',
    desc: 'Generate polished executive summaries and debrief reports that communicate decisions clearly to stakeholders.',
  },
  {
    icon: CheckCircle,
    title: 'Quote and Pricing Tools',
    desc: 'Build pricing models, manage rate cards, and generate quote packages that align with solicitation requirements.',
  },
];

export default function ProcuvexPage() {
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
              A Core314 Technologies Product
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Procuvex
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-xl text-sky-600 font-medium mb-4"
            >
              Government Procurement Intelligence
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 leading-relaxed mb-8"
            >
              AI-powered task order intelligence for government contractors. Streamline compliance,
              accelerate bid decisions, and win more contracts with data-driven insights.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a
                href="https://procuvex.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Visit Procuvex
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="https://procuvex.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
              >
                Request a Demo
              </a>
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
              Key Capabilities
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto">
              Procuvex gives government contractors the intelligence they need to compete
              smarter and win more.
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

      {/* Who It Is For */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Built for Government Contractors
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-slate-600 leading-relaxed mb-8">
                Procuvex is designed for contracting teams that manage task orders, respond to solicitations,
                and need to make fast, data-informed decisions about which opportunities to pursue.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://procuvex.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Learn More at procuvex.com
                  <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
