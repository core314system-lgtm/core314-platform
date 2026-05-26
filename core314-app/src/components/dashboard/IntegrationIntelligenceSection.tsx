import { Brain } from 'lucide-react';
import { IntegrationWithScore } from '../../types';

/**
 * Integration Intelligence Section
 * 
 * Makes it explicitly clear what Core314 is learning from each connected integration
 * and how each integration contributes to overall system intelligence.
 * 
 * Location: Within Integration cards
 * Visible: ONLY for connected integrations
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - No recommendations, actions, or CTAs
 * - Content must be deterministic
 * - Must render meaningfully even when metrics are minimal (observing state)
 */

interface IntegrationIntelligenceSectionProps {
  integration: IntegrationWithScore;
  scoreOrigin?: 'baseline' | 'computed';
}

// Signal domain mapping based on integration type
const SIGNAL_DOMAIN_MAP: Record<string, string> = {
  slack: 'communication flow and response timing',
  microsoft_teams: 'collaboration patterns and meeting cadence',
  microsoft_365: 'productivity patterns and document activity',
  outlook: 'email communication and scheduling patterns',
  gmail: 'email flow and response timing',
  trello: 'task management and workflow patterns',
  google_drive: 'document collaboration and file activity',
  hubspot: 'customer engagement and pipeline activity',
  salesforce: 'sales activity and customer relationship patterns',
  jira: 'project tracking and development workflow',
  asana: 'task coordination and team workload',
  notion: 'knowledge management and documentation patterns',
  zoom: 'meeting frequency and engagement patterns',
  default: 'operational activity and system behavior',
};

// Get signal domain for an integration
function getSignalDomain(integrationName: string): string {
  const normalizedName = integrationName.toLowerCase().replace(/\s+/g, '_');
  return SIGNAL_DOMAIN_MAP[normalizedName] || SIGNAL_DOMAIN_MAP.default;
}

// Determine if integration is in observing state
function isObservingState(integration: IntegrationWithScore, scoreOrigin?: string): boolean {
  // Observing if: no fusion score, or baseline mode, or no metrics
  return (
    integration.fusion_score === undefined ||
    integration.fusion_score === null ||
    scoreOrigin === 'baseline' ||
    integration.metrics_count === 0
  );
}

// Derive variance level from trend direction and score
function deriveVarianceLevel(integration: IntegrationWithScore): 'high' | 'moderate' | 'low' {
  // If declining trend, higher variance
  if (integration.trend_direction === 'down') {
    return 'high';
  }
  // If stable or no trend, moderate variance
  if (integration.trend_direction === 'stable' || !integration.trend_direction) {
    return 'moderate';
  }
  // If improving trend, lower variance
  return 'low';
}

// Generate intelligence statements based on integration data
function generateIntelligenceStatements(
  integration: IntegrationWithScore,
  scoreOrigin?: string
): string[] {
  const statements: string[] = [];
  const isObserving = isObservingState(integration, scoreOrigin);
  const signalDomain = getSignalDomain(integration.integration_name);
  const varianceLevel = deriveVarianceLevel(integration);

  // 1. Signal Domain statement
  statements.push(
    `This integration contributes ${signalDomain} signals to system intelligence.`
  );

  // 2. Signal Stability statement
  if (isObserving) {
    statements.push(
      'Signal patterns are still stabilizing during calibration.'
    );
  } else {
    statements.push(
      'Stable activity patterns are contributing to system confidence.'
    );
  }

  // 3. Influence on System statement
  if (isObserving) {
    statements.push(
      'Integration influence will be determined after calibration completes.'
    );
  } else if (varianceLevel === 'low') {
    statements.push(
      'This integration influences Global Fusion Score through consistent signal patterns.'
    );
  } else if (varianceLevel === 'high') {
    statements.push(
      'This integration influences Global Fusion Score through variable signal patterns.'
    );
  } else {
    statements.push(
      'This integration influences Global Fusion Score through moderate signal variance.'
    );
  }

  // 4. Confidence Contribution statement (only if not observing)
  if (!isObserving) {
    if (varianceLevel === 'low') {
      statements.push(
        'Consistency in this integration strengthens overall system confidence.'
      );
    } else if (varianceLevel === 'high') {
      statements.push(
        'Higher variance in this integration increases system uncertainty.'
      );
    }
  }

  return statements;
}

export function IntegrationIntelligenceSection({
  integration,
  scoreOrigin,
}: IntegrationIntelligenceSectionProps) {
  const statements = generateIntelligenceStatements(integration, scoreOrigin);

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
      <div className="flex items-start gap-2 mb-2">
        <Brain className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            What Core314 Is Learning From {integration.integration_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            System-level intelligence derived from this integration
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 ml-6">
        {statements.map((statement, index) => (
          <li
            key={index}
            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2"
          >
            <span className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />
            {statement}
          </li>
        ))}
      </ul>
    </div>
  );
}
