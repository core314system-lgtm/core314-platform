import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLogin } from './pages/auth/AdminLogin';
import { AdminLayout } from './pages/admin/Layout';
import { UserManagement } from './pages/admin/UserManagement';
import { IntegrationTracking } from './pages/admin/IntegrationTracking';
import { MetricsDashboard } from './pages/admin/MetricsDashboard';
import { BillingOverview } from './pages/admin/BillingOverview';
import { AILogs } from './pages/admin/AILogs';
import { SystemHealth } from './pages/admin/SystemHealth';
import { NotificationCenter } from './pages/admin/NotificationCenter';
import { AuditTrail } from './pages/admin/AuditTrail';
import { AdminProtectedRoute } from './components/AdminProtectedRoute';
import { useAdminAuth } from './hooks/useAdminAuth';

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
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="audit-trail" element={<AuditTrail />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
