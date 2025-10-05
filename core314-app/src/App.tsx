import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './pages/admin/Layout';
import { UserManagement } from './pages/admin/UserManagement';
import { IntegrationTracking } from './pages/admin/IntegrationTracking';
import { MetricsDashboard } from './pages/admin/MetricsDashboard';
import { BillingOverview } from './pages/admin/BillingOverview';
import { AILogs } from './pages/admin/AILogs';
import { SystemHealth } from './pages/admin/SystemHealth';
import { NotificationCenter } from './pages/admin/NotificationCenter';
import { AuditTrail } from './pages/admin/AuditTrail';
import { Integrations } from './pages/Integrations';
import { useAuth } from './hooks/useAuth';

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
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/integrations"
          element={
            <ProtectedRoute>
              <Integrations />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="integrations" element={<IntegrationTracking />} />
          <Route path="metrics" element={<MetricsDashboard />} />
          <Route path="billing" element={<BillingOverview />} />
          <Route path="ai-logs" element={<AILogs />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="audit-trail" element={<AuditTrail />} />
        </Route>
        
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
