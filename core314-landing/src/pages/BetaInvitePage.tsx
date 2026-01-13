import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  CheckCircle, 
  Layers, 
  Star, 
  ClipboardCheck, 
  Target, 
  Filter, 
  ClipboardList,
  Shield
} from 'lucide-react';
import Footer from '../components/Footer';
import { initSupabaseClient } from '../lib/supabase';

interface FormData {
  full_name: string;
  email: string;
  role_title: string;
  company_size: string;
  tools_systems_used: string;
  biggest_challenge: string;
  why_beta_test: string;
}

const initialFormData: FormData = {
  full_name: '',
  email: '',
  role_title: '',
  company_size: '',
  tools_systems_used: '',
  biggest_challenge: '',
  why_beta_test: '',
};

export default function BetaInvitePage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setValidationErrors([]);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.full_name.trim()) errors.push('Full name is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Invalid email format');
    }
    if (!formData.role_title.trim()) errors.push('Role/title is required');
    if (!formData.company_size) errors.push('Company size is required');
    if (!formData.tools_systems_used.trim()) errors.push('Tools/systems currently used is required');
    if (!formData.biggest_challenge.trim()) errors.push('Biggest operational challenge is required');
    if (!formData.why_beta_test.trim()) errors.push('Why you want to beta test is required');

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = initSupabaseClient();
      const supabaseUrl = supabase ? 
        (supabase as unknown as { supabaseUrl: string }).supabaseUrl || 
        import.meta.env.VITE_SUPABASE_URL : 
        import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/beta-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          years_experience: parseInt(formData.company_size) || 0,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    const formElement = document.getElementById('beta-application-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
              <span className="text-xl font-semibold text-slate-900">Core314</span>
            </Link>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wide">
              Invitation-Only Beta
            </span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-sky-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Application Received
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Thank you for your interest in the Core314 Beta Program.
              Your application has been received and is under review.
            </p>
            <p className="text-slate-500 mb-8">
              If your background aligns with the program, a member of the Core314 team will contact you with next steps.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </motion.div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <span className="text-xl font-semibold text-slate-900">Core314</span>
          </Link>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wide">
            Invitation-Only Beta
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 relative"
        >
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-transparent to-slate-50 rounded-3xl -z-10" />
          
          <div className="py-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Help Shape the Future of<br />Operational Intelligence
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8 leading-relaxed">
              Core314 is opening a limited, invitation-only beta for operators who want to influence 
              how modern systems are observed, analyzed, and acted upon.
            </p>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg shadow-sky-500/25"
            >
              Apply for Beta Access
            </button>
          </div>
        </motion.section>

        {/* What This Beta Is */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">What This Beta Is</h2>
              <p className="text-slate-600 mb-4">
                This is a collaborative beta program designed to shape Core314 alongside real operators 
                facing real operational challenges. It is not early access or a preview—it is a working partnership.
              </p>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                  Built for real operational workflows
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                  Free during beta
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                  Limited to 25 participants
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                  30-day minimum participation
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* What Beta Testers Receive */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">What Beta Testers Receive</h2>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Full Core314 access during beta
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Direct influence on product direction
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Priority onboarding post-launch
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <strong>50% discount for first 6 months after launch</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Early access to new capabilities
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* What We Expect */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">What We Expect from Beta Testers</h2>
              <p className="text-slate-600 mb-4">
                Beta testers are partners, not passive observers. We expect active engagement and honest feedback.
              </p>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Real workflow usage
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  30-day participation commitment
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Structured, honest feedback
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Working partnership (not passive preview)
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Who This Beta Is For */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Who This Beta Is For</h2>
              <p className="text-slate-600 mb-4">
                This beta is designed for professionals who operate in complex, multi-system environments 
                and understand the pain of operational fragmentation.
              </p>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Operators, managers, founders, directors
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Multi-system environments
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Operational fragmentation pain
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Comfortable giving candid feedback
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Who This Beta Is NOT For */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Filter className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Who This Beta Is Not For</h2>
              <p className="text-slate-600 mb-4">
                To maintain quality and focus, this beta is not suitable for:
              </p>
              <ul className="space-y-2 text-slate-500">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  Casual testers
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  Students or hobby users
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  Free-software seekers
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  Low-engagement participants
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Application Form */}
        <motion.section
          id="beta-application-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Beta Application</h2>
              <p className="text-slate-600 mt-1">
                Complete the form below to apply for beta access.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 font-medium text-sm mb-2">Please correct the following:</p>
              <ul className="list-disc list-inside text-amber-700 text-sm space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Your full name"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
              />
            </div>

            {/* Role / Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="role_title"
                value={formData.role_title}
                onChange={handleInputChange}
                placeholder="e.g., Operations Manager, Founder, Director"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
              />
            </div>

            {/* Company Size */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Size <span className="text-red-500">*</span>
              </label>
              <select
                name="company_size"
                value={formData.company_size}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors bg-white"
              >
                <option value="">Select company size</option>
                <option value="1-10">1–10 employees</option>
                <option value="11-100">11–100 employees</option>
                <option value="100+">100+ employees</option>
              </select>
            </div>

            {/* Tools/Systems Used */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tools/Systems Currently Used <span className="text-red-500">*</span>
              </label>
              <textarea
                name="tools_systems_used"
                value={formData.tools_systems_used}
                onChange={handleInputChange}
                placeholder="List the tools and systems you currently use for operations (e.g., Salesforce, HubSpot, Slack, Notion, etc.)"
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Biggest Challenge */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Biggest Operational Challenge <span className="text-red-500">*</span>
              </label>
              <textarea
                name="biggest_challenge"
                value={formData.biggest_challenge}
                onChange={handleInputChange}
                placeholder="Describe your biggest operational challenge or pain point..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Why Beta Test */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Why Do You Want to Beta Test Core314? <span className="text-red-500">*</span>
              </label>
              <textarea
                name="why_beta_test"
                value={formData.why_beta_test}
                onChange={handleInputChange}
                placeholder="Explain why you're interested in participating in the Core314 beta program..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Beta Application'}
            </button>
          </form>
        </motion.section>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-3 text-slate-500 text-sm py-8"
        >
          <Shield className="w-4 h-4" />
          <p>
            Beta access is limited and by invitation only. Submitting an application does not guarantee acceptance.
          </p>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
