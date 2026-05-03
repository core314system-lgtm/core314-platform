import { Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';

// =============================================================================
// RECOMMENDED INTEGRATION BADGE
// Shows a "Recommended" badge on integration cards that pair well with the
// user's currently connected integrations. Helps users discover synergies.
// =============================================================================

// Recommendation rules: if user has integration X, recommend Y
const RECOMMENDATION_MAP: Record<string, string[]> = {
  slack: ['jira', 'asana', 'monday', 'github'],
  jira: ['slack', 'github', 'microsoft_teams'],
  hubspot: ['gmail', 'salesforce', 'zoom'],
  salesforce: ['hubspot', 'gmail', 'zoom', 'slack'],
  gmail: ['google_calendar', 'google_sheets', 'hubspot'],
  google_calendar: ['gmail', 'zoom', 'google_sheets'],
  github: ['jira', 'slack', 'asana'],
  asana: ['slack', 'github', 'google_calendar'],
  monday: ['slack', 'zoom', 'google_calendar'],
  microsoft_teams: ['jira', 'trello', 'asana'],
  trello: ['slack', 'microsoft_teams'],
  zoom: ['google_calendar', 'salesforce', 'hubspot'],
  zendesk: ['slack', 'salesforce', 'hubspot'],
  notion: ['slack', 'github', 'asana'],
  google_sheets: ['gmail', 'google_calendar', 'hubspot'],
  quickbooks: ['hubspot', 'salesforce', 'gmail'],
};

/**
 * Given a list of connected service names, returns the set of recommended
 * (not yet connected) integrations.
 */
export function getRecommendedIntegrations(connectedServices: string[]): Set<string> {
  const recommended = new Set<string>();
  const connectedSet = new Set(connectedServices);

  for (const connected of connectedServices) {
    const suggestions = RECOMMENDATION_MAP[connected] || [];
    for (const suggestion of suggestions) {
      if (!connectedSet.has(suggestion)) {
        recommended.add(suggestion);
      }
    }
  }

  return recommended;
}

interface RecommendedIntegrationBadgeProps {
  serviceName: string;
  connectedServices: string[];
}

export function RecommendedIntegrationBadge({
  serviceName,
  connectedServices,
}: RecommendedIntegrationBadgeProps) {
  const recommended = getRecommendedIntegrations(connectedServices);

  if (!recommended.has(serviceName)) return null;

  return (
    <Badge
      variant="secondary"
      className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800 text-xs gap-1"
    >
      <Sparkles className="h-3 w-3" />
      Recommended
    </Badge>
  );
}
