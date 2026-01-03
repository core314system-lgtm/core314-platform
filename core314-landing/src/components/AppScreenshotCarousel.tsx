import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutDashboard, Network, BarChart3, Settings } from 'lucide-react';

interface Screenshot {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const screenshots: Screenshot[] = [
  {
    id: 1,
    title: "Operations Dashboard",
    description: "Unified view of operational health across all connected systems",
    icon: LayoutDashboard
  },
  {
    id: 2,
    title: "Integration Hub",
    description: "Connect and manage your business tools from one place",
    icon: Network
  },
  {
    id: 3,
    title: "Analytics & Insights",
    description: "Real-time metrics and operational scores",
    icon: BarChart3
  },
  {
    id: 4,
    title: "System Configuration",
    description: "Configure workflows, alerts, and automation rules",
    icon: Settings
  }
];

export default function AppScreenshotCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <section className="py-20 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
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

        {/* Carousel Container */}
        <div className="relative">
          {/* Main Carousel */}
          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-lg">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {screenshots.map((screenshot) => (
                <div 
                  key={screenshot.id}
                  className="min-w-full"
                >
                  {/* Screenshot Placeholder - Professional Preview Card */}
                  <div className="aspect-[16/9] bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 flex items-center justify-center p-8">
                    <div className="text-center max-w-lg">
                      <div className="bg-sky-100 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <screenshot.icon className="h-10 w-10 text-sky-600" />
                      </div>
                      <h3 
                        className="text-2xl font-bold text-slate-800 mb-3"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {screenshot.title}
                      </h3>
                      <p 
                        className="text-slate-600"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {screenshot.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-6 w-6 text-slate-700" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-6 w-6 text-slate-700" />
          </button>
        </div>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {screenshots.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentIndex 
                  ? 'bg-sky-500 w-8' 
                  : 'bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Caption */}
        <p 
          className="text-center text-sm text-slate-500 mt-6"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {screenshots[currentIndex].title}
        </p>
      </div>
    </section>
  );
}
