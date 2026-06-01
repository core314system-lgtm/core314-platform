import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Cpu, BarChart3, Layers, Rocket } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const products = [
  {
    name: 'Procuvex',
    tagline: 'Government Procurement Intelligence',
    description:
      'AI-powered task order intelligence for government contractors. Streamline compliance, accelerate bid decisions, and win more contracts.',
    icon: Shield,
    color: 'sky',
    link: '/products/procuvex',
    status: 'Available',
  },
  {
    name: 'Coming Soon',
    tagline: 'More Products in Development',
    description:
      'We are building the next generation of intelligent business software. New products will be announced as they become available.',
    icon: Rocket,
    color: 'slate',
    link: '/products',
    status: 'In Development',
  },
];

const capabilities = [
  {
    icon: Cpu,
    title: 'Artificial Intelligence',
    desc: 'Proprietary AI models that understand business operations, detect patterns, and surface actionable intelligence.',
  },
  {
    icon: BarChart3,
    title: 'Operational Analytics',
    desc: 'Transform raw data from your business systems into clear, decision-ready insights for leadership teams.',
  },
  {
    icon: Layers,
    title: 'System Integration',
    desc: 'Secure, read-only connections to the tools your business already uses. No workflow changes required.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    desc: 'SOC 2-ready architecture with end-to-end encryption, role-based access control, and full audit trails.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-20 lg:pt-40 lg:pb-32 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-4"
            >
              Core314 Technologies LLC
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Intelligent Software for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">
                Modern Business
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10"
            >
              We build AI-powered platforms that help organizations operate smarter,
              make faster decisions, and scale with confidence.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Explore Our Products
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">
              Our Products
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Purpose-Built Software Solutions
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto">
              Each product is designed to solve a specific, high-impact business problem with precision and intelligence.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          >
            {products.map((product) => (
              <motion.div key={product.name} variants={fadeUp}>
                <Link
                  to={product.link}
                  className="block h-full bg-white border border-slate-200 rounded-xl p-8 hover:border-sky-300 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-lg ${product.color === 'sky' ? 'bg-sky-50' : 'bg-slate-50'}`}>
                      <product.icon className={`h-6 w-6 ${product.color === 'sky' ? 'text-sky-600' : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      product.status === 'Available'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {product.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-sky-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm font-medium text-sky-600 mb-3">{product.tagline}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
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
              Core Capabilities
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Technology That Drives Results
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto">
              Every product we build is powered by the same foundational technology platform.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {capabilities.map((cap) => (
              <motion.div
                key={cap.title}
                variants={fadeUp}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <div className="p-2.5 bg-sky-50 rounded-lg w-fit mb-4">
                  <cap.icon className="h-6 w-6 text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{cap.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl p-10 lg:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-slate-300 max-w-xl mx-auto mb-8">
              Whether you need a product demo, enterprise consultation, or just want to learn more — we are here to help.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
              >
                Contact Our Team
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-slate-600 hover:border-slate-400 rounded-lg transition-colors"
              >
                View Products
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
