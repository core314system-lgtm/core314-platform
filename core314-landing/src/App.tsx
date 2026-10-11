import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ServicePage from './pages/ServicePage';
import OurWorkPage from './pages/OurWorkPage';
import ProcuvexPage from './pages/ProcuvexPage';
import HowWeWorkPage from './pages/HowWeWorkPage';
import IndustriesPage from './pages/IndustriesPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import CookiesPage from './pages/CookiesPage';
import DPAPage from './pages/DPAPage';
import AIDisclaimerPage from './pages/AIDisclaimerPage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServicePage />} />
        <Route path="/industries" element={<IndustriesPage />} />
        <Route path="/our-work" element={<OurWorkPage />} />
        <Route path="/our-work/procuvex" element={<ProcuvexPage />} />
        <Route path="/how-we-work" element={<HowWeWorkPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/dpa" element={<DPAPage />} />
        <Route path="/ai-disclaimer" element={<AIDisclaimerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
