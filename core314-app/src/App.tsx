import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ResetPassword } from './pages/auth/ResetPassword';
import { ResetPasswordConfirm } from './pages/auth/ResetPasswordConfirm';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { OrganizationRequiredGuard } from './components/OrganizationRequiredGuard';
import { Integrations } from './pages/Integrations';
import DashboardBuilder from './pages/DashboardBuilder';
import DashboardView from './pages/DashboardView';
import Goals from './pages/Goals';
import GoalCreate from './pages/GoalCreate';
import Notifications from './pages/Notifications';
import IntegrationHub from './pages/IntegrationHub';
import { SlackConfigure } from './pages/integrations/SlackConfigure';
import { TeamsConfigure } from './pages/integrations/TeamsConfigure';
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
import { PredictiveModels } from './pages/admin/PredictiveModels';
import { MemoryEngine } from './pages/admin/MemoryEngine';
import { AdvancedAnalytics } from './pages/AdvancedAnalytics';
import { OptimizationEngine } from './pages/OptimizationEngine';
import { ApiAccess } from './pages/ApiAccess';
import { AuditTrails } from './pages/AuditTrails';
import { AccountSupport } from './pages/AccountSupport';
import { FusionDetails } from './pages/FusionDetails';
import { PredictiveInsights } from './pages/PredictiveInsights';
import { DecisionCenter } from './pages/DecisionCenter';
import { DecisionAudit } from './pages/admin/DecisionAudit';
import { AutomationCenter } from './pages/AutomationCenter';
import { SystemMonitor } from './pages/SystemMonitor';
import Feedback from './pages/Feedback';
import { AnomalyConsole } from './components/monitoring/AnomalyConsole';
import { RecoveryManager } from './components/monitoring/RecoveryManager';
import { SelfTestPanel } from './components/monitoring/SelfTestPanel';
import Billing from './pages/Billing';
import { AccountPlan } from './pages/AccountPlan';
import { ContactSales } from './pages/ContactSales';
import { Settings } from './pages/Settings';
import BetaInvite from './pages/BetaInvite';
import OAuthCallback from './pages/OAuthCallback';
import { InviteAccept } from './pages/InviteAccept';
import { SentryTest } from './pages/SentryTest';
import SentryVerify from './pages/SentryVerify';
import { useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/toaster';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import { SupportChatProvider } from './contexts/SupportChatContext';
import { OnboardingAssistant } from './components/assistants/OnboardingAssistant';
import { SupportAssistant } from './components/assistants/SupportAssistant';

// Feature flag to enable/disable AI Support widget
// Disabled by default until backend Edge Functions are properly deployed
const ENABLE_AI_SUPPORT_WIDGET = import.meta.env.VITE_ENABLE_AI_SUPPORT_WIDGET === 'true';

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
      <Routes>
        {/* Public routes - no auth required */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/reset-password" element={user ? <Navigate to="/dashboard" /> : <ResetPassword />} />
        <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/beta-invite" element={<BetaInvite />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/invite" element={<InviteAccept />} />
        <Route path="/sentry-test" element={<SentryTest />} />
        {import.meta.env.VITE_DEV_SENTRY_VERIFY === 'true' && (
          <Route path="/sentry-verify" element={<SentryVerify />} />
        )}
        
        {/* Protected routes - auth required, wrapped with providers */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <OnboardingProvider>
                                    <SupportChatProvider>
                                      <MainLayout />
                                      <OnboardingAssistant />
                                      {ENABLE_AI_SUPPORT_WIDGET && <SupportAssistant />}
                                    </SupportChatProvider>
                </OnboardingProvider>
              </OrganizationProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Settings routes - NOT wrapped by OrganizationRequiredGuard */}
          {/* These must always be accessible even if org fetch fails or user has no orgs */}
          <Route path="settings" element={<Settings />} />
          <Route path="settings/security" element={<Security />} />
          <Route path="billing" element={<Billing />} />
          <Route path="account/plan" element={<AccountPlan />} />
          <Route path="contact-sales" element={<ContactSales />} />
          <Route path="feedback" element={<Feedback />} />
          
          {/* Organization-dependent routes - wrapped by OrganizationRequiredGuard */}
          <Route element={<OrganizationRequiredGuard />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="visualizations" element={<Visualizations />} />
            <Route path="dashboard-builder" element={<DashboardBuilder />} />
            <Route path="dashboards/:id" element={<DashboardView />} />
            <Route path="goals" element={<Goals />} />
            <Route path="goals/create" element={<GoalCreate />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="integration-hub" element={<IntegrationHub />} />
            <Route path="integrations/slack/configure" element={<SlackConfigure />} />
            <Route path="integrations/microsoft_teams/configure" element={<TeamsConfigure />} />
            <Route path="predictive-insights" element={<PredictiveInsights />} />
            <Route path="decision-center" element={<DecisionCenter />} />
            <Route path="automation-center" element={<AutomationCenter />} />
            <Route path="system-monitor" element={<SystemMonitor />} />
            <Route path="anomaly-console" element={<AnomalyConsole />} />
            <Route path="recovery-manager" element={<RecoveryManager />} />
            <Route path="selftest-panel" element={<SelfTestPanel />} />
            <Route path="advanced-analytics" element={<AdvancedAnalytics />} />
            <Route path="optimization-engine" element={<OptimizationEngine />} />
            <Route path="api-access" element={<ApiAccess />} />
            <Route path="audit-trails" element={<AuditTrails />} />
            <Route path="account-support" element={<AccountSupport />} />
            <Route path="fusion-details" element={<FusionDetails />} />
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
            <Route path="admin/predictive-models" element={<ProtectedRoute requireAdmin><PredictiveModels /></ProtectedRoute>} />
            <Route path="admin/memory-engine" element={<ProtectedRoute requireAdmin><MemoryEngine /></ProtectedRoute>} />
            <Route path="admin/decision-audit" element={<ProtectedRoute requireAdmin><DecisionAudit /></ProtectedRoute>} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
