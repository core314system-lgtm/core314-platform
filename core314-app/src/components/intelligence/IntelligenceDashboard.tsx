import { useState } from 'react';
import { useConnectedIntegrations } from '../../hooks/useConnectedIntegrations';
import { useAllIntegrationIntelligence } from '../../hooks/useIntegrationIntelligence';
import { SlackIntelligenceModule } from './SlackIntelligenceModule';
import { TeamsIntelligenceModule } from './TeamsIntelligenceModule';
import { ADPIntelligenceModule } from './ADPIntelligenceModule';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { LayoutDashboard, MessageSquare, Users, Briefcase, Brain } from 'lucide-react';

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
  const { insightsMap, loading: insightsLoading } = useAllIntegrationIntelligence();
  
  // Check if any integration has insights
  const hasAnyInsights = Object.values(insightsMap).some(insights => insights.length > 0);

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

  if (loading || insightsLoading) {
    return null;
  }

  // Don't render if only overview tab is available (no integrations, no ADP demo)
  const hasIntelligenceModules = hasSlack || hasTeams || availableTabs.some((t) => t.id === 'adp');
  
  // Show Global Empty State when integrations exist but no insights yet
  if (hasIntelligenceModules && !hasAnyInsights) {
    return (
      <Card className="border-gray-200 dark:border-gray-700">
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center max-w-md mx-auto space-y-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <Brain className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Intelligence Builds from Real Activity
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Core314 generates intelligence by observing how your tools are actually used.
              As your team communicates, collaborates, and works, insights emerge automatically — no configuration required.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
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
