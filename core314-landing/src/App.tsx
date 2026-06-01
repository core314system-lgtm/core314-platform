import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ProductsPage from './pages/ProductsPage';
import ProcuvexPage from './pages/ProcuvexPage';
import EnterprisePage from './pages/EnterprisePage';
import ContactPage from './pages/ContactPage';
import PartnersPage from './pages/PartnersPage';
import AffiliatePage from './pages/AffiliatePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import CookiesPage from './pages/CookiesPage';
import DPAPage from './pages/DPAPage';
import AIDisclaimerPage from './pages/AIDisclaimerPage';
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
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/procuvex" element={<ProcuvexPage />} />
        <Route path="/enterprise" element={<EnterprisePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/affiliate" element={<AffiliatePage />} />
        <Route path="/affiliate/apply" element={<AffiliatePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/dpa" element={<DPAPage />} />
        <Route path="/ai-disclaimer" element={<AIDisclaimerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
