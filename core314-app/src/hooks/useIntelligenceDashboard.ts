import { useMemo } from 'react';
import { useAuth } from './useAuth';

// Hardcoded allowlist for platform owners / test accounts
// This can be expanded or moved to a database-driven approach in the future
const INTELLIGENCE_DASHBOARD_ALLOWLIST = [
  'support@govmatchai.com',
  'admin@core314.com',
  'test@core314.com',
];

export function useIntelligenceDashboard() {
  const { profile } = useAuth();
  
  const isEnabled = useMemo(() => {
    // Check environment variable first (default: false)
    const envEnabled = import.meta.env.VITE_ENABLE_INTELLIGENCE_DASHBOARD === 'true';
    
    if (!envEnabled) {
      return false;
    }
    
    // If env is enabled, check if user is in allowlist or is platform admin
    if (!profile) {
      return false;
    }
    
    // Platform admins always have access when flag is enabled
    if (profile.role === 'admin') {
      return true;
    }
    
    // Check allowlist by email
    if (profile.email && INTELLIGENCE_DASHBOARD_ALLOWLIST.includes(profile.email)) {
      return true;
    }
    
    return false;
  }, [profile]);
  
  return {
    isIntelligenceDashboardEnabled: isEnabled,
  };
}
