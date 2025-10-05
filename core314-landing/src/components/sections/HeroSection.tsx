import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

export function HeroSection() {
  const scrollToSignup = () => {
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-core314-navy via-gray-900 to-core314-navy overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-core314-electric-blue/10 border border-core314-electric-blue/20 mb-8">
          <span className="text-core314-electric-blue font-medium">AI-Powered Operations Platform</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Unify Your Operations.<br />
          <span className="text-core314-electric-blue">Control Everything</span><br />
          from One AI-Powered Dashboard.
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
          Core314 connects your workflows across QuickBase, Costpoint, ADP, and more — giving you real-time visibility, predictive insights, and operational control.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-core314-electric-blue hover:bg-core314-electric-blue/90 text-white text-lg px-8 py-6"
            onClick={scrollToSignup}
          >
            Request Early Access
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Learn More
          </Button>
        </div>
        
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-2">7+</div>
            <div className="text-gray-400">Integrations</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-2">99.9%</div>
            <div className="text-gray-400">Uptime</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-2">24/7</div>
            <div className="text-gray-400">AI Monitoring</div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent dark:from-gray-950"></div>
    </section>
  );
}
