import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FileText, Brain, Shield, Users, DollarSign, ClipboardCheck,
  Target, Kanban, BarChart3, Zap, Building2, ArrowRight,
  Upload, CheckCircle, FileCheck, Scale, Crosshair, Mail,
  Database, Award, ShieldCheck, Briefcase, Palette, UserCheck,
  ListChecks, Search, KeyRound, Clipboard, Contact2, MessageSquare,
  CheckSquare, Wand2, Bell, Sparkles,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

interface Module {
  icon: React.ElementType
  title: string
  desc: string
  features: string[]
  enterpriseOnly?: boolean
}

const modules: Module[] = [
  {
    icon: Upload,
    title: 'Document Upload & Organization',
    desc: 'Upload SOWs, pricing sheets, amendments, exhibits, and supporting documents. Procuvex organizes them by category with drag-and-drop support.',
    features: ['10 document categories', 'PDF, DOCX, XLSX support', 'Bulk upload', 'Automatic category detection'],
  },
  {
    icon: Brain,
    title: 'AI Document Analysis',
    desc: 'AI reads your entire document set and extracts every requirement, service category, unclear item, pricing risk, and key metadata in seconds.',
    features: ['Requirement extraction', 'Service category identification', 'Unclear item flagging', 'Pricing alignment analysis', 'Period of performance detection'],
  },
  {
    icon: Shield,
    title: 'Compliance Matrix',
    desc: 'Automatically generates a compliance matrix mapping each requirement to your response status: compliant, partially compliant, or non-compliant.',
    features: ['Auto-generated from analysis', 'Exportable to Excel/PDF', 'Editable response status', 'Evidence linking'],
  },
  {
    icon: FileText,
    title: 'RFQ Package Generator',
    desc: 'Creates ready-to-send Request for Quote packages for each service category, pre-populated with scope details and subcontractor requirements.',
    features: ['Per-category packages', 'Email integration', 'Quote tracking', 'Response management'],
  },
  {
    icon: DollarSign,
    title: 'Pricing & Risk Analysis',
    desc: 'AI identifies pricing risks, labor category concerns, material cost variables, and areas where your proposal might be under- or over-estimated.',
    features: ['Risk severity ratings', 'Mitigation recommendations', 'Cost driver identification', 'Market rate comparisons'],
  },
  {
    icon: ClipboardCheck,
    title: 'Executive Summary',
    desc: 'Generates a polished executive summary of the opportunity suitable for internal review, go/no-go decisions, and management briefings.',
    features: ['One-click generation', 'Customizable format', 'Key metrics highlighted', 'Export to Word/PDF'],
  },
  {
    icon: Target,
    title: 'SOW Bid Management',
    desc: 'Track each SOW line item, assign subcontractors, manage quotes, and monitor pricing across the entire bid package.',
    features: ['Line item tracking', 'Subcontractor assignment', 'Quote comparison', 'Custom form builder'],
  },
  {
    icon: FileCheck,
    title: 'AI Quote Compliance Engine',
    desc: 'Every subcontractor quote is automatically analyzed by AI against the Statement of Work requirements. Gaps are identified, compliance scores generated, and subcontractors notified — all without manual review.',
    features: ['Automatic SOW compliance analysis', 'Compliance score (0–100%) per quote', 'Gap identification & pricing analysis', 'Automated email notifications to subs', 'One-click re-analysis after revisions'],
  },
  {
    icon: Scale,
    title: 'Pricing Decision Matrix',
    desc: 'Compare every subcontractor quote side by side across all SOW line items. AI-powered weighted scoring ranks subs by best value using FAR 15.101-1 criteria. Export to Excel or PDF for source selection boards.',
    features: ['Side-by-side quote comparison grid', 'Weighted scoring (Price, Compliance, Past Performance, Certs)', 'AI compliance score overlay per quote', 'Excel workbook & PDF export', 'Markup profiles & option year projections'],
  },
  {
    icon: Crosshair,
    title: 'Radius-Based Sub Matching',
    desc: 'Find subcontractors within a configurable mile radius of your project site. Combine Local (10–200 mi), Regional (adjacent states), and National scopes in a single search.',
    features: ['Configurable radius: 10, 25, 50, 100, 150, 200 miles', 'Combinable scope checkboxes (Local + Regional + National)', 'Distance shown on each result card', 'Proximity bonus scoring — closer subs rank higher'],
  },
  {
    icon: Brain,
    title: 'AI SOW-to-Trade Mapping',
    desc: 'Upload your SOW and AI maps each line item to the closest trade category from the 45-trade taxonomy. Per-trade queries ensure every SOW item gets subcontractor coverage.',
    features: ['AI-assisted label mapping via GPT-4o-mini', 'Collapsible SOW Coverage Breakdown table', 'Per-SOW sub count and match status', 'Fallback to raw trades if AI unavailable'],
  },
  {
    icon: Mail,
    title: 'RFQ Composer',
    desc: 'Customize RFQ emails before sending. Select a template, insert merge fields ({org_name}, {project_title}, {due_date}), preview exactly what subs receive, then send.',
    features: ['10 auto-populated merge fields', 'Editable template with rich text', 'Live email preview before send', 'Custom note callout for urgency'],
  },
  {
    icon: Database,
    title: 'Organization Sub Database',
    desc: 'Maintain a private, organization-owned subcontractor database isolated from the master network. Import your own subs or promote from the master DB.',
    features: ['Private org-level sub records', 'Independent from master database', 'CSV/manual import', 'Promote master DB subs to your org'],
  },
  {
    icon: Kanban,
    title: 'Pipeline & Workflow Engine',
    desc: 'Customizable workflow stages per project type. Kanban board view shows every bid in your pipeline at a glance.',
    features: ['Industry-specific stages', 'Drag-and-drop pipeline', 'Stage change audit trail', 'Team assignments per stage'],
  },
  {
    icon: Users,
    title: 'Subcontractor Management',
    desc: 'Maintain a database of subcontractors with capabilities, certifications, past performance, and automated matching to project requirements.',
    features: ['Capability profiles', 'AI-powered matching', 'RFQ email integration', 'Performance tracking'],
  },
  {
    icon: BarChart3,
    title: 'Analytics & Intelligence',
    desc: 'Cross-project metrics dashboard showing win rates, project distribution, monthly trends, upcoming deadlines, and competitor landscape.',
    features: ['Win/loss analysis', 'Pipeline value tracking', 'Competitor profiles', 'Bid readiness scoring'],
  },
  {
    icon: Zap,
    title: 'Integrations',
    desc: 'Search SAM.gov for federal opportunities, import projects from CSV/Excel, or connect via REST API from your CRM, ERP, or custom tools.',
    features: ['SAM.gov search & import', 'CSV/Excel bulk import', 'REST API (create/list)', 'API key authentication'],
  },
  {
    icon: Building2,
    title: 'Intelligence Library',
    desc: 'Capture win/loss debriefs after every bid. Over time, build an organizational knowledge base of lessons learned, pricing insights, and competitor intelligence.',
    features: ['Structured debriefs', 'Competitor tracking', 'Pricing benchmarks', 'Lessons learned repository'],
  },
  {
    icon: Mail,
    title: 'Custom Email Domain & Branding',
    desc: 'Enterprise teams send all communications — RFQs, notifications, and outreach — from their own domain. DNS verification, custom branding, and deliverability tracking included.',
    features: ['Your domain, your reputation', 'Guided SPF/DKIM/DMARC setup', 'Custom logo & brand colors', 'Per-domain analytics'],
  },
  {
    icon: Award,
    title: 'Past Performance Library',
    desc: 'Organization-wide citation repository. Upload CPARS reports, SF-330s, and proposal volumes — AI extracts contract details, ratings, and narratives. Search and filter by agency, NAICS, rating, and contract type.',
    features: ['AI document extraction', 'CPARS rating tracking', 'Relevance tags & service categories', 'Reusable narratives & key personnel'],
  },
  {
    icon: Brain,
    title: 'AI Past Performance Matching',
    desc: 'When working on a project, AI analyzes your library and recommends the most relevant citations. Scored 0–100% by NAICS match, agency, scope, value, recency, and CPARS rating.',
    features: ['AI-powered relevance scoring', 'Match reasons explained', 'One-click linking to project', 'Library search & browse'],
  },
  {
    icon: ShieldCheck,
    title: 'Capture Gate Reviews',
    desc: 'Customizable Shipley-aligned gate review process. 5 default gates (Qualification through Submit) with checklists, GO/NO-GO decisions, and rationale tracking.',
    features: ['Customizable at org and project level', 'Checklist progress tracking', 'Decision rationale logging', 'Date scheduling & completion'],
  },
  {
    icon: Briefcase,
    title: 'Contract Vehicle Registry',
    desc: 'Track all your contract vehicles — GSA Schedule, OASIS, SEWP, agency IDIQs. Monitor expiration dates, ceiling values, and NAICS scope.',
    features: ['Vehicle type categorization', 'Expiration monitoring', 'NAICS & SIN tracking', 'Status management'],
  },
  {
    icon: Palette,
    title: 'Color Team Reviews',
    desc: 'Structured proposal quality reviews at Pink, Red, and Gold team stages. Track reviewers, findings, action items, and overall ratings.',
    features: ['5 review types (Pink through Gold)', 'Findings & action items', 'Reviewer assignments', 'Summary & scoring'],
  },
  {
    icon: UserCheck,
    title: 'Personnel & Labor Categories',
    desc: 'Maintain a database of labor categories with rate ranges and a key personnel directory with clearances, certifications, and availability.',
    features: ['Labor category definitions', 'Key personnel profiles', 'Clearance & certification tracking', 'Project staffing assignments'],
  },
  {
    icon: ListChecks,
    title: 'SB Subcontracting Plan Generator',
    desc: 'Auto-generate FAR 52.219-9 compliant small business subcontracting plans. Pre-populated SB/SDB/WOSB/HUBZone/SDVOSB goals with dollar auto-calculation.',
    features: ['Federal default percentages', 'Dollar goal auto-calculation', 'Planned subcontractor listing', 'Plan narrative generation'],
  },
  {
    icon: FileText,
    title: 'Section L/M Analysis',
    desc: 'Upload RFP Section L & M documents. AI extracts evaluation criteria, scoring methodology, and proposal structure requirements.',
    features: ['AI evaluation factor extraction', 'Scoring methodology identification', 'Proposal structure recommendations', 'Compliance mapping'],
  },
  {
    icon: Search,
    title: 'Competitive Intelligence',
    desc: 'Pull historical FPDS.gov award data. See who won similar contracts, identify incumbents, and analyze spending trends by agency.',
    features: ['FPDS award history lookup', 'Incumbent identification', 'Competitor profiling', 'Strategic recommendations'],
  },
  {
    icon: Scale,
    title: 'Price-to-Win Analysis',
    desc: 'AI-assisted competitive pricing. Analyze market rates, competitor positioning, and historical award data to determine optimal pricing strategy.',
    features: ['Market rate analysis', 'Competitor price positioning', 'Win probability scenarios', 'Pricing strategy recommendations'],
  },
  {
    icon: Clipboard,
    title: 'Bid/No-Bid Decision Engine',
    desc: 'AI-powered opportunity scoring across 10 evaluation criteria. Data-driven recommendation to bid or pass based on strategic fit, competitive position, and resource availability.',
    features: ['10-factor scoring matrix', 'AI recommendation engine', 'Risk/reward visualization', 'Decision audit trail'],
  },
  {
    icon: Contact2,
    title: 'Contact & Relationship Management',
    desc: 'Purpose-built GovCon CRM. Track government contacts, partner POCs, and subcontractor relationships. Link contacts to projects with role assignments (COTR, KO, Capture Lead).',
    features: ['Contact types: Government, Partner, Sub, Internal', 'Project-contact linking with roles', 'Search, filter, and tag contacts', 'Agency and organization tracking'],
    enterpriseOnly: true,
  },
  {
    icon: CheckSquare,
    title: 'Project Task Assignments',
    desc: 'Assign and track capture tasks within each project. Set priorities, cycle status (todo/in-progress/done), and keep your team aligned on deliverables.',
    features: ['Task creation with priority levels', 'Status cycling (todo → in-progress → done)', 'Assignee tracking', 'Due date management'],
    enterpriseOnly: true,
  },
  {
    icon: MessageSquare,
    title: 'Activity Feed & Comments',
    desc: 'Real-time project activity feed with threaded comments. Keep your capture team in sync with timestamped updates and user attribution.',
    features: ['Real-time comment thread per project', 'User attribution and timestamps', 'Activity log of project changes', 'Team collaboration hub'],
    enterpriseOnly: true,
  },
  {
    icon: Wand2,
    title: 'AI Proposal Draft Generation',
    desc: 'Generate proposal section drafts from your outline using AI. One click produces narrative content aligned with your SOW analysis and compliance requirements.',
    features: ['AI-generated proposal sections', 'Aligned with SOW requirements', 'One-click draft from outline', 'Editable output for refinement'],
    enterpriseOnly: true,
  },
  {
    icon: Bell,
    title: 'Slack Integration & Notifications',
    desc: 'Push capture gate updates, document uploads, deadline reminders, and task assignments directly to your Slack workspace via webhook.',
    features: ['Incoming webhook configuration', 'Gate review notifications', 'Document upload alerts', 'Task assignment notifications'],
    enterpriseOnly: true,
  },
  {
    icon: Mail,
    title: 'Weekly Executive Digest',
    desc: 'Automated weekly email summarizing pipeline activity, upcoming deadlines, gate review status, and team productivity across all projects.',
    features: ['Automated weekly delivery', 'Pipeline status summary', 'Upcoming deadline alerts', 'Per-project activity overview'],
    enterpriseOnly: true,
  },
  {
    icon: ListChecks,
    title: 'Post-Award Transition',
    desc: 'Mobilization checklist with phase tracking for awarded contracts. Manage subcontract execution, NTP tracking, and key milestone dates.',
    features: ['Phase-based checklist', 'Subcontract execution tracking', 'Key milestone dates', 'Status monitoring'],
    enterpriseOnly: true,
  },
  {
    icon: KeyRound,
    title: 'MFA & SAML SSO',
    desc: 'Multi-factor authentication (TOTP) for all accounts. SAML single sign-on for enterprise customers. Enforce org-wide security policies from Settings.',
    features: ['TOTP authenticator app', 'SAML SSO configuration', 'Org-wide enforcement', 'Self-service setup'],
  },
]

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Product</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Every Tool Your <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Bid Team</span> Needs
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              30+ integrated modules that take you from document upload to bid submission — with AI doing the heavy lifting.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="space-y-8">
            {modules.map((mod, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className={`flex flex-col md:flex-row gap-8 items-start p-8 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow ${
                  i % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <mod.icon className="h-7 w-7 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{mod.title}</h3>
                    {mod.enterpriseOnly && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                        <Sparkles className="h-3 w-3" /> Enterprise
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-4">{mod.desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mod.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>See It in Action</h2>
          <p className="text-lg text-blue-100 mb-8">Start your free trial and explore every module with your own documents.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all">
              Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-8 py-3.5 font-semibold border-2 border-white/30 hover:border-white/60 rounded-xl transition-colors">
              Request a Demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
