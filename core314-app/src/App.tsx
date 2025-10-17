import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { Integrations } from './pages/Integrations';
import DashboardBuilder from './pages/DashboardBuilder';
import DashboardView from './pages/DashboardView';
import Goals from './pages/Goals';
import GoalCreate from './pages/GoalCreate';
import Notifications from './pages/Notifications';
import IntegrationHub from './pages/IntegrationHub';
import { FusionWeights } from './pages/admin/FusionWeights';
import { FusionIntelligence } from './pages/admin/FusionIntelligence';
import { AutomationRules } from './pages/admin/AutomationRules';
import { AutomationRulesManager } from './pages/admin/AutomationRulesManager';
import { AutomationLogsViewer } from './pages/admin/AutomationLogsViewer';
import { AINarrativesManager } from './pages/admin/AINarrativesManager';
import { SimulationsManager } from './pages/admin/SimulationsManager';
import { OptimizationsManager } from './pages/admin/OptimizationsManager';
import { InsightHub } from './pages/admin/InsightHub';
import { Governance } from './pages/admin/Governance';
import { Users } from './pages/admin/Users';
import { Visualizations } from './pages/Visualizations';
import { Security } from './pages/settings/Security';
import { Organizations } from './pages/admin/Organizations';
import { useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/toaster';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { AISupportProvider } from './contexts/AISupportContext';
import { ChatWidget } from './components/chat/ChatWidget';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <OrganizationProvider>
        <AISupportProvider>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
            <Route path="/pricing" element={<Pricing />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="visualizations" element={<Visualizations />} />
            <Route path="dashboard-builder" element={<DashboardBuilder />} />
            <Route path="dashboards/:id" element={<DashboardView />} />
            <Route path="goals" element={<Goals />} />
            <Route path="goals/create" element={<GoalCreate />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="integration-hub" element={<IntegrationHub />} />
            <Route path="settings/security" element={<Security />} />
            <Route path="admin/fusion-weights" element={<ProtectedRoute requireAdmin><FusionWeights /></ProtectedRoute>} />
            <Route path="admin/fusion-intelligence" element={<ProtectedRoute requireAdmin><FusionIntelligence /></ProtectedRoute>} />
            <Route path="admin/automation-rules" element={<ProtectedRoute requireAdmin><AutomationRules /></ProtectedRoute>} />
            <Route path="admin/automation-rules-manager" element={<ProtectedRoute requireAdmin><AutomationRulesManager /></ProtectedRoute>} />
            <Route path="admin/automation-logs" element={<ProtectedRoute requireAdmin><AutomationLogsViewer /></ProtectedRoute>} />
            <Route path="admin/ai-narratives" element={<ProtectedRoute requireAdmin><AINarrativesManager /></ProtectedRoute>} />
            <Route path="admin/simulations" element={<ProtectedRoute requireAdmin><SimulationsManager /></ProtectedRoute>} />
            <Route path="admin/optimizations" element={<ProtectedRoute requireAdmin><OptimizationsManager /></ProtectedRoute>} />
            <Route path="admin/insight-hub" element={<ProtectedRoute requireAdmin><InsightHub /></ProtectedRoute>} />
            <Route path="admin/governance" element={<ProtectedRoute requireAdmin><Governance /></ProtectedRoute>} />
            <Route path="admin/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
            <Route path="admin/organizations" element={<ProtectedRoute requireAdmin><Organizations /></ProtectedRoute>} />
          </Route>
        </Routes>
        <Toaster />
        <ChatWidget />
        </AISupportProvider>
      </OrganizationProvider>
    </Router>
  );
}

export default App;
