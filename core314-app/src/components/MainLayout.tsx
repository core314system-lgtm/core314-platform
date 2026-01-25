import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import {
  Settings,
  LogOut,
  User,
  ChevronDown
} from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { SystemHealthIndicator } from './navigation/SystemHealthIndicator';
import { ContextualTabs } from './navigation/ContextualTabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

/**
 * MainLayout - Top navigation layout for the user application
 * 
 * UI/UX CORRECTION (replaces rejected PR #326):
 * 
 * DESIGN PRINCIPLE: Core314 feels like an intelligence system reporting status,
 * NOT an admin tool, NOT a feature catalog, NOT a navigation-heavy application.
 * 
 * TOP NAVIGATION BAR (simplified):
 * - Core314 logo (left)
 * - Organization selector
 * - System Health badge (read-only status indicator)
 * - User profile menu (Settings + Sign Out ONLY)
 * 
 * NO other controls are allowed in the top bar:
 * - NO Navigate dropdown
 * - NO Admin dropdown
 * - NO feature menus
 * 
 * PRIMARY NAVIGATION:
 * - Contextual tabs are the ONLY primary navigation
 * - Overview (/dashboard), Insights (/system-intelligence), 
 *   Integrations (/integrations), History (/visualizations)
 * 
 * ADMIN ACCESS:
 * - Admin functionality is exclusively at admin.core314.com
 * - NO admin navigation affordances in the user app
 * 
 * All existing routes remain accessible via:
 * - Contextual tabs (primary navigation)
 * - In-page links within relevant context pages
 * - Direct URL access for power users
 */
export function MainLayout() {
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Navigation Bar - SIMPLIFIED */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        {/* Left section: Logo + Org Selector */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Core<span className="text-sky-500">314</span>
            </h1>
          </Link>
          
          {/* Organization Selector */}
          <div className="hidden md:block">
            <OrganizationSwitcher />
          </div>
        </div>

        {/* Center section: System Health Badge (read-only status indicator) */}
        <div className="hidden lg:flex items-center">
          <SystemHealthIndicator />
        </div>

        {/* Right section: User Menu ONLY (Settings + Sign Out) */}
        <div className="flex items-center gap-2">
          {/* User Menu Dropdown - ONLY Settings and Sign Out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="hidden md:inline font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {profile?.email || 'Account'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Contextual Tabs - THE ONLY PRIMARY NAVIGATION */}
      <ContextualTabs />
      
      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
