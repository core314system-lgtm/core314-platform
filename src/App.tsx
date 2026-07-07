import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SIGNUP_ENABLED, PRICING_VISIBLE } from './config/signupConfig'
import { OrgProvider } from './contexts/OrgContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import TierGate from './components/TierGate'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TaskOrders from './pages/TaskOrders'
import NewTaskOrder from './pages/NewTaskOrder'
import TaskOrderDetail from './pages/TaskOrderDetail'
import Subcontractors from './pages/Subcontractors'
import ComplianceMatrices from './pages/ComplianceMatrices'
import ComplianceMatrix from './pages/ComplianceMatrix'
import RfqPackages from './pages/RfqPackages'
import ClarificationQuestions from './pages/ClarificationQuestions'
import PricingRisks from './pages/PricingRisks'
import ExecutiveSummaryPage from './pages/ExecutiveSummary'
import QuoteManagement from './pages/QuoteManagement'
import VendorTracker from './pages/VendorTracker'
import TaskOrderComparisonPage from './pages/TaskOrderComparison'
import ExportCenter from './pages/ExportCenter'
import SowTracker from './pages/SowTracker'
import BidSummary from './pages/BidSummary'
import PricingMatrix from './pages/PricingMatrix'
import HelpCenter from './pages/HelpCenter'
import DebriefPage from './pages/Debrief'
import IntelligenceLibrary from './pages/IntelligenceLibrary'
import SubcontractorCapture from './pages/SubcontractorCapture'
import SubcontractorPortal from './pages/SubcontractorPortal'
import QuoteFormBuilder from './pages/QuoteFormBuilder'
import OrgSettings from './pages/OrgSettings'
import PipelineView from './pages/PipelineView'
import Integrations from './pages/Integrations'
import Analytics from './pages/Analytics'
import Contracts from './pages/Contracts'
import NewContract from './pages/NewContract'
import ContractDetail from './pages/ContractDetail'
import BidDecisionEngine from './pages/BidDecisionEngine'
import PostAward from './pages/PostAward'
import TeamingTracker from './pages/TeamingTracker'
import Billing from './pages/Billing'
import ResetPassword from './pages/ResetPassword'
import AccountSettings from './pages/AccountSettings'
import AdminAnalytics from './pages/AdminAnalytics'
import GlobalAdminSettings from './pages/GlobalAdminSettings'
import EnterpriseEmailSettings from './pages/EnterpriseEmailSettings'
import SSOSettings from './pages/SSOSettings'
import AgentHub from './pages/AgentHub'
import AdminBetaInvites from './pages/AdminBetaInvites'
import BetaApply from './pages/BetaApply'
import BetaThankYou from './pages/BetaThankYou'
import BetaFeedback from './pages/BetaFeedback'
import OpportunityDiscovery from './pages/OpportunityDiscovery'
import SystemHealth from './pages/SystemHealth'
import DocumentLibrary from './pages/DocumentLibrary'
import AiAuditLog from './pages/AiAuditLog'
import AuditLog from './pages/AuditLog'
import MasterSubDatabase from './pages/MasterSubDatabase'
import FindSubcontractors from './pages/FindSubcontractors'
import OrgSubcontractors from './pages/OrgSubcontractors'
import ClaimProfile from './pages/ClaimProfile'
import MySubProfile from './pages/MySubProfile'
import AdminVerificationReview from './pages/AdminVerificationReview'
import SubProfilePublic from './pages/SubProfilePublic'
import ClaimLookup from './pages/ClaimLookup'
import CreateSubProfile from './pages/CreateSubProfile'
import AdminPartners from './pages/AdminPartners'
import PastPerformance from './pages/PastPerformance'
import ContractVehicles from './pages/ContractVehicles'
import CaptureGates from './pages/CaptureGates'
import ColorTeamReviews from './pages/ColorTeamReviews'
import LaborCategories from './pages/LaborCategories'
import SBSubcontractingPlan from './pages/SBSubcontractingPlan'
import SectionLMAnalysis from './pages/SectionLMAnalysis'
import CompetitiveIntelligence from './pages/CompetitiveIntelligence'
import PriceToWin from './pages/PriceToWin'
import ProjectPastPerformance from './pages/ProjectPastPerformance'
import GateTemplates from './pages/GateTemplates'
import ProposalOutline from './pages/ProposalOutline'
import WinThemes from './pages/WinThemes'
import OciScreening from './pages/OciScreening'
import ProposalSchedule from './pages/ProposalSchedule'
import TeamingEvaluator from './pages/TeamingEvaluator'
import CparsTracker from './pages/CparsTracker'
import FiscalCalendar from './pages/FiscalCalendar'
import ProtestRisk from './pages/ProtestRisk'
import OralPresPrep from './pages/OralPresPrep'
import SourceSelection from './pages/SourceSelection'
import ContactsPage from './pages/Contacts'

import LandingPage from './landing/pages/LandingPage'
import ProductPage from './landing/pages/ProductPage'
import HowItWorksPage from './landing/pages/HowItWorksPage'
import SolutionsPage from './landing/pages/SolutionsPage'
import IntegrationsOverviewPage from './landing/pages/IntegrationsPage'
import PricingPage from './landing/pages/PricingPage'
import ContactPage from './landing/pages/ContactPage'
import PrivacyPage from './landing/pages/PrivacyPage'
import TermsPage from './landing/pages/TermsPage'
import CookiesPage from './landing/pages/CookiesPage'
import DPAPage from './landing/pages/DPAPage'
import AIDisclaimerPage from './landing/pages/AIDisclaimerPage'
import ROIPage from './landing/pages/ROIPage'
import DemoPage from './landing/pages/DemoPage'
import AiDataProcessingPage from './landing/pages/AiDataProcessingPage'
import AboutPage from './landing/pages/AboutPage'
import SLAPage from './landing/pages/SLAPage'
import SecurityPage from './landing/pages/SecurityPage'
import ApiDocsPage from './landing/pages/ApiDocsPage'
import StatusPage from './landing/pages/StatusPage'
import ComplianceMatrixGuidePage from './landing/pages/ComplianceMatrixGuidePage'
import GovProposalGuidePage from './landing/pages/GovProposalGuidePage'
import SamGovGuidePage from './landing/pages/SamGovGuidePage'
import ComparePage from './landing/pages/ComparePage'
import ForSubcontractorsPage from './landing/pages/ForSubcontractorsPage'
import ExploreNetworkPage from './landing/pages/ExploreNetworkPage'
import FoundingPartnersPage from './landing/pages/FoundingPartnersPage'
import FoundingPartnersThankYouPage from './landing/pages/FoundingPartnersThankYouPage'
import PartnerTermsPage from './landing/pages/PartnerTermsPage'

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
          <Route path="/projects/:id/form-builder" element={<ProtectedRoute><QuoteFormBuilder /></ProtectedRoute>} />
          <Route path="/projects/:id/form-builder/:sowId" element={<ProtectedRoute><QuoteFormBuilder /></ProtectedRoute>} />
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
          <Route path="/vendor-tracker" element={<ProtectedRoute><VendorTracker /></ProtectedRoute>} />

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
          <Route path="/settings/email-domain" element={<ProtectedRoute><EnterpriseEmailSettings /></ProtectedRoute>} />
          <Route path="/settings/sso" element={<ProtectedRoute><SSOSettings /></ProtectedRoute>} />
          <Route path="/settings/gate-templates" element={<ProtectedRoute><GateTemplates /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
