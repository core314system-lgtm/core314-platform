import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OrgProvider } from './contexts/OrgContext'
import Layout from './components/Layout'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <OrgProvider><Layout>{children}</Layout></OrgProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Public Subcontractor Portal (no auth required) */}
          <Route path="/portal/:token" element={<SubcontractorPortal />} />

          {/* Dashboard */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

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

          {/* Backward-compatible redirects for old /task-orders URLs */}
          <Route path="/task-orders" element={<Navigate to="/projects" replace />} />
          <Route path="/task-orders/new" element={<Navigate to="/projects/new" replace />} />
          <Route path="/task-orders/*" element={<Navigate to="/projects" replace />} />

          {/* Compliance Matrices (cross-project view) */}
          <Route path="/compliance" element={<ProtectedRoute><ComplianceMatrices /></ProtectedRoute>} />

          {/* Vendor Intelligence */}
          <Route path="/vendor-tracker" element={<ProtectedRoute><VendorTracker /></ProtectedRoute>} />

          {/* Project Comparison */}
          <Route path="/comparison" element={<ProtectedRoute><TaskOrderComparisonPage /></ProtectedRoute>} />

          {/* Pipeline View */}
          <Route path="/pipeline" element={<ProtectedRoute><PipelineView /></ProtectedRoute>} />

          {/* Subcontractor Database */}
          <Route path="/subcontractors" element={<ProtectedRoute><Subcontractors /></ProtectedRoute>} />
          <Route path="/subcontractor-capture" element={<ProtectedRoute><SubcontractorCapture /></ProtectedRoute>} />

          {/* Intelligence & Help */}
          <Route path="/intelligence" element={<ProtectedRoute><IntelligenceLibrary /></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />

          {/* Organization Settings */}
          <Route path="/settings" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
