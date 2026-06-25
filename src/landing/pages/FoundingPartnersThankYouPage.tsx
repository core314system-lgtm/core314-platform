import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, Clock, Mail } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }

export default function FoundingPartnersThankYouPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />

      <section className="pt-32 pb-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-8">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl md:text-4xl font-bold mb-6"
          >
            Application Received
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 mb-10 leading-relaxed"
          >
            Thank you for your interest in the Procuvex Founding Partner Program. Your application has been submitted successfully.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-slate-50 border border-gray-200 rounded-2xl p-8 text-left space-y-6 mb-10"
          >
            <h3 className="text-lg font-semibold text-gray-900 text-center">What Happens Next</h3>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Application Review</p>
                <p className="text-gray-600 text-sm">Every application is reviewed individually by our team. We evaluate each organization based on their experience, team size, and alignment with the program goals.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Decision Notification</p>
                <p className="text-gray-600 text-sm">Selected organizations will receive an email with login credentials and full Enterprise access. You'll be able to start using the platform immediately upon acceptance.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">30-Day Program Begins</p>
                <p className="text-gray-600 text-sm">Once accepted, your 30-day Founding Partner evaluation begins from your first login. You'll have full Enterprise access and direct communication with our engineering team.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              Return to Procuvex
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
