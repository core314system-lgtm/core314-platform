import { HeroSection } from './components/sections/HeroSection';
import { ValueProposition } from './components/sections/ValueProposition';
import { HowItWorks } from './components/sections/HowItWorks';
import { KeyFeatures } from './components/sections/KeyFeatures';
import { Industries } from './components/sections/Industries';
import { PricingSection } from './components/sections/PricingSection';
import { LeadCaptureForm } from './components/sections/LeadCaptureForm';
import { Footer } from './components/sections/Footer';

function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <HeroSection />
      <ValueProposition />
      <HowItWorks />
      <KeyFeatures />
      <Industries />
      <PricingSection />
      <LeadCaptureForm />
      <Footer />
    </div>
  );
}

export default App;
