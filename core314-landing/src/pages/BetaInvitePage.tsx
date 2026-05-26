import { useState, useEffect } from 'react';
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
  Shield,
  Zap,
  BarChart3,
  FileText,
  Link2,
  Lightbulb,
  Users,
} from 'lucide-react';
import Footer from '../components/Footer';
import { initSupabaseClient } from '../lib/supabase';
import {
  SlackLogo,
  HubSpotLogo,
  QuickBooksLogo,
  GoogleCalendarLogo,
  GmailLogo,
  JiraLogo,
  TrelloLogo,
  TeamsLogo,
  GoogleSheetsLogo,
  AsanaLogo,
  SalesforceLogo,
  ZoomLogo,
  GitHubLogo,
  ZendeskLogo,
  NotionLogo,
  MondayLogo,
} from '../components/IntegrationLogos';

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

const allIntegrations = [
  { name: 'Slack', Logo: SlackLogo },
  { name: 'HubSpot', Logo: HubSpotLogo },
  { name: 'QuickBooks', Logo: QuickBooksLogo },
  { name: 'Google Calendar', Logo: GoogleCalendarLogo },
  { name: 'Gmail', Logo: GmailLogo },
  { name: 'Jira', Logo: JiraLogo },
  { name: 'Trello', Logo: TrelloLogo },
  { name: 'Microsoft Teams', Logo: TeamsLogo },
  { name: 'Google Sheets', Logo: GoogleSheetsLogo },
  { name: 'Asana', Logo: AsanaLogo },
  { name: 'Salesforce', Logo: SalesforceLogo },
  { name: 'Zoom', Logo: ZoomLogo },
  { name: 'GitHub', Logo: GitHubLogo },
  { name: 'Zendesk', Logo: ZendeskLogo },
  { name: 'Notion', Logo: NotionLogo },
  { name: 'Monday.com', Logo: MondayLogo },
];

const capabilities = [
  {
    icon: Zap,
    title: 'Signal Detection Engine',
    desc: 'AI continuously monitors your connected tools and identifies operational risks, bottlenecks, and anomalies that human review would miss.',
    color: 'sky',
  },
  {
    icon: FileText,
    title: 'AI Operational Briefs',
    desc: 'Written intelligence delivered in plain English \u2014 what is happening across your business, why it matters, and what to do about it.',
    color: 'indigo',
  },
  {
    icon: BarChart3,
    title: 'Operational Health Score',
    desc: 'A single score (0\u2013100) that tells you how healthy your operations are right now \u2014 with category breakdowns and trend tracking.',
    color: 'emerald',
  },
  {
    icon: Link2,
    title: 'Cross-System Intelligence',
    desc: 'Core314 connects data across all your tools to surface patterns no single tool can detect on its own.',
    color: 'amber',
  },
];

const scenarios = [
  {
    headline: 'Your sales pipeline says Q3 looks great.',
    problem: 'But Jira shows your delivery team is at 120% capacity.',
    result: 'Core314 catches that disconnect before it becomes a missed deadline and a lost client.',
  },
  {
    headline: 'A key team member\u2019s communication patterns have shifted.',
    problem: 'Slack activity dropped 60% and response times tripled over two weeks.',
    result: 'Core314 flags potential burnout or disengagement before it impacts delivery.',
  },
  {
    headline: 'QuickBooks shows rising costs but HubSpot shows flat revenue.',
    problem: 'Each tool looks fine in isolation. Together, they signal a margin squeeze.',
    result: 'Core314 connects the dots across systems and tells you exactly what is happening.',
  },
];

const influenceAreas = [
  {
    icon: Link2,
    title: 'Integration Priorities',
    desc: 'Tell us which tools matter most to your workflow \u2014 and we build those connections first.',
  },
  {
    icon: FileText,
    title: 'Brief Format & Delivery',
    desc: 'Shape how intelligence is written, structured, and delivered to match how you actually make decisions.',
  },
  {
    icon: Zap,
    title: 'Signal Detection',
    desc: 'Define what patterns and risks the AI should watch for based on real operational experience.',
  },
  {
    icon: Lightbulb,
    title: 'Workflows & UX',
    desc: 'Influence how the platform looks, feels, and operates \u2014 from dashboard layout to alert preferences.',
  },
];

export default function BetaInvitePage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [betaProgramActive, setBetaProgramActive] = useState<boolean | null>(null);

  // Check if beta program is still active
  useEffect(() => {
    (async () => {
      try {
        const supabase = await initSupabaseClient();
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'beta_program_active')
          .single();

        if (data) {
          setBetaProgramActive(data.value === true || data.value === 'true');
        } else {
          setBetaProgramActive(true); // Default to active if setting not found
        }
      } catch {
        setBetaProgramActive(true); // Default to active on error
      }
    })();
  }, []);

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

  // Show "program ended" page when beta is shut down
  if (betaProgramActive === false) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
              <span className="text-xl font-semibold text-slate-900">Core314</span>
            </Link>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Beta Program Has Ended
            </h1>
            <p className="text-lg text-slate-600 mb-4">
              Thank you to all our beta testers who helped shape Core314.
              The beta testing program has concluded.
            </p>
            <p className="text-slate-500 mb-8">
              Core314 is now available for general access. Visit our main site to learn more
              about our operational intelligence platform.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg shadow-sky-500/25"
            >
              Visit Core314.com
            </Link>
          </motion.div>
        </main>

        <Footer />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
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

  const iconBg: Record<string, string> = {
    sky: 'bg-sky-50',
    indigo: 'bg-indigo-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
  };
  const iconColor: Record<string, string> = {
    sky: 'text-sky-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* HERO SECTION */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-transparent to-slate-50 rounded-3xl -z-10" />
          
          <div className="py-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
              </span>
              Limited to 25 Beta Testers
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              See What&apos;s Really Happening<br />Across Your Business &mdash; Before Anyone Else
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-4 leading-relaxed">
              Core314 is an AI-powered operational intelligence platform that connects your business tools,
              detects hidden risks, and delivers written briefs so you always know what is going on &mdash;
              without checking a single dashboard.
            </p>
            <p className="text-base text-slate-500 max-w-2xl mx-auto mb-8">
              The beta program is your chance to shape the platform alongside real operators
              facing real challenges &mdash; and lock in 50% off for 6 months after launch.
            </p>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg shadow-sky-500/25"
            >
              Apply for Beta Access
            </button>
          </div>
        </motion.section>

        {/* WHAT IS CORE314? */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">What is Core314?</h2>
                <p className="text-slate-600 leading-relaxed">
                  Core314 is an Operational Intelligence Platform built for leadership teams.
                  It connects to the business tools you already use, monitors them continuously with AI,
                  and delivers clear, written intelligence about what is happening across your entire operation &mdash;
                  so you can act on facts instead of gut feelings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div key={cap.title} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50">
                    <div className={`w-10 h-10 ${iconBg[cap.color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${iconColor[cap.color]}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm mb-1">{cap.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{cap.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* INTEGRATION LOGOS BAR */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
            Connects with the tools your team already uses
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 items-center justify-items-center">
            {allIntegrations.map(({ name, Logo }) => (
              <div key={name} className="group flex flex-col items-center gap-1.5" title={name}>
                <Logo className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors hidden sm:block">{name}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* HOW CORE314 IMPROVES YOUR OPERATIONS */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How Core314 Improves Your Operations</h2>
              <p className="text-slate-600">
                Core314 catches the problems that hide between your tools. Here are real scenarios the platform is built to detect:
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {scenarios.map((s, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-5 bg-slate-50/50">
                <p className="font-semibold text-slate-900 mb-1">{s.headline}</p>
                <p className="text-slate-500 text-sm mb-2">{s.problem}</p>
                <p className="text-sky-700 text-sm font-medium flex items-start gap-2">
                  <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {s.result}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* WHY BETA TESTERS MATTER */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Why Beta Testers Matter</h2>
              <p className="text-slate-600">
                You are not just testing software &mdash; you are building the operational intelligence tool you wish existed.
                Beta testers directly influence how Core314 works.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {influenceAreas.map((area) => {
              const Icon = area.icon;
              return (
                <div key={area.title} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">{area.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{area.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* WHAT BETA TESTERS RECEIVE */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
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
                  Full Core314 platform access for 45 days
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Direct access to the product team
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Direct influence on product direction and roadmap
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Priority onboarding when the platform launches
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <strong>50% discount for the first 6 months after launch</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Early access to new capabilities before public release
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* WHAT WE EXPECT */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
                  Real workflow usage with your actual business tools
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  30-day minimum active participation commitment
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Structured, honest feedback on what works and what does not
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Working partnership &mdash; not a passive preview or free trial
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* WHO THIS IS FOR / NOT FOR */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Who This Is For</h2>
                <ul className="space-y-2 text-slate-600 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Operators, managers, founders, directors
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Teams using 3+ business tools daily
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Multi-system, multi-team environments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    People who feel the pain of operational fragmentation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Comfortable giving candid, constructive feedback
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Filter className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Who This Is Not For</h2>
                <ul className="space-y-2 text-slate-500 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    Casual testers looking for something to try
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
                    Low-engagement or passive participants
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    Single-tool environments with no cross-system needs
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* APPLICATION FORM */}
        <motion.section
          id="beta-application-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-slate-200 p-8 mb-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Beta Application</h2>
              <p className="text-slate-600 mt-1">
                Complete the form below to apply for beta access. All fields are required.
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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
              />
            </div>

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
              />
            </div>

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Size <span className="text-red-500">*</span>
              </label>
              <select
                name="company_size"
                value={formData.company_size}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors bg-white text-slate-900"
              >
                <option value="">Select company size</option>
                <option value="1-10">1&ndash;10 employees</option>
                <option value="11-100">11&ndash;100 employees</option>
                <option value="100+">100+ employees</option>
              </select>
            </div>

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none text-slate-900"
              />
            </div>

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none text-slate-900"
              />
            </div>

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors resize-none text-slate-900"
              />
            </div>

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
          transition={{ delay: 0.45 }}
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
