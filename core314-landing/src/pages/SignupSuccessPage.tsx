import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function SignupSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = 'https://app.core314.com/dashboard';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 flex items-center justify-center px-4 overflow-hidden">
      {/* Subtle decorative background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-50 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="mb-8"
        >
          <img src="/logo-icon.png" alt="Core314" className="h-32 w-32 mx-auto" />
        </motion.div>

        {/* Success icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <CheckCircle className="h-20 w-20 text-sky-500 mx-auto" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-5xl md:text-7xl font-bold mb-6 text-slate-900"
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
        >
          Welcome to Core314
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-2xl md:text-3xl text-sky-600 mb-4"
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
        >
          Your journey toward unified intelligence begins now
        </motion.p>

        {/* Body text */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto"
        >
          Your Core is now active. Connect your systems, synchronize your intelligence, 
          and let logic take over. Your AI-powered intelligence layer is ready to transform how you work.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
        >
          <a
            href="https://app.core314.com/dashboard"
            className="group px-10 py-5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <Link
            to="/contact"
            className="px-10 py-5 bg-white border-2 border-slate-300 text-slate-900 rounded-lg font-semibold text-lg hover:border-sky-400 hover:bg-slate-50 transition-all"
          >
            Visit Help Center
          </Link>
        </motion.div>

        {/* Auto-redirect countdown */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="text-sm text-slate-500"
        >
          Redirecting to your dashboard in {countdown} seconds...
        </motion.p>
      </div>
    </div>
  );
}
