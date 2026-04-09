/**
 * useAuth hook — thin re-export from AuthContext.
 *
 * Previously this hook created independent state per component, causing race
 * conditions where RequireAdmin could see profile=null while MainLayout had
 * the correct profile. Now all components share a single auth state via
 * AuthContext.
 */
export { useAuthContext as useAuth } from '../contexts/AuthContext';
