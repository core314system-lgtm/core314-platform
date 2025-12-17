import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * LoginPage - Redirects to the platform app login
 * 
 * Authentication is handled by the platform app (app.core314.com), not the landing site.
 * This component provides a client-side redirect as a fallback for the Netlify redirect.
 * Query parameters (e.g., ?returnUrl=...) are preserved.
 */
const PLATFORM_LOGIN_URL = 'https://app.core314.com/login';

export default function LoginPage() {
  const location = useLocation();

  useEffect(() => {
    // Preserve query string and hash for return URL support
    const search = location.search || '';
    const hash = location.hash || '';
    
    // Use replace() to avoid adding the landing login to browser history
    window.location.replace(`${PLATFORM_LOGIN_URL}${search}${hash}`);
  }, [location]);

  // Return null for immediate redirect with no visible UI
  return null;
}
