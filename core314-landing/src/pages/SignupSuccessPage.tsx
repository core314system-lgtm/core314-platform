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
    <div className="min-h-screen bg-[#0A0F1A] text-white flex items-center justify-center px-4 overflow-hidden">
      {/* Animated particle matrix background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] via-[#001a33] to-[#0A0F1A]" />
        
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#00BFFF" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Floating particles */}
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#66FCF1] rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              x: [0, Math.random() * 50 - 25, 0],
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}

        {/* Pulsing rings */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={`ring-${i}`}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#00BFFF]"
            style={{
              width: '200px',
              height: '200px',
            }}
            animate={{
              scale: [1, 3, 3],
              opacity: [0.5, 0.2, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Logo with pulse animation */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="mb-8"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              filter: [
                'drop-shadow(0 0 20px rgba(0,191,255,0.5))',
                'drop-shadow(0 0 40px rgba(0,191,255,0.8))',
                'drop-shadow(0 0 20px rgba(0,191,255,0.5))',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="inline-block"
          >
            <img src="/logo-icon.png" alt="Core314" className="h-32 w-32 mx-auto" />
          </motion.div>
        </motion.div>

        {/* Success icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <CheckCircle className="h-20 w-20 text-[#00BFFF] mx-auto" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-5xl md:text-7xl font-bold mb-6"
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
        >
          <span className="bg-gradient-to-r from-[#00BFFF] via-[#66FCF1] to-[#00BFFF] bg-clip-text text-transparent">
            Welcome to Core314
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-2xl md:text-3xl text-[#66FCF1] mb-4"
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
        >
          Your journey toward unified intelligence begins now
        </motion.p>

        {/* Body text */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto"
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
            className="group px-10 py-5 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <Link
            to="/contact"
            className="px-10 py-5 bg-transparent border-2 border-[#00BFFF] rounded-lg font-semibold text-lg hover:bg-[#00BFFF]/10 transition-all"
          >
            Visit Help Center
          </Link>
        </motion.div>

        {/* Auto-redirect countdown */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="text-sm text-gray-400"
        >
          Redirecting to your dashboard in {countdown} seconds...
        </motion.p>

        {/* Animated data streams */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`stream-${i}`}
              className="absolute h-px bg-gradient-to-r from-transparent via-[#00BFFF] to-transparent"
              style={{
                left: `${i * 20}%`,
                width: '200px',
              }}
              animate={{
                y: ['100vh', '-100px'],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
