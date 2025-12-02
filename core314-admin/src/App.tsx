import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLogin } from './pages/auth/AdminLogin';
import { AdminLayout } from './pages/admin/Layout';
import { UserManagement } from './pages/admin/UserManagement';
import { IntegrationTracking } from './pages/admin/IntegrationTracking';
import { MetricsDashboard } from './pages/admin/MetricsDashboard';
import { BillingOverview } from './pages/admin/BillingOverview';
import { AILogs } from './pages/admin/AILogs';
import { SystemHealth } from './pages/admin/SystemHealth';
import { SelfHealingActivity } from './pages/admin/SelfHealingActivity';
import { AdaptiveWorkflows } from './pages/admin/AdaptiveWorkflows';
import { FusionRiskDashboard } from './pages/admin/FusionRiskDashboard';
import { AuditAnomalies } from './pages/admin/AuditAnomalies';
import { AlertCenter } from './pages/admin/AlertCenter';
import { EfficiencyIndex } from './pages/admin/EfficiencyIndex';
import { BehavioralAnalytics } from './pages/admin/BehavioralAnalytics';
import { PredictiveInsights } from './pages/admin/PredictiveInsights';
import { FusionCalibration } from './pages/admin/FusionCalibration';
import { AutonomousOversight } from './pages/admin/AutonomousOversight';
import { CoreOrchestrator } from './pages/admin/CoreOrchestrator';
import { InsightHub } from './pages/admin/InsightHub';
import { AdaptivePolicy } from './pages/admin/AdaptivePolicy';
import { TrustGraph } from './pages/admin/TrustGraph';
import { GovernanceInsights } from './pages/admin/GovernanceInsights';
import { Explainability } from './pages/admin/Explainability';
import { PolicyNetwork } from './pages/admin/PolicyNetwork';
import { SimulationCenter } from './pages/admin/SimulationCenter';
import { E2EOrchestration } from './pages/admin/E2EOrchestration';
import { E2ECampaign } from './pages/admin/E2ECampaign';
import { BetaReadiness } from './pages/admin/BetaReadiness';
import { NotificationCenter } from './pages/admin/NotificationCenter';
import { AuditTrail } from './pages/admin/AuditTrail';
import { AutomationCenter } from './pages/admin/AutomationCenter';
import { AgentActivityLog } from './pages/admin/AgentActivityLog';
import { Optimizations } from './pages/admin/Optimizations';
import { ReliabilityDashboard } from './pages/admin/ReliabilityDashboard';
import { FusionEfficiency } from './pages/admin/FusionEfficiency';
import { AddOnPurchases } from './pages/admin/AddOnPurchases';
import Subscriptions from './pages/admin/Subscriptions';
import BetaFeedback from './pages/admin/BetaFeedback';
import BetaOpsConsole from './pages/admin/BetaOpsConsole';
import HealthCheck from './pages/HealthCheck';
import { AdminProtectedRoute } from './components/AdminProtectedRoute';
import { useAdminAuth } from './hooks/useAdminAuth';
import { SentryTest } from './pages/SentryTest';

function App() {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <AdminLogin />} />
        <Route path="/admin-health" element={<HealthCheck />} />
        
        <Route
          path="/"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/users" replace />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="integrations" element={<IntegrationTracking />} />
          <Route path="metrics" element={<MetricsDashboard />} />
          <Route path="billing" element={<BillingOverview />} />
          <Route path="ai-logs" element={<AILogs />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="self-healing" element={<SelfHealingActivity />} />
          <Route path="adaptive-workflows" element={<AdaptiveWorkflows />} />
          <Route path="fusion-risk-dashboard" element={<FusionRiskDashboard />} />
          <Route path="audit" element={<AuditAnomalies />} />
          <Route path="alerts" element={<AlertCenter />} />
          <Route path="efficiency" element={<EfficiencyIndex />} />
          <Route path="behavioral-analytics" element={<BehavioralAnalytics />} />
          <Route path="predictive-insights" element={<PredictiveInsights />} />
          <Route path="fusion-calibration" element={<FusionCalibration />} />
          <Route path="autonomous-oversight" element={<AutonomousOversight />} />
          <Route path="core-orchestrator" element={<CoreOrchestrator />} />
          <Route path="insight-hub" element={<InsightHub />} />
          <Route path="adaptive-policy" element={<AdaptivePolicy />} />
          <Route path="trust-graph" element={<TrustGraph />} />
          <Route path="governance-insights" element={<GovernanceInsights />} />
          <Route path="explainability" element={<Explainability />} />
          <Route path="policy-network" element={<PolicyNetwork />} />
          <Route path="simulation-center" element={<SimulationCenter />} />
          <Route path="e2e-orchestration" element={<E2EOrchestration />} />
          <Route path="e2e-campaign" element={<E2ECampaign />} />
          <Route path="beta-readiness" element={<BetaReadiness />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="audit-trail" element={<AuditTrail />} />
          <Route path="automation-center" element={<AutomationCenter />} />
          <Route path="reliability" element={<ReliabilityDashboard />} />
          <Route path="agent-activity" element={<AgentActivityLog />} />
          <Route path="optimizations" element={<Optimizations />} />
          <Route path="fusion-efficiency" element={<FusionEfficiency />} />
          <Route path="addon-purchases" element={<AddOnPurchases />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="beta-feedback" element={<BetaFeedback />} />
          <Route path="beta-ops" element={<BetaOpsConsole />} />
          <Route path="sentry-test" element={<SentryTest />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
