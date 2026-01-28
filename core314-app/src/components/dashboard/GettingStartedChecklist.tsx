import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Circle, X, Zap, BarChart3, Activity } from 'lucide-react';

/**
 * Getting Started Checklist
 * 
 * A dismissible checklist panel that is visible by default for all users.
 * 
 * Rules:
 * - Does NOT block usage
 * - Is dismissible (user-controlled)
 * - Dismissal persists via localStorage
 * - No logic tied to "first login only"
 * - Deep-links to existing routes only
 */

const CHECKLIST_DISMISSED_KEY = 'core314_getting_started_dismissed';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  isComplete: boolean;
}

interface GettingStartedChecklistProps {
  hasConnectedIntegrations?: boolean;
  hasViewedFusionScore?: boolean;
  hasCreatedAlert?: boolean;
}

export function GettingStartedChecklist({
  hasConnectedIntegrations = false,
  hasViewedFusionScore = false,
  hasCreatedAlert = false,
}: GettingStartedChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true';
  });

  // Hide if:
  // 1. User has explicitly dismissed
  // 2. User has connected integrations (no longer first-time user)
  if (isDismissed || hasConnectedIntegrations) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  const checklistItems: ChecklistItem[] = [
    {
      id: 'connect-integration',
      label: 'Connect your first integration',
      description: 'Link a tool like Slack, Teams, or Jira to start collecting signals',
      route: '/integration-hub',
      icon: <Zap className="h-4 w-4" />,
      isComplete: hasConnectedIntegrations,
    },
    {
      id: 'observe-signals',
      label: 'Observe system signals',
      description: 'View real-time signals from your connected integrations',
      route: '/system-signals',
      icon: <Activity className="h-4 w-4" />,
      isComplete: hasViewedFusionScore,
    },
    {
      id: 'review-insights',
      label: 'Review system insights',
      description: 'Analyze your operational health and Fusion Score',
      route: '/fusion-details',
      icon: <BarChart3 className="h-4 w-4" />,
      isComplete: hasCreatedAlert,
    },
  ];

  const completedCount = checklistItems.filter(item => item.isComplete).length;

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
            Getting Started
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              {completedCount}/{checklistItems.length} complete
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss getting started checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {checklistItems.map((item) => (
            <li key={item.id}>
              <Link
                to={item.route}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-colors group"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {item.isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.isComplete ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </p>
                </div>
                <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500">
                  {item.icon}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
