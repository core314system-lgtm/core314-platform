import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ResetPassword } from './pages/auth/ResetPassword';
import { ResetPasswordConfirm } from './pages/auth/ResetPasswordConfirm';
import { AuthConfirm } from './pages/auth/AuthConfirm';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { AccountLayout } from './components/AccountLayout';
import { Integrations } from './pages/Integrations';
import Notifications from './pages/Notifications';
import IntegrationHub from './pages/IntegrationHub';
import { SlackConfigure } from './pages/integrations/SlackConfigure';
import { TeamsConfigure } from './pages/integrations/TeamsConfigure';
import { Security } from './pages/settings/Security';
import Feedback from './pages/Feedback';
import Billing from './pages/Billing';
import { AccountPlan } from './pages/AccountPlan';
import { ContactSales } from './pages/ContactSales';
import { Settings } from './pages/Settings';
import BetaInvite from './pages/BetaInvite';
import OAuthCallback from './pages/OAuthCallback';
import AuthCallback from './pages/AuthCallback';
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
// Phase 1: Operational Intelligence pages
import { OperationalBrief } from './pages/OperationalBrief';
import { SignalDashboard } from './pages/SignalDashboard';
import { HealthScore } from './pages/HealthScore';
import { IntegrationManager } from './pages/IntegrationManager';
import { TeamMembers } from './pages/TeamMembers';
import { IntegrationRequests } from './pages/admin/IntegrationRequests';

// Feature flag to enable/disable AI Support widget
// Disabled by default until backend Edge Functions are properly deployed
const ENABLE_AI_SUPPORT_WIDGET = import.meta.env.VITE_ENABLE_AI_SUPPORT_WIDGET === 'true';

/**
 * AppShell - Root shell that provides providers and assistants
 * 
 * This is a neutral shell that sits under ProtectedRoute and providers.
 * It renders Outlet + assistants but has NO sidebar and NO org logic.
 * Both AccountLayout and MainLayout branches hang under this.
 */
function AppShell() {
  return (
    <>
      <Outlet />
      <OnboardingAssistant />
      {ENABLE_AI_SUPPORT_WIDGET && <SupportAssistant />}
    </>
  );
}

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
        <Route path="/login" element={user ? <Navigate to="/brief" /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/brief" /> : <Signup />} />
        <Route path="/reset-password" element={user ? <Navigate to="/brief" /> : <ResetPassword />} />
        <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/beta-invite" element={<BetaInvite />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
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
                    <AppShell />
                  </SupportChatProvider>
                </OnboardingProvider>
              </OrganizationProvider>
            </ProtectedRoute>
          }
        >
          {/* Default redirect - Operational Brief is the centerpiece */}
          <Route index element={<Navigate to="/brief" replace />} />
          
          {/* Account-only routes: NO sidebar */}
          <Route element={<AccountLayout />}>
            <Route path="settings" element={<Settings />} />
            <Route path="settings/organization" element={<Settings />} />
            <Route path="settings/security" element={<Security />} />
            <Route path="billing" element={<Billing />} />
            <Route path="account/plan" element={<AccountPlan />} />
            <Route path="contact-sales" element={<ContactSales />} />
            <Route path="feedback" element={<Feedback />} />
          </Route>
          
          {/* Core routes: Operational Intelligence Command Center */}
          <Route element={<MainLayout />}>
            {/* Phase 1 Primary Pages */}
            <Route path="brief" element={<OperationalBrief />} />
            <Route path="signals" element={<SignalDashboard />} />
            <Route path="health" element={<HealthScore />} />
            <Route path="integration-manager" element={<IntegrationManager />} />
            <Route path="team-members" element={<TeamMembers />} />
            
            {/* Legacy dashboard redirect */}
            <Route path="dashboard" element={<Navigate to="/brief" replace />} />
            
            {/* Kept routes for existing functionality */}
            <Route path="integrations" element={<Navigate to="/integration-manager" replace />} />
            <Route path="notifications" element={<Notifications />} />
            {/* integration-hub hidden for Phase 1 — only 3 integrations active */}
            <Route path="integrations/slack/configure" element={<SlackConfigure />} />
            <Route path="integrations/microsoft_teams/configure" element={<TeamsConfigure />} />
            
            {/* Admin routes */}
            <Route path="admin/integration-requests" element={<IntegrationRequests />} />
          </Route>
        </Route>
        </Routes>
        <Toaster />
      </Router>
    );
}

export default App;
