import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Rocket } from 'lucide-react';
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
      'AI-powered task order intelligence for government contractors. Procuvex streamlines compliance analysis, accelerates bid/no-bid decisions, and helps organizations win more contracts with data-driven insights.',
    features: [
      'Task order analysis and comparison',
      'Compliance matrix generation',
      'Bid decision engine with risk scoring',
      'Subcontractor management',
      'Executive summary and debrief tools',
      'Quote and pricing management',
    ],
    icon: Shield,
    link: '/products/procuvex',
    externalLink: 'https://procuvex.com',
    status: 'Available',
    color: 'sky',
  },
  {
    name: 'More Products Coming',
    tagline: 'New Solutions in Development',
    description:
      'Core314 Technologies is actively developing new AI-powered platforms to address critical business challenges. Each product is purpose-built to solve a specific problem with intelligence and precision.',
    features: [
      'AI-powered analysis and intelligence',
      'Seamless integration with existing tools',
      'Enterprise-grade security',
      'Clear, actionable recommendations',
    ],
    icon: Rocket,
    link: '/contact',
    status: 'In Development',
    color: 'slate',
  },
];

export default function ProductsPage() {
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
              Our Products
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6"
            >
              Software That Works{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">
                as Hard as You Do
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 leading-relaxed"
            >
              Every product in the Core314 Technologies portfolio is built to solve a specific,
              high-impact business problem. No bloat. No compromises.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Product Cards */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="space-y-12"
          >
            {products.map((product) => (
              <motion.div
                key={product.name}
                variants={fadeUp}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-xl ${product.color === 'sky' ? 'bg-sky-50' : 'bg-slate-50'}`}>
                      <product.icon className={`h-7 w-7 ${product.color === 'sky' ? 'text-sky-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
                      <p className="text-sm font-medium text-sky-600">{product.tagline}</p>
                    </div>
                    <span className={`ml-auto text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                      product.status === 'Available'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {product.status}
                    </span>
                  </div>

                  <p className="text-slate-600 leading-relaxed mb-8 max-w-3xl">{product.description}</p>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                    {product.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {product.externalLink && (
                      <a
                        href={product.externalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        Visit {product.name}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      to={product.link}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
                    >
                      {product.status === 'Available' ? 'Learn More' : 'Contact Us'}
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Need a Custom Solution?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              We work with enterprise organizations to build custom intelligence solutions
              tailored to their specific operational challenges.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                to="/enterprise"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Explore Enterprise Solutions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
