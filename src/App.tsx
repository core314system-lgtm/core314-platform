import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SIGNUP_ENABLED, PRICING_VISIBLE } from './config/signupConfig'
import { OrgProvider } from './contexts/OrgContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import TierGate from './components/TierGate'
import NotFound from './pages/NotFound'
import CookieConsent from './components/CookieConsent'
// Critical pages loaded eagerly (login, dashboard, landing)
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LandingPage from './landing/pages/LandingPage'

// All other pages lazy-loaded for code splitting
const TaskOrders = lazy(() => import('./pages/TaskOrders'))
const NewTaskOrder = lazy(() => import('./pages/NewTaskOrder'))
const TaskOrderDetail = lazy(() => import('./pages/TaskOrderDetail'))
const Subcontractors = lazy(() => import('./pages/Subcontractors'))
const ComplianceMatrices = lazy(() => import('./pages/ComplianceMatrices'))
const ComplianceMatrix = lazy(() => import('./pages/ComplianceMatrix'))
const RfqPackages = lazy(() => import('./pages/RfqPackages'))
const ClarificationQuestions = lazy(() => import('./pages/ClarificationQuestions'))
const PricingRisks = lazy(() => import('./pages/PricingRisks'))
const ExecutiveSummaryPage = lazy(() => import('./pages/ExecutiveSummary'))
const QuoteManagement = lazy(() => import('./pages/QuoteManagement'))
const VendorTracker = lazy(() => import('./pages/VendorTracker'))
const TaskOrderComparisonPage = lazy(() => import('./pages/TaskOrderComparison'))
const ExportCenter = lazy(() => import('./pages/ExportCenter'))
const SowTracker = lazy(() => import('./pages/SowTracker'))
const BidSummary = lazy(() => import('./pages/BidSummary'))
const PricingMatrix = lazy(() => import('./pages/PricingMatrix'))
const HelpCenter = lazy(() => import('./pages/HelpCenter'))
const DebriefPage = lazy(() => import('./pages/Debrief'))
const IntelligenceLibrary = lazy(() => import('./pages/IntelligenceLibrary'))
const SubcontractorCapture = lazy(() => import('./pages/SubcontractorCapture'))
const SubcontractorPortal = lazy(() => import('./pages/SubcontractorPortal'))
const QuoteFormBuilder = lazy(() => import('./pages/QuoteFormBuilder'))
const OrgSettings = lazy(() => import('./pages/OrgSettings'))
const PipelineView = lazy(() => import('./pages/PipelineView'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Contracts = lazy(() => import('./pages/Contracts'))
const NewContract = lazy(() => import('./pages/NewContract'))
const ContractDetail = lazy(() => import('./pages/ContractDetail'))
const BidDecisionEngine = lazy(() => import('./pages/BidDecisionEngine'))
const PostAward = lazy(() => import('./pages/PostAward'))
const TeamingTracker = lazy(() => import('./pages/TeamingTracker'))
const Billing = lazy(() => import('./pages/Billing'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'))
const GlobalAdminSettings = lazy(() => import('./pages/GlobalAdminSettings'))
const EnterpriseEmailSettings = lazy(() => import('./pages/EnterpriseEmailSettings'))
const SSOSettings = lazy(() => import('./pages/SSOSettings'))
const AgentHub = lazy(() => import('./pages/AgentHub'))
const AdminBetaInvites = lazy(() => import('./pages/AdminBetaInvites'))
const BetaApply = lazy(() => import('./pages/BetaApply'))
const BetaThankYou = lazy(() => import('./pages/BetaThankYou'))
const BetaFeedback = lazy(() => import('./pages/BetaFeedback'))
const OpportunityDiscovery = lazy(() => import('./pages/OpportunityDiscovery'))
const SystemHealth = lazy(() => import('./pages/SystemHealth'))
const DocumentLibrary = lazy(() => import('./pages/DocumentLibrary'))
const AiAuditLog = lazy(() => import('./pages/AiAuditLog'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const MasterSubDatabase = lazy(() => import('./pages/MasterSubDatabase'))
const FindSubcontractors = lazy(() => import('./pages/FindSubcontractors'))
const OrgSubcontractors = lazy(() => import('./pages/OrgSubcontractors'))
const ClaimProfile = lazy(() => import('./pages/ClaimProfile'))
const MySubProfile = lazy(() => import('./pages/MySubProfile'))
const AdminVerificationReview = lazy(() => import('./pages/AdminVerificationReview'))
const SubProfilePublic = lazy(() => import('./pages/SubProfilePublic'))
const ClaimLookup = lazy(() => import('./pages/ClaimLookup'))
const CreateSubProfile = lazy(() => import('./pages/CreateSubProfile'))
const AdminPartners = lazy(() => import('./pages/AdminPartners'))
const PastPerformance = lazy(() => import('./pages/PastPerformance'))
const ContractVehicles = lazy(() => import('./pages/ContractVehicles'))
const CaptureGates = lazy(() => import('./pages/CaptureGates'))
const ColorTeamReviews = lazy(() => import('./pages/ColorTeamReviews'))
const LaborCategories = lazy(() => import('./pages/LaborCategories'))
const SBSubcontractingPlan = lazy(() => import('./pages/SBSubcontractingPlan'))
const SectionLMAnalysis = lazy(() => import('./pages/SectionLMAnalysis'))
const CompetitiveIntelligence = lazy(() => import('./pages/CompetitiveIntelligence'))
const PriceToWin = lazy(() => import('./pages/PriceToWin'))
const ProjectPastPerformance = lazy(() => import('./pages/ProjectPastPerformance'))
const GateTemplates = lazy(() => import('./pages/GateTemplates'))
const ProposalOutline = lazy(() => import('./pages/ProposalOutline'))
const WinThemes = lazy(() => import('./pages/WinThemes'))
const OciScreening = lazy(() => import('./pages/OciScreening'))
const ProposalSchedule = lazy(() => import('./pages/ProposalSchedule'))
const TeamingEvaluator = lazy(() => import('./pages/TeamingEvaluator'))
const CparsTracker = lazy(() => import('./pages/CparsTracker'))
const FiscalCalendar = lazy(() => import('./pages/FiscalCalendar'))
const ProtestRisk = lazy(() => import('./pages/ProtestRisk'))
const OralPresPrep = lazy(() => import('./pages/OralPresPrep'))
const SourceSelection = lazy(() => import('./pages/SourceSelection'))
const ContactsPage = lazy(() => import('./pages/Contacts'))

const ProductPage = lazy(() => import('./landing/pages/ProductPage'))
const HowItWorksPage = lazy(() => import('./landing/pages/HowItWorksPage'))
const SolutionsPage = lazy(() => import('./landing/pages/SolutionsPage'))
const IntegrationsOverviewPage = lazy(() => import('./landing/pages/IntegrationsPage'))
const PricingPage = lazy(() => import('./landing/pages/PricingPage'))
const ContactPage = lazy(() => import('./landing/pages/ContactPage'))
const PrivacyPage = lazy(() => import('./landing/pages/PrivacyPage'))
const TermsPage = lazy(() => import('./landing/pages/TermsPage'))
const CookiesPage = lazy(() => import('./landing/pages/CookiesPage'))
const DPAPage = lazy(() => import('./landing/pages/DPAPage'))
const AIDisclaimerPage = lazy(() => import('./landing/pages/AIDisclaimerPage'))
const ROIPage = lazy(() => import('./landing/pages/ROIPage'))
const DemoPage = lazy(() => import('./landing/pages/DemoPage'))
const AiDataProcessingPage = lazy(() => import('./landing/pages/AiDataProcessingPage'))
const AboutPage = lazy(() => import('./landing/pages/AboutPage'))
const SLAPage = lazy(() => import('./landing/pages/SLAPage'))
const SecurityPage = lazy(() => import('./landing/pages/SecurityPage'))
const ApiDocsPage = lazy(() => import('./landing/pages/ApiDocsPage'))
const StatusPage = lazy(() => import('./landing/pages/StatusPage'))
const ComplianceMatrixGuidePage = lazy(() => import('./landing/pages/ComplianceMatrixGuidePage'))
const GovProposalGuidePage = lazy(() => import('./landing/pages/GovProposalGuidePage'))
const SamGovGuidePage = lazy(() => import('./landing/pages/SamGovGuidePage'))
const ComparePage = lazy(() => import('./landing/pages/ComparePage'))
const ForSubcontractorsPage = lazy(() => import('./landing/pages/ForSubcontractorsPage'))
const ExploreNetworkPage = lazy(() => import('./landing/pages/ExploreNetworkPage'))
const FoundingPartnersPage = lazy(() => import('./landing/pages/FoundingPartnersPage'))
const FoundingPartnersThankYouPage = lazy(() => import('./landing/pages/FoundingPartnersThankYouPage'))
const PartnerTermsPage = lazy(() => import('./landing/pages/PartnerTermsPage'))

function GlobalAdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!profile?.is_global_admin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Route that only requires authentication (no platform account check)
// Used for subcontractor-accessible pages like /my-sub-profile
function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [betaAccepted, setBetaAccepted] = useState(true) // default true so existing users aren't blocked
  const [checkingBeta, setCheckingBeta] = useState(true)

  useEffect(() => {
    if (profile) {
      // Skip beta check if user just claimed a profile (auto-accepted during claim)
      const params = new URLSearchParams(window.location.search)
      if (params.get('claimed') === 'true') {
        setBetaAccepted(true)
        setCheckingBeta(false)
        return
      }
      // Only show beta agreement if the feature is enabled and not yet accepted
      const accepted = (profile as any).beta_agreement_accepted_at
      setBetaAccepted(!!accepted)
      setCheckingBeta(false)
    } else if (!loading) {
      setCheckingBeta(false)
    }
  }, [profile, loading])

  if (loading || checkingBeta) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  // Subcontractor accounts can only access their profile and portal — not the main app
  if (profile?.account_type === 'subcontractor') {
    return <Navigate to="/my-sub-profile" replace />
  }

  // Show beta agreement modal if not yet accepted and beta mode is enabled
  if (!betaAccepted && user) {
    const BetaAgreementModal = lazy(() => import('./components/BetaAgreementModal'))
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>}>
        <BetaAgreementModal
          userId={user.id}
          userName={user.user_metadata?.full_name || user.email || 'Tester'}
          onAccepted={() => setBetaAccepted(true)}
        />
      </Suspense>
    )
  }

  return (
    <OrgProvider>
      <Layout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </OrgProvider>
  )
}

function HomePage() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (user) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <Routes>
          {/* Public landing pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/integrations-overview" element={<IntegrationsOverviewPage />} />
          <Route path="/pricing" element={PRICING_VISIBLE ? <PricingPage /> : <Navigate to="/" replace />} />
          <Route path="/roi" element={<ROIPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/dpa" element={<DPAPage />} />
          <Route path="/ai-disclaimer" element={<AIDisclaimerPage />} />
          <Route path="/ai-data-processing" element={<AiDataProcessingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/sla" element={<SLAPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/status" element={<StatusPage />} />

          {/* Resource Guides (SEO) */}
          <Route path="/guides/compliance-matrix" element={<ComplianceMatrixGuidePage />} />
          <Route path="/guides/government-proposals" element={<GovProposalGuidePage />} />
          <Route path="/guides/sam-gov" element={<SamGovGuidePage />} />

          {/* Comparison Pages (SEO) */}
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/compare/:competitor" element={<ComparePage />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={SIGNUP_ENABLED ? <Navigate to="/login?tab=signup" replace /> : <Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Founding Partner Program (public, no auth) */}
          <Route path="/founding-partners" element={<FoundingPartnersPage />} />
          <Route path="/founding-partners/thank-you" element={<FoundingPartnersThankYouPage />} />
          <Route path="/beta" element={<Navigate to="/founding-partners" replace />} />
          <Route path="/beta/apply/:token" element={<BetaApply />} />
          <Route path="/beta/thank-you" element={<BetaThankYou />} />

          {/* Partner Program (archived — redirects to Founding Partners) */}
          <Route path="/partners" element={<Navigate to="/founding-partners" replace />} />
          <Route path="/partners/terms" element={<PartnerTermsPage />} />
          <Route path="/partners/login" element={<Navigate to="/founding-partners" replace />} />
          <Route path="/partners/dashboard" element={<Navigate to="/founding-partners" replace />} />
          <Route path="/r/:code" element={<Navigate to="/founding-partners" replace />} />

          {/* Public Subcontractor Portal (no auth required) */}
          <Route path="/portal/:token" element={<SubcontractorPortal />} />

          {/* Public Subcontractor Pages */}
          <Route path="/explore-network" element={<ExploreNetworkPage />} />
          <Route path="/for-subcontractors" element={<ForSubcontractorsPage />} />
          <Route path="/sub/:slug" element={<SubProfilePublic />} />
          <Route path="/claim/:token" element={<ClaimProfile />} />
          <Route path="/claim-lookup/:id" element={<ClaimLookup />} />
          <Route path="/create-sub-profile" element={<CreateSubProfile />} />

          {/* Dashboard (authenticated home) */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Projects (formerly Task Orders) */}
          <Route path="/projects" element={<ProtectedRoute><TaskOrders /></ProtectedRoute>} />
          <Route path="/projects/new" element={<ProtectedRoute><NewTaskOrder /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><TaskOrderDetail /></ProtectedRoute>} />
          <Route path="/projects/:id/compliance" element={<ProtectedRoute><ComplianceMatrix /></ProtectedRoute>} />
          <Route path="/projects/:id/rfq-packages" element={<ProtectedRoute><RfqPackages /></ProtectedRoute>} />
          <Route path="/projects/:id/quotes" element={<ProtectedRoute><QuoteManagement /></ProtectedRoute>} />
          <Route path="/projects/:id/pricing-risks" element={<ProtectedRoute><PricingRisks /></ProtectedRoute>} />
          <Route path="/projects/:id/clarifications" element={<ProtectedRoute><ClarificationQuestions /></ProtectedRoute>} />
          <Route path="/projects/:id/executive-summary" element={<ProtectedRoute><ExecutiveSummaryPage /></ProtectedRoute>} />
          <Route path="/projects/:id/sow-tracker" element={<ProtectedRoute><SowTracker /></ProtectedRoute>} />
          <Route path="/projects/:id/bid-summary" element={<ProtectedRoute><BidSummary /></ProtectedRoute>} />
          <Route path="/projects/:id/pricing-matrix" element={<ProtectedRoute><PricingMatrix /></ProtectedRoute>} />
          <Route path="/projects/:id/form-builder" element={<ProtectedRoute><TierGate feature="custom_quote_forms"><QuoteFormBuilder /></TierGate></ProtectedRoute>} />
          <Route path="/projects/:id/form-builder/:sowId" element={<ProtectedRoute><TierGate feature="custom_quote_forms"><QuoteFormBuilder /></TierGate></ProtectedRoute>} />
          <Route path="/projects/:id/exports" element={<ProtectedRoute><ExportCenter /></ProtectedRoute>} />
          <Route path="/projects/:id/debrief" element={<ProtectedRoute><DebriefPage /></ProtectedRoute>} />
          <Route path="/projects/:id/bid-decision" element={<ProtectedRoute><BidDecisionEngine /></ProtectedRoute>} />
          <Route path="/projects/:id/post-award" element={<ProtectedRoute><TierGate feature="post_award"><PostAward /></TierGate></ProtectedRoute>} />

          {/* Backward-compatible redirects for old /task-orders URLs */}
          <Route path="/task-orders" element={<Navigate to="/projects" replace />} />
          <Route path="/task-orders/new" element={<Navigate to="/projects/new" replace />} />
          <Route path="/task-orders/*" element={<Navigate to="/projects" replace />} />

          {/* Contacts */}
          <Route path="/contacts" element={<ProtectedRoute><TierGate feature="contacts_crm"><ContactsPage /></TierGate></ProtectedRoute>} />

          {/* Contracts */}
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/contracts/new" element={<ProtectedRoute><NewContract /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />

          {/* GovCon Features */}
          <Route path="/past-performance" element={<ProtectedRoute><PastPerformance /></ProtectedRoute>} />
          <Route path="/contract-vehicles" element={<ProtectedRoute><ContractVehicles /></ProtectedRoute>} />
          <Route path="/labor-categories" element={<ProtectedRoute><LaborCategories /></ProtectedRoute>} />
          <Route path="/projects/:id/capture-gates" element={<ProtectedRoute><CaptureGates /></ProtectedRoute>} />
          <Route path="/projects/:id/color-team" element={<ProtectedRoute><ColorTeamReviews /></ProtectedRoute>} />
          <Route path="/projects/:id/sb-plan" element={<ProtectedRoute><SBSubcontractingPlan /></ProtectedRoute>} />
          <Route path="/projects/:id/section-lm" element={<ProtectedRoute><SectionLMAnalysis /></ProtectedRoute>} />
          <Route path="/projects/:id/price-to-win" element={<ProtectedRoute><PriceToWin /></ProtectedRoute>} />
          <Route path="/projects/:id/past-performance" element={<ProtectedRoute><ProjectPastPerformance /></ProtectedRoute>} />
          <Route path="/competitive-intelligence" element={<ProtectedRoute><CompetitiveIntelligence /></ProtectedRoute>} />
          <Route path="/projects/:id/proposal-outline" element={<ProtectedRoute><ProposalOutline /></ProtectedRoute>} />
          <Route path="/projects/:id/win-themes" element={<ProtectedRoute><WinThemes /></ProtectedRoute>} />
          <Route path="/projects/:id/oci-screening" element={<ProtectedRoute><OciScreening /></ProtectedRoute>} />
          <Route path="/projects/:id/proposal-schedule" element={<ProtectedRoute><ProposalSchedule /></ProtectedRoute>} />
          <Route path="/projects/:id/teaming-evaluator" element={<ProtectedRoute><TeamingEvaluator /></ProtectedRoute>} />
          <Route path="/projects/:id/protest-risk" element={<ProtectedRoute><ProtestRisk /></ProtectedRoute>} />
          <Route path="/projects/:id/oral-prep" element={<ProtectedRoute><OralPresPrep /></ProtectedRoute>} />
          <Route path="/projects/:id/source-selection" element={<ProtectedRoute><SourceSelection /></ProtectedRoute>} />
          <Route path="/cpars-tracker" element={<ProtectedRoute><CparsTracker /></ProtectedRoute>} />
          <Route path="/government-fiscal-calendar" element={<ProtectedRoute><FiscalCalendar /></ProtectedRoute>} />

          {/* Document Library */}
          <Route path="/documents" element={<ProtectedRoute><DocumentLibrary /></ProtectedRoute>} />

          {/* AI Compliance */}
          <Route path="/ai-audit" element={<ProtectedRoute><AiAuditLog /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />

          {/* Compliance Matrices (cross-project view) */}
          <Route path="/compliance" element={<ProtectedRoute><ComplianceMatrices /></ProtectedRoute>} />

          {/* Vendor Intelligence */}
          <Route path="/vendor-tracker" element={<ProtectedRoute><TierGate feature="vendor_performance_scoring"><VendorTracker /></TierGate></ProtectedRoute>} />

          {/* Project Comparison */}
          <Route path="/comparison" element={<ProtectedRoute><TaskOrderComparisonPage /></ProtectedRoute>} />

          {/* Opportunity Discovery */}
          <Route path="/opportunities" element={<ProtectedRoute><OpportunityDiscovery /></ProtectedRoute>} />

          {/* Pipeline View */}
          <Route path="/pipeline" element={<ProtectedRoute><PipelineView /></ProtectedRoute>} />

          {/* Integrations */}
          <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />

          {/* Analytics */}
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

          {/* Subcontractor Database */}
          <Route path="/subcontractors" element={<ProtectedRoute><Subcontractors /></ProtectedRoute>} />
          <Route path="/subcontractor-capture" element={<ProtectedRoute><SubcontractorCapture /></ProtectedRoute>} />
          <Route path="/master-subs" element={<ProtectedRoute><GlobalAdminRoute><MasterSubDatabase /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/find-subs" element={<ProtectedRoute><FindSubcontractors /></ProtectedRoute>} />
          <Route path="/my-subs" element={<ProtectedRoute><OrgSubcontractors /></ProtectedRoute>} />
          <Route path="/my-sub-profile" element={<AuthenticatedRoute><MySubProfile /></AuthenticatedRoute>} />
          <Route path="/verification-review" element={<ProtectedRoute><GlobalAdminRoute><AdminVerificationReview /></GlobalAdminRoute></ProtectedRoute>} />

          {/* Teaming & Joint Ventures */}
          <Route path="/teaming" element={<ProtectedRoute><TierGate feature="teaming_jv"><TeamingTracker /></TierGate></ProtectedRoute>} />

          {/* Agent Hub */}
          <Route path="/agent-hub" element={<ProtectedRoute><TierGate feature="agent_hub"><AgentHub /></TierGate></ProtectedRoute>} />

          {/* Intelligence & Help */}
          <Route path="/intelligence" element={<ProtectedRoute><TierGate feature="intelligence_library"><IntelligenceLibrary /></TierGate></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />

          {/* Organization Settings & Billing */}
          <Route path="/settings" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><BetaFeedback /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute><GlobalAdminRoute><AdminAnalytics /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/admin/invites" element={<ProtectedRoute><GlobalAdminRoute><AdminBetaInvites /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/admin/access" element={<ProtectedRoute><GlobalAdminRoute><GlobalAdminSettings /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/admin/system-health" element={<ProtectedRoute><GlobalAdminRoute><SystemHealth /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/admin/partners" element={<ProtectedRoute><GlobalAdminRoute><AdminPartners /></GlobalAdminRoute></ProtectedRoute>} />
          <Route path="/settings/email-domain" element={<ProtectedRoute><TierGate feature="custom_email_domain"><EnterpriseEmailSettings /></TierGate></ProtectedRoute>} />
          <Route path="/settings/sso" element={<ProtectedRoute><TierGate feature="saml_sso"><SSOSettings /></TierGate></ProtectedRoute>} />
          <Route path="/settings/gate-templates" element={<ProtectedRoute><TierGate feature="custom_workflows"><GateTemplates /></TierGate></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <CookieConsent />
      </AuthProvider>
    </BrowserRouter>
  )
}
