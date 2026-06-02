import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Screenshot {
  id: number;
  title: string;
  description: string;
  image: string;
}

const screenshots: Screenshot[] = [
  {
    id: 1,
    title: "Operations Dashboard",
    description: "Unified view of operational health across all connected systems",
    image: "/screenshots/dashboard.png"
  },
  {
    id: 2,
    title: "Integration Hub",
    description: "Connect and manage your business tools from one place",
    image: "/screenshots/integration-hub.png"
  }
];

const AUTO_ROTATE_INTERVAL = 8000; // 8 seconds

export default function AppScreenshotCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      goToNext();
    }, AUTO_ROTATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isPaused, goToNext]);

  return (
    <section className="py-16 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4 text-slate-900"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
          >
            See Core314 in Action
          </h2>
          <p 
            className="text-lg text-slate-600 max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            A unified platform for operational visibility and control
          </p>
        </motion.div>

        {/* Two-column layout: Carousel left, Narrative right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left Column - Carousel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
          >
            {/* Main Carousel */}
            <div className="overflow-hidden rounded-xl bg-white border border-slate-200 shadow-lg">
              <div 
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {screenshots.map((screenshot) => (
                  <div 
                    key={screenshot.id}
                    className="min-w-full"
                  >
                    {/* Real Screenshot Image - cropped to hide header with username/email */}
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                      <img 
                        src={screenshot.image}
                        alt={screenshot.title}
                        className="w-full absolute"
                        style={{ 
                          top: '-20%',
                          height: '140%',
                          objectFit: 'cover',
                          objectPosition: 'top'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-200"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="h-4 w-4 text-slate-700" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-200"
              aria-label="Next screenshot"
            >
              <ChevronRight className="h-4 w-4 text-slate-700" />
            </button>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {screenshots.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentIndex 
                      ? 'bg-sky-500 w-6' 
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Caption */}
            <div className="text-center mt-3">
              <p 
                className="text-sm font-semibold text-slate-800"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {screenshots[currentIndex].title}
              </p>
              <p 
                className="text-xs text-slate-500 mt-1"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {screenshots[currentIndex].description}
              </p>
            </div>
          </motion.div>

          {/* Right Column - Narrative Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center"
          >
            <h3 
              className="text-2xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              One Dashboard for All Your Operations
            </h3>
            
            <p 
              className="text-slate-600 mb-4 leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Core314 provides a unified command center where you can monitor the health and 
              performance of your entire business infrastructure. Instead of switching between 
              dozens of tools, you get a single view of what matters most.
            </p>

            <p 
              className="text-slate-600 mb-4 leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              The Integration Hub connects your existing tools without disrupting your workflows. 
              Whether it's your CRM, project management, communication platforms, or analytics 
              services, Core314 brings them together into one coherent system.
            </p>

            <p 
              className="text-slate-600 mb-6 leading-relaxed"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
                            Real-time metrics, system health indicators, and AI-governed insights help you 
                            identify emerging operational risk conditions with full context.
              The interface is designed for clarity, so you can make informed decisions quickly.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                </div>
                <p className="text-sm text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span className="font-medium text-slate-800">Unified visibility</span> across all connected systems and integrations
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                </div>
                <p className="text-sm text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span className="font-medium text-slate-800">Real-time monitoring</span> with health indicators and performance metrics
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                </div>
                <p className="text-sm text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span className="font-medium text-slate-800">Clean, intuitive interface</span> designed for operational clarity
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
