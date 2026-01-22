import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, type Variants } from 'framer-motion';
import { CheckCircle, Sparkles, TrendingUp, Shield, Users, Zap, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { initSupabaseClient } from '../lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

// Cubic bezier easing for smooth animations (typed as tuple for Framer Motion)
const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: EASE_OUT }
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

// =============================================================================
// ANIMATED SECTION COMPONENT
// =============================================================================

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// VALUE CARD COMPONENT
// =============================================================================

function ValueCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <motion.div 
      variants={fadeInUp}
      className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
    >
      <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-sky-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {title}
      </h3>
      <p className="text-slate-600 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
        {description}
      </p>
    </motion.div>
  );
}

// =============================================================================
// STEP CARD COMPONENT
// =============================================================================

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <motion.div variants={fadeInUp} className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h4 className="text-base font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {title}
        </h4>
        <p className="text-slate-600 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// PRIMARY BUTTON COMPONENT
// =============================================================================

function PrimaryButton({ 
  children, 
  onClick, 
  disabled = false,
  type = 'button',
  className = ''
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 px-8 py-4 
        bg-sky-500 text-white font-semibold rounded-lg
        shadow-md shadow-sky-500/25
        hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/30
        focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
        disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed
        transition-all duration-200
        ${className}
      `}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {children}
    </button>
  );
}

// =============================================================================
// SECONDARY BUTTON COMPONENT
// =============================================================================

function SecondaryButton({ 
  children, 
  onClick,
  className = ''
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2 px-8 py-4 
        bg-transparent text-sky-600 font-semibold rounded-lg
        border-2 border-sky-500
        hover:bg-sky-50 hover:border-sky-600
        focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
        transition-all duration-200
        ${className}
      `}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {children}
    </button>
  );
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
          <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Core<span className="text-sky-500">314</span><span className="text-slate-400 text-sm align-top ml-0.5">TM</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 text-xs font-medium rounded-full">
            <Shield className="w-3.5 h-3.5" />
            Invitation-Only
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
            Coming Soon
          </span>
        </div>
      </div>
    </header>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PartnersPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

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

    if (!formData.not_influencer_marketer) {
      errors.push('You must confirm you are not an influencer, marketer, or traffic-based promoter');
    }
    if (!formData.will_not_misrepresent_ai) {
      errors.push('You must confirm you will not represent Core314 as autonomous AI or outcome-guaranteed');
    }
    if (!formData.understands_decision_intelligence) {
      errors.push('You must confirm you understand Core314 provides decision intelligence, not decisions');
    }

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

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-12 w-12 text-sky-500" />
              </div>
            </motion.div>
            <h2 
              className="text-2xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Application Received
            </h2>
            <p className="text-slate-600 mb-8 max-w-md mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
              Thank you for your interest in the Core314 Partner Program. Your application has been received and is under review.
            </p>
            <p className="text-slate-500 text-sm mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
              If your background aligns with the program, a member of the Core314 team will contact you with next steps.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Return to Home
            </Link>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-white to-slate-50 pt-16 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-50 via-transparent to-transparent opacity-70" />
        <div className="max-w-6xl mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Badges */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-medium rounded-full">
                <Shield className="w-4 h-4" />
                Invitation-Only Program
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                <Sparkles className="w-4 h-4" />
                Coming Soon
              </span>
            </div>

            {/* Headline */}
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Partner with Core314
            </h1>
            <p 
              className="text-xl md:text-2xl text-slate-700 mb-4 max-w-3xl mx-auto"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Deliver the Next Generation of Operational Intelligence
            </p>
            <p 
              className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Join a select group of enterprise advisors, integrators, and operators helping organizations make better decisions across complex systems.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryButton onClick={scrollToForm}>
                Request Partner Invitation
                <ArrowRight className="w-5 h-5" />
              </PrimaryButton>
              <SecondaryButton onClick={() => document.getElementById('why-partner')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore the Partner Program
              </SecondaryButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Partner Section */}
      <section id="why-partner" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <AnimatedSection className="text-center mb-16">
            <h2 
              className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Why Partners Choose Core314
            </h2>
          </AnimatedSection>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <ValueCard
              icon={Sparkles}
              title="Differentiate Your Advisory Services"
              description="Core314 delivers a unified intelligence layer across tools, teams, and workflows - enabling clarity where dashboards and disconnected systems fail."
            />
            <ValueCard
              icon={TrendingUp}
              title="Increase Long-Term Client Value"
              description="Partners embed Core314 into operating models, not one-off projects - driving stickier relationships and ongoing strategic relevance."
            />
            <ValueCard
              icon={Shield}
              title="Built for Complex, High-Stakes Environments"
              description="Designed for organizations where decisions impact performance, compliance, and risk - not experimental automation."
            />
            <ValueCard
              icon={Zap}
              title="Aligned, Recurring Growth"
              description="Partners participate in long-term customer success through ongoing revenue alignment, not short-term referrals."
            />
          </motion.div>
        </div>
      </section>

      {/* What Makes Core314 Different */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm">
              <h2 
                className="text-2xl md:text-3xl font-bold text-slate-900 mb-6"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                A Platform Built for Decisions, Not Noise
              </h2>
              <p className="text-lg text-slate-600 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                Core314 sits above your clients' existing systems, observing operational signals and delivering contextual intelligence - so leaders understand what's happening, why it matters, and where to focus.
              </p>
              <div className="border-l-4 border-sky-500 pl-6 py-2">
                <p className="text-slate-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  This is not another dashboard.<br />
                  It is decision intelligence for organizations managing real complexity.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection className="text-center mb-16">
            <h2 
              className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              How the Core314 Partner Program Works
            </h2>
          </AnimatedSection>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <StepCard
              number={1}
              title="Request an Invitation"
              description="Submit a short application to determine alignment."
            />
            <StepCard
              number={2}
              title="Get Approved"
              description="Approved partners are onboarded individually to ensure quality and fit."
            />
            <StepCard
              number={3}
              title="Introduce Core314 Where It Fits"
              description="Partners recommend Core314 in environments where operational intelligence adds real value."
            />
            <StepCard
              number={4}
              title="Support Long-Term Adoption"
              description="Partners remain aligned as customers grow and mature."
            />
            <StepCard
              number={5}
              title="Earn Ongoing Revenue"
              description="Partners earn recurring revenue tied to long-term customer success."
            />
          </motion.div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-sky-600" />
                </div>
                <h2 
                  className="text-2xl md:text-3xl font-bold text-slate-900"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Who This Program Is Built For
                </h2>
              </div>
              <ul className="space-y-3 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                {[
                  'Fractional CTOs, COOs, and CIOs',
                  'Enterprise operations and transformation consultants',
                  'Systems integrators and managed service providers',
                  'Data, BI, ERP, and integration specialists',
                  'Advisors operating in regulated or complex environments'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-slate-500 text-sm border-t border-slate-100 pt-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                This program is intentionally selective and designed for professionals whose recommendations carry weight.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Invitation Only CTA */}
      <section className="py-24 bg-gradient-to-b from-white to-sky-50">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-700 rounded-full text-sm font-medium mb-6">
                <Shield className="w-4 h-4" />
                Invitation-Only
                <span className="mx-1">·</span>
                Launching Soon
              </div>
              <h2 
                className="text-2xl md:text-3xl font-bold text-slate-900 mb-4"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Invitation-Only · Launching Soon
              </h2>
              <p className="text-lg text-slate-600 mb-4 max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
                The Core314 Partner Program is currently in a controlled rollout phase. A limited number of partner applications are being accepted ahead of general availability.
              </p>
              <p className="text-slate-500 text-sm mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                Submitting a request does not guarantee acceptance.
              </p>
              <PrimaryButton onClick={scrollToForm}>
                Request Partner Invitation
                <ArrowRight className="w-5 h-5" />
              </PrimaryButton>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Responsible AI Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection>
            <div className="bg-sky-50 rounded-2xl border border-sky-100 p-8 md:p-12">
              <h2 
                className="text-2xl md:text-3xl font-bold text-slate-900 mb-6"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Responsible Intelligence, Built for Trust
              </h2>
              <p className="text-lg text-slate-700 mb-6 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                Core314 provides decision intelligence - not automated decision-making.
              </p>
              <p className="text-slate-600 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                Partners represent the platform as:
              </p>
              <ul className="space-y-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                {[
                  'Advisory and insight-driven',
                  'Human-in-the-loop',
                  'Designed to support judgment, not replace it'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <AnimatedSection>
            <h2 
              className="text-3xl md:text-4xl font-bold text-white mb-8"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Interested in Partnering with Core314?
            </h2>
            <PrimaryButton onClick={scrollToForm} className="bg-white text-sky-600 hover:bg-slate-100 shadow-lg">
              Request Partner Invitation
              <ArrowRight className="w-5 h-5" />
            </PrimaryButton>
          </AnimatedSection>
        </div>
      </section>

      {/* Application Form */}
      {showForm && (
        <section ref={formRef} className="py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4">
            <AnimatedSection>
              <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm">
                <div className="text-center mb-10">
                  <h2 
                    className="text-2xl md:text-3xl font-bold text-slate-900 mb-3"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Request Partner Invitation
                  </h2>
                  <p className="text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Complete the form below to submit your application. All fields are required.
                  </p>
                </div>

                {(error || validationErrors.length > 0) && (
                  <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
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
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
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
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
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
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
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
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
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
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div>
                      <label htmlFor="primary_industry" className="block text-sm font-medium text-slate-700 mb-2">
                        Primary Industry <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="primary_industry"
                        name="primary_industry"
                        value={formData.primary_industry}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900"
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
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900 resize-none"
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
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-slate-900 resize-none"
                      placeholder="Explain how you would position Core314 to your clients and where it fits in your service offerings..."
                    />
                  </div>

                  {/* Disqualification Questions */}
                  <div className="border-t border-slate-200 pt-8">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Qualification Confirmation
                    </h3>
                    <p className="text-sm text-slate-600 mb-6">
                      Please confirm the following statements. All must be answered "Yes" to submit your application.
                    </p>

                    <div className="space-y-4">
                      {[
                        { name: 'not_influencer_marketer', label: 'I am not an influencer, marketer, or traffic-based promoter' },
                        { name: 'will_not_misrepresent_ai', label: 'I will not represent Core314 as autonomous AI or outcome-guaranteed' },
                        { name: 'understands_decision_intelligence', label: 'I understand Core314 provides decision intelligence, not decisions' }
                      ].map(({ name, label }) => (
                        <div key={name} className="p-4 bg-slate-50 rounded-lg">
                          <p className="text-slate-700 mb-3">{label}</p>
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`${name}_radio`}
                                checked={formData[name as keyof FormData] === true}
                                onChange={() => handleRadioChange(name, true)}
                                className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                              />
                              <span className="text-slate-700">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`${name}_radio`}
                                checked={formData[name as keyof FormData] === false}
                                onChange={() => handleRadioChange(name, false)}
                                className="w-4 h-4 text-slate-400 focus:ring-slate-400"
                              />
                              <span className="text-slate-700">No</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal Acknowledgments */}
                  <div className="border-t border-slate-200 pt-8">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Legal Acknowledgments
                    </h3>
                    <p className="text-sm text-slate-600 mb-6">
                      Please acknowledge the following statements. All checkboxes must be checked to submit your application.
                    </p>

                    <div className="space-y-4">
                      {[
                        { name: 'ack_not_agent', label: 'I acknowledge I am not an agent, employee, or representative of Core314' },
                        { name: 'ack_no_misrepresent', label: 'I agree not to misrepresent Core314\'s AI capabilities' },
                        { name: 'ack_no_entitlement', label: 'I acknowledge this application does not create a partnership or entitlement' }
                      ].map(({ name, label }) => (
                        <label key={name} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            name={name}
                            checked={formData[name as keyof FormData] as boolean}
                            onChange={handleInputChange}
                            className="mt-1 w-4 h-4 text-sky-500 focus:ring-sky-500 rounded"
                          />
                          <span className="text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <PrimaryButton type="submit" disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Application
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </AnimatedSection>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
