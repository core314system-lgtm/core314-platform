import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OrgProvider } from './contexts/OrgContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
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
import AdminBetaInvites from './pages/AdminBetaInvites'
import BetaApply from './pages/BetaApply'
import BetaThankYou from './pages/BetaThankYou'
import BetaFeedback from './pages/BetaFeedback'
import OpportunityDiscovery from './pages/OpportunityDiscovery'
import SystemHealth from './pages/SystemHealth'
import DocumentLibrary from './pages/DocumentLibrary'
import AiAuditLog from './pages/AiAuditLog'
import MasterSubDatabase from './pages/MasterSubDatabase'
import FindSubcontractors from './pages/FindSubcontractors'
import ClaimProfile from './pages/ClaimProfile'
import SubProfilePublic from './pages/SubProfilePublic'

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
import AiDataProcessingPage from './landing/pages/AiDataProcessingPage'
import AboutPage from './landing/pages/AboutPage'
import SLAPage from './landing/pages/SLAPage'
import SecurityPage from './landing/pages/SecurityPage'
import StatusPage from './landing/pages/StatusPage'
import ComplianceMatrixGuidePage from './landing/pages/ComplianceMatrixGuidePage'
import GovProposalGuidePage from './landing/pages/GovProposalGuidePage'
import SamGovGuidePage from './landing/pages/SamGovGuidePage'
import ComparePage from './landing/pages/ComparePage'

function GlobalAdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!profile?.is_global_admin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [betaAccepted, setBetaAccepted] = useState(true) // default true so existing users aren't blocked
  const [checkingBeta, setCheckingBeta] = useState(true)

  useEffect(() => {
    if (profile) {
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
          <Route path="/product" element={<ProductPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/integrations-overview" element={<IntegrationsOverviewPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/roi" element={<ROIPage />} />
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
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Beta Program (public, no auth) */}
          <Route path="/beta/apply/:token" element={<BetaApply />} />
          <Route path="/beta/thank-you" element={<BetaThankYou />} />

          {/* Public Subcontractor Portal (no auth required) */}
          <Route path="/portal/:token" element={<SubcontractorPortal />} />

          {/* Public Subcontractor Profile */}
          <Route path="/sub/:slug" element={<SubProfilePublic />} />
          <Route path="/claim/:token" element={<ClaimProfile />} />

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
          <Route path="/projects/:id/post-award" element={<ProtectedRoute><PostAward /></ProtectedRoute>} />

          {/* Backward-compatible redirects for old /task-orders URLs */}
          <Route path="/task-orders" element={<Navigate to="/projects" replace />} />
          <Route path="/task-orders/new" element={<Navigate to="/projects/new" replace />} />
          <Route path="/task-orders/*" element={<Navigate to="/projects" replace />} />

          {/* Contracts */}
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/contracts/new" element={<ProtectedRoute><NewContract /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />

          {/* Document Library */}
          <Route path="/documents" element={<ProtectedRoute><DocumentLibrary /></ProtectedRoute>} />

          {/* AI Compliance */}
          <Route path="/ai-audit" element={<ProtectedRoute><AiAuditLog /></ProtectedRoute>} />

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
          <Route path="/master-subs" element={<ProtectedRoute><MasterSubDatabase /></ProtectedRoute>} />
          <Route path="/find-subs" element={<ProtectedRoute><FindSubcontractors /></ProtectedRoute>} />

          {/* Teaming & Joint Ventures */}
          <Route path="/teaming" element={<ProtectedRoute><TeamingTracker /></ProtectedRoute>} />

          {/* Intelligence & Help */}
          <Route path="/intelligence" element={<ProtectedRoute><IntelligenceLibrary /></ProtectedRoute>} />
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

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
