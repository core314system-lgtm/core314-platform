import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Settings, LogOut, User } from 'lucide-react';

/**
 * AccountLayout - Layout for account-only pages (Settings, Billing, etc.)
 * 
 * This layout has NO sidebar and does NOT require an organization.
 * It provides a simple header with account menu and renders the page content.
 * 
 * Used for:
 * - /settings (all tabs)
 * - /billing
 * - /account/plan
 * - /contact-sales
 * - /feedback
 */
export function AccountLayout() {
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Simple header with logo and account menu */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-7 w-7" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Core<span className="text-sky-500">314</span>
            </h1>
          </Link>

          {/* Account controls - Settings and Sign Out as standalone items */}
          <div className="flex items-center gap-2">
            {/* User info display */}
            <div className="hidden sm:flex items-center gap-2 mr-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {profile?.email || 'Account'}
              </span>
            </div>
            
            {/* Settings - standalone button */}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
            
            {/* Sign Out - standalone button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
