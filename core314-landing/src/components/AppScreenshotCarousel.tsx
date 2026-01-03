import { useState } from 'react';
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
                  {/* Real Screenshot Image - cropped to hide header with username/email */}
                  <div className="aspect-[16/9] bg-slate-100 overflow-hidden relative">
                    <img 
                      src={screenshot.image}
                      alt={screenshot.title}
                      className="w-full absolute"
                      style={{ 
                        top: '-18%',
                        height: '136%',
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
        <div className="text-center mt-6">
          <p 
            className="text-lg font-semibold text-slate-800"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {screenshots[currentIndex].title}
          </p>
          <p 
            className="text-sm text-slate-500 mt-1"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {screenshots[currentIndex].description}
          </p>
        </div>
      </div>
    </section>
  );
}
