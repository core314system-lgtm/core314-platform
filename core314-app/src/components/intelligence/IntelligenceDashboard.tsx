import { useState } from 'react';
import { useConnectedIntegrations } from '../../hooks/useConnectedIntegrations';
import { SlackIntelligenceModule } from './SlackIntelligenceModule';
import { TeamsIntelligenceModule } from './TeamsIntelligenceModule';
import { ADPIntelligenceModule } from './ADPIntelligenceModule';
import { Badge } from '../ui/badge';
import { LayoutDashboard, MessageSquare, Users, Briefcase } from 'lucide-react';

type TabId = 'overview' | 'slack' | 'teams' | 'adp';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  requiresIntegration?: string;
}

export function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { hasSlack, hasTeams, loading } = useConnectedIntegrations();

  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'slack', label: 'Slack', icon: <MessageSquare className="h-4 w-4" />, requiresIntegration: 'slack' },
    { id: 'teams', label: 'Teams', icon: <Users className="h-4 w-4" />, requiresIntegration: 'teams' },
    { id: 'adp', label: 'HR (Example)', icon: <Briefcase className="h-4 w-4" /> },
  ];

  // Filter tabs based on connected integrations
  const availableTabs = tabs.filter((tab) => {
    if (tab.requiresIntegration === 'slack') return hasSlack;
    if (tab.requiresIntegration === 'teams') return hasTeams;
    return true; // Overview and ADP always available
  });

  // Reset to overview if current tab becomes unavailable
  if (!availableTabs.find((t) => t.id === activeTab)) {
    setActiveTab('overview');
  }

  if (loading) {
    return null;
  }

  // Don't render if only overview tab is available (no integrations, no ADP demo)
  const hasIntelligenceModules = hasSlack || hasTeams || availableTabs.some((t) => t.id === 'adp');
  if (!hasIntelligenceModules) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Intelligence Dashboard Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Intelligence Modules
          </h2>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            Beta
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'overview' && (
          <>
            {hasSlack && <SlackIntelligenceModule />}
            {hasTeams && <TeamsIntelligenceModule />}
            <ADPIntelligenceModule />
          </>
        )}
        {activeTab === 'slack' && hasSlack && <SlackIntelligenceModule />}
        {activeTab === 'teams' && hasTeams && <TeamsIntelligenceModule />}
        {activeTab === 'adp' && <ADPIntelligenceModule />}
      </div>
    </div>
  );
}
