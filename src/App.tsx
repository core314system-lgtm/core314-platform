import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Dashboard */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Module 1: Task Order Intake */}
          <Route path="/task-orders" element={<ProtectedRoute><TaskOrders /></ProtectedRoute>} />
          <Route path="/task-orders/new" element={<ProtectedRoute><NewTaskOrder /></ProtectedRoute>} />
          <Route path="/task-orders/:id" element={<ProtectedRoute><TaskOrderDetail /></ProtectedRoute>} />

          {/* Module 3: Compliance Matrix */}
          <Route path="/compliance" element={<ProtectedRoute><ComplianceMatrices /></ProtectedRoute>} />
          <Route path="/task-orders/:id/compliance" element={<ProtectedRoute><ComplianceMatrix /></ProtectedRoute>} />

          {/* Module 4: Subcontractor RFQ Packages */}
          <Route path="/task-orders/:id/rfq-packages" element={<ProtectedRoute><RfqPackages /></ProtectedRoute>} />

          {/* Module 5: Quote Management */}
          <Route path="/task-orders/:id/quotes" element={<ProtectedRoute><QuoteManagement /></ProtectedRoute>} />

          {/* Module 6: Vendor Intelligence */}
          <Route path="/vendor-tracker" element={<ProtectedRoute><VendorTracker /></ProtectedRoute>} />

          {/* Module 7: Pricing Risks */}
          <Route path="/task-orders/:id/pricing-risks" element={<ProtectedRoute><PricingRisks /></ProtectedRoute>} />

          {/* Module 8: Task Order Comparison */}
          <Route path="/comparison" element={<ProtectedRoute><TaskOrderComparisonPage /></ProtectedRoute>} />

          {/* Module 9: Clarification Questions */}
          <Route path="/task-orders/:id/clarifications" element={<ProtectedRoute><ClarificationQuestions /></ProtectedRoute>} />

          {/* Module 10: Executive Summary */}
          <Route path="/task-orders/:id/executive-summary" element={<ProtectedRoute><ExecutiveSummaryPage /></ProtectedRoute>} />

          {/* Module 11: Export Center */}
          <Route path="/task-orders/:id/exports" element={<ProtectedRoute><ExportCenter /></ProtectedRoute>} />

          {/* Module 1: Subcontractor Database */}
          <Route path="/subcontractors" element={<ProtectedRoute><Subcontractors /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
