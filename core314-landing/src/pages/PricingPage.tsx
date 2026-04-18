import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Clock, Shield, ChevronDown, Zap, X } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { PRICING, formatPrice } from '../config/pricing';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const faqs = [
  {
    q: 'What happens after my 14-day trial?',
    a: 'If you love Core314 (and we think you will), your subscription begins automatically. If not, simply cancel before the trial ends and you will not be charged. No questions asked.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated so you only pay for what you use.',
  },
  {
    q: 'Do I need a credit card to start the trial?',
    a: 'No. You can start your 14-day trial without entering any payment information. We want you to experience the value before making any commitment.',
  },
  {
    q: 'What integrations are included?',
    a: 'All 16 integrations are available on every plan. The difference is how many you can connect simultaneously: 3 on Intelligence, 10 on Command Center, and unlimited on Enterprise.',
  },
  {
    q: 'How are Operational Briefs generated?',
    a: 'Core314 uses AI to analyze signals from your connected tools and generates written briefs that explain what is happening, what the business impact is, and what actions leadership should take.',
  },
  {
    q: 'Is there a contract or commitment?',
    a: 'No long-term contracts. All plans are month-to-month and you can cancel anytime. Enterprise plans may include annual options with additional discounts.',
  },
  {
    q: 'What kind of support do you offer?',
    a: 'Intelligence and Command Center plans include email support with fast response times. Enterprise plans include dedicated onboarding, priority support, and a named account manager.',
  },
  {
    q: 'Can multiple team members use Core314?',
    a: 'Yes. Intelligence includes 1 user seat, Command Center includes up to 5, and Enterprise includes up to 20. All users on a team share the same connected integrations and briefs.',
  },
];

const comparisonFeatures = [
  { name: 'Integrations', intel: '3 of 16', cmd: '10 of 16', ent: 'All 16' },
  { name: 'AI Operational Briefs', intel: '30 / month', cmd: 'Unlimited', ent: 'Unlimited' },
  { name: 'Users', intel: '1', cmd: 'Up to 5', ent: 'Up to 20' },
  { name: 'Operational Health Score', intel: true, cmd: true, ent: true },
  { name: 'Signals Dashboard', intel: true, cmd: true, ent: true },
  { name: 'Operational Brief Archive', intel: true, cmd: true, ent: true },
  { name: 'Command Center Dashboard', intel: false, cmd: true, ent: true },
  { name: 'Advanced Signal Analysis', intel: false, cmd: true, ent: true },
  { name: 'Integration Event History', intel: false, cmd: true, ent: true },
  { name: 'Custom Integrations', intel: false, cmd: false, ent: true },
  { name: 'Dedicated Onboarding', intel: false, cmd: false, ent: true },
  { name: 'Executive Reporting', intel: false, cmd: false, ent: true },
  { name: 'Priority Signal Processing', intel: false, cmd: false, ent: true },
  { name: 'SLA Guarantees', intel: false, cmd: false, ent: true },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') return <span className="text-sm text-slate-700 font-medium">{value}</span>;
  return value ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <X className="h-5 w-5 text-slate-300 mx-auto" />;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-semibold mb-6"
          >
            <Shield className="h-4 w-4" />
            14-Day Risk-Free Trial on Every Plan
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            Simple, Transparent{' '}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">Pricing</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4"
          >
            Choose the plan that fits your team. Start free, upgrade when you are ready. No surprises.
          </motion.p>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm text-slate-400"
          >
            No credit card required &middot; Cancel anytime &middot; Month-to-month billing
          </motion.p>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Intelligence */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-1">{PRICING.intelligence.name}</h3>
                <p className="text-sm text-slate-500">{PRICING.intelligence.tagline}</p>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-extrabold text-slate-900">{formatPrice(PRICING.intelligence.monthly)}</span>
                <span className="text-slate-500 text-base">/month</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">Billed monthly. Cancel anytime.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {PRICING.intelligence.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="block w-full py-3.5 text-center text-sm font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Start 14-Day Free Trial
              </Link>
            </motion.div>

            {/* Command Center */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-slate-900 border-2 border-sky-500 rounded-2xl p-6 lg:p-8 flex flex-col relative shadow-xl shadow-sky-500/10"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Most Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">{PRICING.commandCenter.name}</h3>
                <p className="text-sm text-slate-400">{PRICING.commandCenter.tagline}</p>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-extrabold text-white">{formatPrice(PRICING.commandCenter.monthly)}</span>
                <span className="text-slate-400 text-base">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">Billed monthly. Cancel anytime.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {PRICING.commandCenter.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="block w-full py-3.5 text-center text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 rounded-xl transition-all shadow-lg shadow-sky-500/25">
                Start 14-Day Free Trial
              </Link>
            </motion.div>

            {/* Enterprise */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-1">{PRICING.enterprise.name}</h3>
                <p className="text-sm text-slate-500">{PRICING.enterprise.tagline}</p>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-extrabold text-slate-900">Custom</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">Tailored to your organization.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {PRICING.enterprise.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/contact" className="block w-full py-3.5 text-center text-sm font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Contact Sales
              </Link>
            </motion.div>
          </div>

          <p className="text-center mt-8 text-sm text-slate-500">
            All plans include a <strong className="text-slate-700">14-day risk-free trial</strong>. No credit card required to start.
          </p>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Compare Plans Side by Side</h2>
            <p className="text-lg text-slate-600">See exactly what you get with each plan.</p>
          </motion.div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-0">
              <div className="p-4 bg-slate-50 border-b border-r border-slate-200" />
              <div className="p-4 bg-slate-50 border-b border-r border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-900">Intelligence</p>
                <p className="text-xs text-slate-500">{formatPrice(PRICING.intelligence.monthly)}/mo</p>
              </div>
              <div className="p-4 bg-slate-900 border-b border-r border-slate-700 text-center">
                <p className="text-sm font-bold text-white">Command Center</p>
                <p className="text-xs text-slate-400">{formatPrice(PRICING.commandCenter.monthly)}/mo</p>
              </div>
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-900">Enterprise</p>
                <p className="text-xs text-slate-500">Custom</p>
              </div>

              {comparisonFeatures.map((feat, i) => (
                <div key={i} className="contents">
                  <div className={`p-4 border-b border-r border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <span className="text-sm text-slate-700">{feat.name}</span>
                  </div>
                  <div className={`p-4 border-b border-r border-slate-200 text-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <FeatureCell value={feat.intel} />
                  </div>
                  <div className={`p-4 border-b border-r border-slate-200 text-center ${i % 2 === 0 ? 'bg-sky-50/30' : 'bg-sky-50/50'}`}>
                    <FeatureCell value={feat.cmd} />
                  </div>
                  <div className={`p-4 border-b border-slate-200 text-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <FeatureCell value={feat.ent} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Pricing FAQ</h2>
            <p className="text-lg text-slate-600">Common questions about plans and billing.</p>
          </motion.div>

          <div className="border-t border-slate-200">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              14-Day Risk-Free Trial
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
              Ready to See What You&apos;ve Been Missing?
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Start your free trial today. No credit card required. If Core314 does not deliver value in 14 days, you pay nothing.
            </p>
            <Link to="/signup" className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-2xl transition-all">
              Start My Free 14-Day Trial
              <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <p className="text-sm text-slate-400 mt-4">No credit card required &middot; Cancel anytime</p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
