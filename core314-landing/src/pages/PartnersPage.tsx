import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Shield, Users, DollarSign, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';
import { initSupabaseClient } from '../lib/supabase';

interface FormData {
  full_name: string;
  email: string;
  company: string;
  role_title: string;
  years_experience: string;
  primary_industry: string;
  how_advises_orgs: string;
  how_core314_fits: string;
  not_influencer_marketer: boolean;
  will_not_misrepresent_ai: boolean;
  understands_decision_intelligence: boolean;
  ack_not_agent: boolean;
  ack_no_misrepresent: boolean;
  ack_no_entitlement: boolean;
}

const initialFormData: FormData = {
  full_name: '',
  email: '',
  company: '',
  role_title: '',
  years_experience: '',
  primary_industry: '',
  how_advises_orgs: '',
  how_core314_fits: '',
  not_influencer_marketer: false,
  will_not_misrepresent_ai: false,
  understands_decision_intelligence: false,
  ack_not_agent: false,
  ack_no_misrepresent: false,
  ack_no_entitlement: false,
};

export default function PartnersPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
    setValidationErrors([]);
  };

  const handleRadioChange = (name: string, value: boolean) => {
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
    if (!formData.company.trim()) errors.push('Company is required');
    if (!formData.role_title.trim()) errors.push('Role/title is required');
    if (!formData.years_experience) errors.push('Years of experience is required');
    if (!formData.primary_industry.trim()) errors.push('Primary industry is required');
    if (!formData.how_advises_orgs.trim()) errors.push('Description of advisory work is required');
    if (!formData.how_core314_fits.trim()) errors.push('Description of how Core314 fits is required');

    // Disqualification questions
    if (!formData.not_influencer_marketer) {
      errors.push('You must confirm you are not an influencer, marketer, or traffic-based promoter');
    }
    if (!formData.will_not_misrepresent_ai) {
      errors.push('You must confirm you will not represent Core314 as autonomous AI or outcome-guaranteed');
    }
    if (!formData.understands_decision_intelligence) {
      errors.push('You must confirm you understand Core314 provides decision intelligence, not decisions');
    }

    // Legal acknowledgments
    if (!formData.ack_not_agent) {
      errors.push('You must acknowledge you are not an agent, employee, or representative of Core314');
    }
    if (!formData.ack_no_misrepresent) {
      errors.push('You must agree not to misrepresent Core314\'s AI capabilities');
    }
    if (!formData.ack_no_entitlement) {
      errors.push('You must acknowledge this application does not create a partnership or entitlement');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const supabase = await initSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get the Supabase URL from the client
      const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl || 
                          import.meta.env.VITE_SUPABASE_URL || 
                          'https://ygvkegcstaowikessigx.supabase.co';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/partner-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          years_experience: parseInt(formData.years_experience, 10),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details?.join(', ') || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Application submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Core<span className="text-sky-500">314</span>
            </span>
          </Link>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full uppercase tracking-wide">
            Invite-Only Program
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-6"
            >
              <CheckCircle className="h-20 w-20 text-sky-500 mx-auto" />
            </motion.div>
            <h2 
              className="text-2xl font-semibold text-slate-900 mb-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Thank you. Your application has been received and is under review.
            </h2>
            <p className="text-slate-600 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
              If your background aligns with the program, a member of the Core314 team will contact you with next steps.
            </p>
            <Link
              to="/"
              className="inline-block px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Return to Home
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                Enterprise Partners
              </div>
              <h1 
                className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
              >
                Core314 Partner Program
              </h1>
              <p 
                className="text-xl text-slate-700 mb-6"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Build the Future of Operational Intelligence—With the Right Partners
              </p>
              <p className="text-slate-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
                The Core314 Partner Program is designed for experienced professionals who advise organizations on operations, systems, and decision-making—and who recognize that modern enterprises require intelligence before automation.
              </p>
              <p className="text-slate-500 mt-4 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                This is not a mass-market affiliate program.<br />
                It is a select, credibility-driven partner ecosystem.
              </p>
            </motion.div>

            {/* Content Sections */}
            <div className="space-y-8 mb-12">
              {/* What the Program Is */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  What the Core314 Partner Program Is
                </h2>
                <p className="text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Core314 is an enterprise platform that delivers decision intelligence across complex business systems. It observes, analyzes, and contextualizes operational data to support better human decisions—without replacing judgment or authority.
                </p>
                <p className="text-slate-600 mt-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  The Partner Program exists to work with professionals who already advise decision-makers and understand operational complexity. Partners introduce Core314 where it genuinely fits and are rewarded for long-term customer success.
                </p>
              </motion.section>

              {/* Who This Is For */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <Users className="h-6 w-6 text-sky-500 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Who This Program Is Designed For
                    </h2>
                    <p className="text-slate-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                      This program is intended for professionals operating close to executive and operational leadership, including:
                    </p>
                    <ul className="text-slate-600 space-y-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <li>Fractional CTOs, COOs, and CIOs</li>
                      <li>Enterprise operations consultants</li>
                      <li>Systems integrators and MSPs</li>
                      <li>Data, BI, ERP, and integration specialists</li>
                      <li>GovTech, compliance, or regulated-industry advisors</li>
                      <li>Trusted internal champions with cross-functional influence</li>
                    </ul>
                    <p className="text-slate-500 mt-4 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Partners are expected to bring context, credibility, and judgment—not volume.
                    </p>
                  </div>
                </div>
              </motion.section>

              {/* Who This Is NOT For */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-100 border border-slate-200 rounded-xl p-6 md:p-8"
              >
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Who This Program Is Not For
                    </h2>
                    <p className="text-slate-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                      This program is not suitable for:
                    </p>
                    <ul className="text-slate-600 space-y-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <li>Influencers or content creators</li>
                      <li>Performance marketers or media buyers</li>
                      <li>Coupon, deal, or traffic-driven promoters</li>
                      <li>SEO arbitrage or mass email campaigns</li>
                      <li>Anyone promoting "fully autonomous AI" or guaranteed outcomes</li>
                    </ul>
                    <p className="text-slate-700 mt-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Applicants relying on oversimplification, urgency, or hype will not be approved.
                    </p>
                  </div>
                </div>
              </motion.section>

              {/* Revenue Sharing */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <DollarSign className="h-6 w-6 text-emerald-500 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      How Revenue Sharing Works
                    </h2>
                    <p className="text-slate-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Approved partners receive:
                    </p>
                    <ul className="text-slate-600 space-y-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <li><strong>25% recurring revenue share</strong></li>
                      <li>Paid on net collected subscription revenue</li>
                      <li>For the lifetime of the customer relationship</li>
                    </ul>
                    <p className="text-slate-500 mt-4 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Revenue sharing rewards quality introductions, responsible positioning, and long-term customer success. There are no upfront bounties or volume incentives.
                    </p>
                  </div>
                </div>
              </motion.section>

              {/* AI Responsibility */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-sky-50 border border-sky-200 rounded-xl p-6 md:p-8"
              >
                <h2 className="text-xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  AI Responsibility & Platform Positioning
                </h2>
                <p className="text-slate-700 mb-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Core314 provides decision intelligence, not automated decision-making.
                </p>
                <p className="text-slate-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Partners must represent that:
                </p>
                <ul className="text-slate-600 space-y-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <li>Core314 delivers insights and analysis</li>
                  <li>Decisions remain the responsibility of the customer</li>
                  <li>Human review is required</li>
                  <li>Outcomes are not guaranteed</li>
                </ul>
              </motion.section>
            </div>

            {/* Application Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-10 shadow-sm"
            >
              <div className="text-center mb-8">
                <h2 
                  className="text-2xl font-semibold text-slate-900 mb-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Application Process
                </h2>
                <p className="text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                  The Core314 Partner Program is application-based and invite-only.<br />
                  Submitting an application does not guarantee acceptance.
                </p>
              </div>

              {(error || validationErrors.length > 0) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  {error && <p className="text-red-700 font-medium">{error}</p>}
                  {validationErrors.length > 0 && (
                    <ul className="text-red-600 text-sm mt-2 space-y-1">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company / Organization <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="Your company or organization"
                    />
                  </div>
                  <div>
                    <label htmlFor="role_title" className="block text-sm font-medium text-slate-700 mb-2">
                      Current Role / Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="role_title"
                      name="role_title"
                      value={formData.role_title}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="e.g., Fractional CTO, Operations Consultant"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="years_experience" className="block text-sm font-medium text-slate-700 mb-2">
                      Years of Professional Experience <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="years_experience"
                      name="years_experience"
                      value={formData.years_experience}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <label htmlFor="primary_industry" className="block text-sm font-medium text-slate-700 mb-2">
                      Primary Industry / Industries Served <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="primary_industry"
                      name="primary_industry"
                      value={formData.primary_industry}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900"
                      placeholder="e.g., Healthcare, Financial Services, GovTech"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="how_advises_orgs" className="block text-sm font-medium text-slate-700 mb-2">
                    How do you advise or support organizations? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="how_advises_orgs"
                    name="how_advises_orgs"
                    value={formData.how_advises_orgs}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900 resize-none"
                    placeholder="Describe your advisory work, the types of organizations you work with, and the problems you help solve..."
                  />
                </div>

                <div>
                  <label htmlFor="how_core314_fits" className="block text-sm font-medium text-slate-700 mb-2">
                    How does Core314 fit into your professional or advisory work? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="how_core314_fits"
                    name="how_core314_fits"
                    value={formData.how_core314_fits}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors text-slate-900 resize-none"
                    placeholder="Explain how you would position Core314 to your clients and where it fits in your service offerings..."
                  />
                </div>

                {/* Disqualification Questions */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Qualification Confirmation
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Please confirm the following statements. All must be answered "Yes" to submit your application.
                  </p>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-slate-700 mb-3">
                        I am not an influencer, marketer, or traffic-based promoter
                      </p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="not_influencer_marketer_radio"
                            checked={formData.not_influencer_marketer === true}
                            onChange={() => handleRadioChange('not_influencer_marketer', true)}
                            className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                          />
                          <span className="text-slate-700">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="not_influencer_marketer_radio"
                            checked={formData.not_influencer_marketer === false}
                            onChange={() => handleRadioChange('not_influencer_marketer', false)}
                            className="w-4 h-4 text-slate-400 focus:ring-slate-400"
                          />
                          <span className="text-slate-700">No</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-slate-700 mb-3">
                        I will not represent Core314 as autonomous AI or outcome-guaranteed
                      </p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="will_not_misrepresent_ai_radio"
                            checked={formData.will_not_misrepresent_ai === true}
                            onChange={() => handleRadioChange('will_not_misrepresent_ai', true)}
                            className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                          />
                          <span className="text-slate-700">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="will_not_misrepresent_ai_radio"
                            checked={formData.will_not_misrepresent_ai === false}
                            onChange={() => handleRadioChange('will_not_misrepresent_ai', false)}
                            className="w-4 h-4 text-slate-400 focus:ring-slate-400"
                          />
                          <span className="text-slate-700">No</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-slate-700 mb-3">
                        I understand Core314 provides decision intelligence, not decisions
                      </p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="understands_decision_intelligence_radio"
                            checked={formData.understands_decision_intelligence === true}
                            onChange={() => handleRadioChange('understands_decision_intelligence', true)}
                            className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                          />
                          <span className="text-slate-700">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="understands_decision_intelligence_radio"
                            checked={formData.understands_decision_intelligence === false}
                            onChange={() => handleRadioChange('understands_decision_intelligence', false)}
                            className="w-4 h-4 text-slate-400 focus:ring-slate-400"
                          />
                          <span className="text-slate-700">No</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal Acknowledgments */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Legal Acknowledgments
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Please acknowledge the following statements. All checkboxes must be checked to submit your application.
                  </p>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ack_not_agent"
                        checked={formData.ack_not_agent}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-sky-500 focus:ring-sky-500 rounded"
                      />
                      <span className="text-slate-700">
                        I acknowledge I am not an agent, employee, or representative of Core314
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ack_no_misrepresent"
                        checked={formData.ack_no_misrepresent}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-sky-500 focus:ring-sky-500 rounded"
                      />
                      <span className="text-slate-700">
                        I agree not to misrepresent Core314's AI capabilities
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ack_no_entitlement"
                        checked={formData.ack_no_entitlement}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-sky-500 focus:ring-sky-500 rounded"
                      />
                      <span className="text-slate-700">
                        I acknowledge this application does not create a partnership or entitlement
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-8 py-4 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
                >
                  {loading ? 'Submitting...' : 'Apply to Become a Core314 Partner'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
