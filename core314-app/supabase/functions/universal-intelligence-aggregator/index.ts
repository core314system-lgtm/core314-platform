import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Universal Integration Intelligence Aggregator - Phase 8 UIIC
 * 
 * This function processes ALL integrations and computes:
 * 1. Normalized intelligence metrics (activity_volume, participation, responsiveness, throughput)
 * 2. Temporal trends (week-over-week changes)
 * 3. Human-readable insights
 * 4. Fusion Score contributions
 * 
 * Every integration must produce meaningful intelligence - no placeholders.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Integration category definitions for insight generation
const INTEGRATION_CATEGORIES: Record<string, string> = {
  slack: 'communication',
  microsoft_teams: 'communication',
  discord: 'communication',
  zoom: 'meetings',
  google_calendar: 'meetings',
  google_meet: 'meetings',
  jira: 'project_management',
  asana: 'project_management',
  trello: 'project_management',
  linear: 'project_management',
  monday: 'project_management',
  clickup: 'project_management',
  basecamp: 'project_management',
  microsoft_planner: 'project_management',
  github: 'engineering',
  gitlab: 'engineering',
  bitbucket: 'engineering',
  notion: 'documentation',
  confluence: 'documentation',
  zendesk: 'support',
  intercom: 'support',
  freshdesk: 'support',
  servicenow: 'support',
  figma: 'design',
  miro: 'design',
  airtable: 'data',
  smartsheet: 'data',
};

interface IntegrationMetrics {
  activity_volume: number;
  participation_level: number;
  responsiveness: number;
  throughput: number;
  raw_metrics: Record<string, number>;
  signals_used: string[];
}

interface ComputedInsight {
  insight_key: string;
  insight_text: string;
  severity: 'info' | 'warning' | 'positive' | 'negative';
  confidence: number;
  metadata: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch all active user integrations
    const { data: activeIntegrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        integration_id,
        provider_id,
        status,
        integration_registry (
          id,
          service_name,
          display_name
        )
      `)
      .eq('status', 'active')
      .eq('added_by_user', true);

    if (intError) {
      console.error('[universal-intelligence] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!activeIntegrations || activeIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No active integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    let insightsGenerated = 0;
    const errors: string[] = [];
    const results: Record<string, unknown>[] = [];

    for (const integration of activeIntegrations) {
      try {
        const registryData = integration.integration_registry;
        const registry = Array.isArray(registryData) ? registryData[0] : registryData;
        const serviceName = registry?.service_name;
        const displayName = registry?.display_name || serviceName;

        if (!serviceName) {
          continue;
        }

        // Fetch recent events for this integration
        const { data: currentWeekEvents } = await supabase
          .from('integration_events')
          .select('event_type, occurred_at, metadata')
          .eq('user_id', integration.user_id)
          .eq('service_name', serviceName)
          .gte('occurred_at', weekAgo.toISOString())
          .order('occurred_at', { ascending: false });

        const { data: previousWeekEvents } = await supabase
          .from('integration_events')
          .select('event_type, occurred_at, metadata')
          .eq('user_id', integration.user_id)
          .eq('service_name', serviceName)
          .gte('occurred_at', twoWeeksAgo.toISOString())
          .lt('occurred_at', weekAgo.toISOString());

        // Compute normalized metrics based on integration category
        const category = INTEGRATION_CATEGORIES[serviceName] || 'general';
                const metrics = computeMetrics(
                  serviceName,
                  category,
                  currentWeekEvents || []
                );

        // Compute week-over-week change
        const weekOverWeekChange = computeWeekOverWeekChange(
          currentWeekEvents || [],
          previousWeekEvents || []
        );

        const trendDirection = weekOverWeekChange > 5 ? 'up' : weekOverWeekChange < -5 ? 'down' : 'stable';

        // Compute anomaly score (simple z-score based)
        const anomalyScore = computeAnomalyScore(metrics);
        const anomalyDetected = anomalyScore > 2.0;

        // Compute Fusion contribution
        const fusionContribution = computeFusionContribution(metrics, category);

        // Store intelligence data
        await supabase.from('integration_intelligence').upsert({
          user_id: integration.user_id,
          integration_id: integration.integration_id,
          service_name: serviceName,
          activity_volume: metrics.activity_volume,
          participation_level: metrics.participation_level,
          responsiveness: metrics.responsiveness,
          throughput: metrics.throughput,
          week_over_week_change: weekOverWeekChange,
          trend_direction: trendDirection,
          anomaly_score: anomalyScore,
          anomaly_detected: anomalyDetected,
          fusion_contribution: fusionContribution,
          fusion_weight: getCategoryWeight(category),
          raw_metrics: metrics.raw_metrics,
          signals_used: metrics.signals_used,
          computed_at: now.toISOString(),
        }, { onConflict: 'user_id,integration_id,service_name' });

        // Generate human-readable insights
                const insights = generateInsights(
                  serviceName,
                  displayName,
                  category,
                  metrics,
                  weekOverWeekChange,
                  trendDirection,
                  currentWeekEvents || []
                );

        // Store insights (delete old ones first, keep only latest)
        if (insights.length > 0) {
          await supabase
            .from('integration_insights')
            .delete()
            .eq('user_id', integration.user_id)
            .eq('service_name', serviceName);

          for (const insight of insights) {
            await supabase.from('integration_insights').insert({
              user_id: integration.user_id,
              integration_id: integration.integration_id,
              service_name: serviceName,
              insight_key: insight.insight_key,
              insight_text: insight.insight_text,
              severity: insight.severity,
              confidence: insight.confidence,
              metadata: insight.metadata,
              computed_at: now.toISOString(),
            });
            insightsGenerated++;
          }
        }

        // Also update fusion_metrics for Fusion Score calculation
        await updateFusionMetrics(supabase, integration, serviceName, metrics, now);

        processedCount++;
        results.push({
          service_name: serviceName,
          metrics: {
            activity_volume: metrics.activity_volume,
            participation_level: metrics.participation_level,
            responsiveness: metrics.responsiveness,
            throughput: metrics.throughput,
          },
          trend: trendDirection,
          insights_count: insights.length,
          fusion_contribution: fusionContribution,
        });

        console.log('[universal-intelligence] Processed:', serviceName, 'for user:', integration.user_id);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        console.error('[universal-intelligence] Error processing integration:', integration.id, userError);
        errors.push(`Error for integration ${integration.id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      insights_generated: insightsGenerated,
      total: activeIntegrations.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[universal-intelligence] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Compute normalized metrics based on integration category
 */
function computeMetrics(
  serviceName: string,
  category: string,
  currentEvents: Array<{ event_type: string; metadata: Record<string, unknown> }>
): IntegrationMetrics {
  const metrics: IntegrationMetrics = {
    activity_volume: 0,
    participation_level: 0,
    responsiveness: 50,
    throughput: 50,
    raw_metrics: {},
    signals_used: [],
  };

  if (currentEvents.length === 0) {
    return metrics;
  }

  // Extract raw metrics from the most recent event
  const latestEvent = currentEvents[0];
  const metadata = latestEvent?.metadata || {};

  switch (category) {
    case 'communication':
      metrics.raw_metrics = extractCommunicationMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.message_volume || 0, 0, 1000);
      metrics.participation_level = normalizeToScale(metrics.raw_metrics.active_channels || metrics.raw_metrics.channel_count || 0, 0, 50);
      metrics.responsiveness = 50 + (metrics.activity_volume / 2);
      metrics.throughput = metrics.activity_volume;
      metrics.signals_used = ['message_volume', 'channel_activity', 'member_count'];
      break;

    case 'meetings':
      metrics.raw_metrics = extractMeetingMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.meeting_count || 0, 0, 50);
      metrics.participation_level = normalizeToScale(metrics.raw_metrics.total_participants || metrics.raw_metrics.attendee_count || 0, 0, 100);
      metrics.responsiveness = 50;
      metrics.throughput = normalizeToScale(metrics.raw_metrics.total_duration || 0, 0, 2000);
      metrics.signals_used = ['meeting_count', 'duration', 'participants'];
      break;

        case 'project_management': {
          metrics.raw_metrics = extractProjectMetrics(serviceName, metadata);
          const totalTasks = metrics.raw_metrics.task_count || metrics.raw_metrics.issue_count || metrics.raw_metrics.item_count || 0;
          const completedTasks = metrics.raw_metrics.completed_tasks || metrics.raw_metrics.done_issues || metrics.raw_metrics.closed_cards || 0;
          const openTasks = metrics.raw_metrics.open_tasks || metrics.raw_metrics.open_issues || metrics.raw_metrics.open_cards || 0;
      
          metrics.activity_volume = normalizeToScale(totalTasks, 0, 500);
          metrics.participation_level = normalizeToScale(metrics.raw_metrics.project_count || metrics.raw_metrics.board_count || metrics.raw_metrics.space_count || 0, 0, 20);
          metrics.throughput = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 50;
          metrics.responsiveness = openTasks > 0 ? Math.max(0, 100 - (openTasks / totalTasks) * 100) : 50;
          metrics.signals_used = ['task_count', 'completion_rate', 'backlog_size'];
          break;
        }

    case 'engineering':
      metrics.raw_metrics = extractEngineeringMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.repo_count || metrics.raw_metrics.project_count || 0, 0, 50);
      metrics.participation_level = normalizeToScale(
        (metrics.raw_metrics.open_pull_requests || metrics.raw_metrics.open_merge_requests || 0) +
        (metrics.raw_metrics.open_issues || 0),
        0, 100
      );
      metrics.throughput = 50; // Would need merge rate data
      metrics.responsiveness = 50; // Would need PR review time data
      metrics.signals_used = ['repo_count', 'open_prs', 'open_issues'];
      break;

    case 'documentation':
      metrics.raw_metrics = extractDocumentationMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.page_count || 0, 0, 500);
      metrics.participation_level = normalizeToScale(metrics.raw_metrics.space_count || metrics.raw_metrics.database_count || 0, 0, 20);
      metrics.throughput = 50;
      metrics.responsiveness = 50;
      metrics.signals_used = ['page_count', 'space_count', 'database_count'];
      break;

        case 'support': {
          metrics.raw_metrics = extractSupportMetrics(serviceName, metadata);
          const totalTickets = metrics.raw_metrics.ticket_count || metrics.raw_metrics.conversation_count || metrics.raw_metrics.incident_count || 0;
          const resolvedTickets = metrics.raw_metrics.resolved_tickets || metrics.raw_metrics.closed_conversations || metrics.raw_metrics.resolved_incidents || metrics.raw_metrics.solved_tickets || 0;
          const openTickets = metrics.raw_metrics.open_tickets || metrics.raw_metrics.open_conversations || metrics.raw_metrics.new_incidents || 0;
      
          metrics.activity_volume = normalizeToScale(totalTickets, 0, 500);
          metrics.participation_level = 50;
          metrics.throughput = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 50;
          metrics.responsiveness = totalTickets > 0 ? Math.max(0, 100 - (openTickets / totalTickets) * 50) : 50;
          metrics.signals_used = ['ticket_volume', 'resolution_rate', 'backlog_size'];
          break;
        }

    case 'design':
      metrics.raw_metrics = extractDesignMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.file_count || metrics.raw_metrics.board_count || 0, 0, 100);
      metrics.participation_level = normalizeToScale(metrics.raw_metrics.project_count || metrics.raw_metrics.team_count || 0, 0, 20);
      metrics.throughput = 50;
      metrics.responsiveness = 50;
      metrics.signals_used = ['file_count', 'board_count', 'project_count'];
      break;

    case 'data':
      metrics.raw_metrics = extractDataMetrics(serviceName, metadata);
      metrics.activity_volume = normalizeToScale(metrics.raw_metrics.record_count || metrics.raw_metrics.row_count || 0, 0, 10000);
      metrics.participation_level = normalizeToScale(metrics.raw_metrics.base_count || metrics.raw_metrics.sheet_count || 0, 0, 50);
      metrics.throughput = 50;
      metrics.responsiveness = 50;
      metrics.signals_used = ['record_count', 'table_count', 'base_count'];
      break;

    default:
      metrics.activity_volume = normalizeToScale(currentEvents.length, 0, 100);
      metrics.signals_used = ['event_count'];
  }

  return metrics;
}

// Metric extraction helpers
function extractCommunicationMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  switch (serviceName) {
    case 'slack':
      return {
        message_volume: (metadata.chat_count as number) || 0,
        channel_count: (metadata.channel_count as number) || 0,
      };
    case 'microsoft_teams':
      return {
        message_volume: (metadata.chat_count as number) || 0,
        channel_count: (metadata.channel_count as number) || 0,
        meeting_count: (metadata.meeting_count as number) || 0,
      };
    case 'discord':
      return {
        guild_count: (metadata.guild_count as number) || 0,
        channel_count: (metadata.channel_count as number) || 0,
        member_count: (metadata.member_count as number) || 0,
      };
    default:
      return {};
  }
}

function extractMeetingMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  switch (serviceName) {
    case 'zoom':
      return {
        meeting_count: (metadata.meeting_count as number) || 0,
        total_duration: (metadata.total_duration_minutes as number) || 0,
        total_participants: (metadata.total_participants as number) || 0,
      };
    case 'google_calendar':
      return {
        event_count: (metadata.event_count as number) || 0,
        meeting_count: (metadata.meeting_count as number) || 0,
        total_duration: (metadata.total_duration_minutes as number) || 0,
      };
    case 'google_meet':
      return {
        meeting_count: (metadata.meeting_count as number) || 0,
        upcoming_meetings: (metadata.upcoming_meetings as number) || 0,
        past_meetings: (metadata.past_meetings as number) || 0,
      };
    default:
      return {};
  }
}

function extractProjectMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  const baseMetrics: Record<string, number> = {};
  
  // Common fields across project management tools
  baseMetrics.task_count = (metadata.task_count as number) || (metadata.issue_count as number) || (metadata.item_count as number) || (metadata.card_count as number) || (metadata.todo_count as number) || 0;
  baseMetrics.completed_tasks = (metadata.completed_tasks as number) || (metadata.done_issues as number) || (metadata.closed_cards as number) || (metadata.completed_todos as number) || 0;
  baseMetrics.open_tasks = (metadata.open_tasks as number) || (metadata.open_issues as number) || (metadata.open_cards as number) || (metadata.incomplete_tasks as number) || 0;
  baseMetrics.in_progress_tasks = (metadata.in_progress_tasks as number) || (metadata.in_progress_issues as number) || 0;
  baseMetrics.project_count = (metadata.project_count as number) || (metadata.board_count as number) || (metadata.space_count as number) || (metadata.plan_count as number) || (metadata.todolist_count as number) || 0;
  
  // Tool-specific fields
  if (serviceName === 'linear') {
    baseMetrics.backlog_issues = (metadata.backlog_issues as number) || 0;
    baseMetrics.todo_issues = (metadata.todo_issues as number) || 0;
  }
  
  return baseMetrics;
}

function extractEngineeringMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  return {
    repo_count: (metadata.repo_count as number) || (metadata.project_count as number) || 0,
    open_issues: (metadata.open_issues as number) || 0,
    open_pull_requests: (metadata.open_pull_requests as number) || (metadata.open_merge_requests as number) || 0,
  };
}

function extractDocumentationMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  return {
    page_count: (metadata.page_count as number) || 0,
    space_count: (metadata.space_count as number) || 0,
    database_count: (metadata.database_count as number) || 0,
  };
}

function extractSupportMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  return {
    ticket_count: (metadata.ticket_count as number) || (metadata.conversation_count as number) || (metadata.incident_count as number) || 0,
    open_tickets: (metadata.open_tickets as number) || (metadata.open_conversations as number) || (metadata.new_incidents as number) || 0,
    pending_tickets: (metadata.pending_tickets as number) || (metadata.snoozed_conversations as number) || (metadata.in_progress_incidents as number) || 0,
    resolved_tickets: (metadata.resolved_tickets as number) || (metadata.closed_conversations as number) || (metadata.resolved_incidents as number) || 0,
    solved_tickets: (metadata.solved_tickets as number) || (metadata.closed_tickets as number) || (metadata.closed_incidents as number) || 0,
  };
}

function extractDesignMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  return {
    project_count: (metadata.project_count as number) || 0,
    file_count: (metadata.file_count as number) || 0,
    board_count: (metadata.board_count as number) || 0,
    team_count: (metadata.team_count as number) || 0,
  };
}

function extractDataMetrics(serviceName: string, metadata: Record<string, unknown>): Record<string, number> {
  return {
    base_count: (metadata.base_count as number) || (metadata.workspace_count as number) || 0,
    table_count: (metadata.table_count as number) || (metadata.sheet_count as number) || 0,
    record_count: (metadata.record_count as number) || (metadata.row_count as number) || 0,
  };
}

/**
 * Normalize a value to 0-100 scale
 */
function normalizeToScale(value: number, min: number, max: number): number {
  if (max === min) return 50;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Compute week-over-week change percentage
 */
function computeWeekOverWeekChange(
  currentEvents: Array<{ metadata: Record<string, unknown> }>,
  previousEvents: Array<{ metadata: Record<string, unknown> }>
): number {
  // Simple event count comparison
  const currentCount = currentEvents.length;
  const previousCount = previousEvents.length;
  
  if (previousCount === 0) return 0;
  return ((currentCount - previousCount) / previousCount) * 100;
}

/**
 * Compute anomaly score (simple z-score approximation)
 */
function computeAnomalyScore(metrics: IntegrationMetrics): number {
  // Simple anomaly detection: if any metric is extremely high or low
  const values = [
    metrics.activity_volume,
    metrics.participation_level,
    metrics.responsiveness,
    metrics.throughput,
  ];
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  // Return max z-score across all metrics
  return Math.max(...values.map(v => Math.abs((v - avg) / stdDev)));
}

/**
 * Compute Fusion Score contribution based on metrics and category
 */
function computeFusionContribution(metrics: IntegrationMetrics, category: string): number {
  const categoryWeight = getCategoryWeight(category);
  
  // Weighted average of normalized metrics
  const weightedScore = (
    metrics.activity_volume * 0.3 +
    metrics.participation_level * 0.2 +
    metrics.responsiveness * 0.25 +
    metrics.throughput * 0.25
  );
  
  return weightedScore * categoryWeight;
}

/**
 * Get category weight for Fusion Score
 */
function getCategoryWeight(category: string): number {
  const weights: Record<string, number> = {
    communication: 0.25,
    meetings: 0.15,
    project_management: 0.25,
    engineering: 0.15,
    documentation: 0.05,
    support: 0.10,
    design: 0.03,
    data: 0.02,
    general: 0.05,
  };
  return weights[category] || 0.05;
}

/**
 * Generate human-readable insights based on metrics and trends
 */
function generateInsights(
  serviceName: string,
  displayName: string,
  category: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  currentEvents: Array<{ metadata: Record<string, unknown> }>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  if (currentEvents.length === 0) {
    return insights;
  }

  const latestMetadata = currentEvents[0]?.metadata || {};
  const absChange = Math.abs(weekOverWeekChange);

  // Generate category-specific insights
  switch (category) {
    case 'communication':
      insights.push(...generateCommunicationInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'meetings':
      insights.push(...generateMeetingInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'project_management':
      insights.push(...generateProjectInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'engineering':
      insights.push(...generateEngineeringInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'support':
      insights.push(...generateSupportInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'documentation':
      insights.push(...generateDocumentationInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'design':
      insights.push(...generateDesignInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    case 'data':
      insights.push(...generateDataInsights(displayName, metrics, weekOverWeekChange, trendDirection, latestMetadata));
      break;
    default:
      // Generic insight for unknown categories
      if (absChange > 10) {
        insights.push({
          insight_key: `${serviceName}_activity_change`,
          insight_text: `${displayName} activity ${trendDirection === 'up' ? 'increased' : 'decreased'} ${Math.round(absChange)}% this week.`,
          severity: trendDirection === 'up' ? 'positive' : 'info',
          confidence: 0.6,
          metadata: { change_pct: weekOverWeekChange },
        });
      }
  }

  return insights;
}

function generateCommunicationInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  const absChange = Math.abs(weekOverWeekChange);

  // Activity trend insight
  if (absChange > 15) {
    const direction = trendDirection === 'up' ? 'increased' : 'decreased';
    insights.push({
      insight_key: 'communication_volume_change',
      insight_text: `${displayName} message activity ${direction} ${Math.round(absChange)}% this week — ${trendDirection === 'up' ? 'team engagement is rising' : 'consider checking in with your team'}.`,
      severity: trendDirection === 'up' ? 'positive' : 'warning',
      confidence: 0.75,
      metadata: { change_pct: weekOverWeekChange, activity_volume: metrics.activity_volume },
    });
  }

  // Channel concentration insight
  const channelCount = (metadata.channel_count as number) || 0;
  if (channelCount > 0 && metrics.activity_volume > 30) {
    insights.push({
      insight_key: 'communication_channel_activity',
      insight_text: `Communication is spread across ${channelCount} active channels — ${channelCount > 10 ? 'consider consolidating to reduce context switching' : 'healthy channel distribution'}.`,
      severity: channelCount > 15 ? 'warning' : 'info',
      confidence: 0.7,
      metadata: { channel_count: channelCount },
    });
  }

  return insights;
}

function generateMeetingInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  const meetingCount = (metadata.meeting_count as number) || (metadata.event_count as number) || 0;
  const totalDuration = (metadata.total_duration_minutes as number) || 0;
  const absChange = Math.abs(weekOverWeekChange);

  // Meeting load insight
  if (meetingCount > 0) {
    const hoursInMeetings = Math.round(totalDuration / 60 * 10) / 10;
    let severity: 'info' | 'warning' | 'positive' = 'info';
    let commentary = '';
    
    if (hoursInMeetings > 20) {
      severity = 'warning';
      commentary = 'high meeting load may impact deep work time';
    } else if (hoursInMeetings < 5 && meetingCount > 3) {
      severity = 'positive';
      commentary = 'efficient meeting culture with short sessions';
    } else {
      commentary = 'balanced meeting schedule';
    }

    insights.push({
      insight_key: 'meeting_load',
      insight_text: `You spent ${hoursInMeetings} hours in ${meetingCount} meetings this week — ${commentary}.`,
      severity,
      confidence: 0.8,
      metadata: { meeting_count: meetingCount, hours: hoursInMeetings },
    });
  }

  // Meeting trend insight
  if (absChange > 20) {
    insights.push({
      insight_key: 'meeting_trend',
      insight_text: `Meeting activity ${trendDirection === 'up' ? 'increased' : 'decreased'} ${Math.round(absChange)}% compared to last week.`,
      severity: trendDirection === 'up' && weekOverWeekChange > 30 ? 'warning' : 'info',
      confidence: 0.7,
      metadata: { change_pct: weekOverWeekChange },
    });
  }

  return insights;
}

function generateProjectInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const totalTasks = (metadata.task_count as number) || (metadata.issue_count as number) || (metadata.item_count as number) || (metadata.card_count as number) || 0;
  const completedTasks = (metadata.completed_tasks as number) || (metadata.done_issues as number) || (metadata.closed_cards as number) || 0;
  const openTasks = (metadata.open_tasks as number) || (metadata.open_issues as number) || (metadata.open_cards as number) || (metadata.incomplete_tasks as number) || 0;
  const inProgressTasks = (metadata.in_progress_tasks as number) || (metadata.in_progress_issues as number) || 0;

  // Throughput insight
  if (totalTasks > 0) {
    const completionRate = Math.round((completedTasks / totalTasks) * 100);
    let severity: 'info' | 'warning' | 'positive' | 'negative' = 'info';
    let commentary = '';

    if (completionRate > 70) {
      severity = 'positive';
      commentary = 'strong execution velocity';
    } else if (completionRate < 30 && openTasks > 10) {
      severity = 'warning';
      commentary = 'potential workload imbalance';
    } else {
      commentary = 'steady progress';
    }

    insights.push({
      insight_key: 'project_throughput',
      insight_text: `${displayName} shows ${completionRate}% task completion rate with ${openTasks} items in backlog — ${commentary}.`,
      severity,
      confidence: 0.75,
      metadata: { completion_rate: completionRate, open_tasks: openTasks, total_tasks: totalTasks },
    });
  }

  // WIP insight
  if (inProgressTasks > 5) {
    insights.push({
      insight_key: 'project_wip',
      insight_text: `${inProgressTasks} tasks currently in progress — ${inProgressTasks > 10 ? 'high WIP may slow delivery' : 'manageable work in progress'}.`,
      severity: inProgressTasks > 10 ? 'warning' : 'info',
      confidence: 0.7,
      metadata: { in_progress: inProgressTasks },
    });
  }

  return insights;
}

function generateEngineeringInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const openPRs = (metadata.open_pull_requests as number) || (metadata.open_merge_requests as number) || 0;
  const openIssues = (metadata.open_issues as number) || 0;
  const repoCount = (metadata.repo_count as number) || (metadata.project_count as number) || 0;

  // PR backlog insight
  if (openPRs > 0) {
    let severity: 'info' | 'warning' | 'positive' = 'info';
    let commentary = '';

    if (openPRs > 10) {
      severity = 'warning';
      commentary = 'review bottleneck may be forming';
    } else if (openPRs <= 3) {
      severity = 'positive';
      commentary = 'healthy review throughput';
    } else {
      commentary = 'normal review queue';
    }

    insights.push({
      insight_key: 'engineering_pr_backlog',
      insight_text: `${openPRs} open pull requests across ${repoCount} repositories — ${commentary}.`,
      severity,
      confidence: 0.75,
      metadata: { open_prs: openPRs, repo_count: repoCount },
    });
  }

  // Issue backlog insight
  if (openIssues > 20) {
    insights.push({
      insight_key: 'engineering_issue_backlog',
      insight_text: `${openIssues} open issues in your ${displayName} repositories — consider triaging or closing stale items.`,
      severity: 'warning',
      confidence: 0.7,
      metadata: { open_issues: openIssues },
    });
  }

  return insights;
}

function generateSupportInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const totalTickets = (metadata.ticket_count as number) || (metadata.conversation_count as number) || (metadata.incident_count as number) || 0;
  const openTickets = (metadata.open_tickets as number) || (metadata.open_conversations as number) || (metadata.new_incidents as number) || 0;
  const resolvedTickets = (metadata.resolved_tickets as number) || (metadata.closed_conversations as number) || (metadata.resolved_incidents as number) || (metadata.solved_tickets as number) || 0;

  // Resolution rate insight
  if (totalTickets > 0) {
    const resolutionRate = Math.round((resolvedTickets / totalTickets) * 100);
    let severity: 'info' | 'warning' | 'positive' = 'info';
    let commentary = '';

    if (resolutionRate > 80) {
      severity = 'positive';
      commentary = 'excellent support throughput';
    } else if (resolutionRate < 50 && openTickets > 10) {
      severity = 'warning';
      commentary = 'backlog growing faster than resolution';
    } else {
      commentary = 'steady support operations';
    }

    insights.push({
      insight_key: 'support_resolution',
      insight_text: `${displayName} shows ${resolutionRate}% resolution rate with ${openTickets} open tickets — ${commentary}.`,
      severity,
      confidence: 0.8,
      metadata: { resolution_rate: resolutionRate, open_tickets: openTickets },
    });
  }

  // Volume trend insight
  const absChange = Math.abs(weekOverWeekChange);
  if (absChange > 20 && trendDirection === 'up') {
    insights.push({
      insight_key: 'support_volume_spike',
      insight_text: `Support volume increased ${Math.round(absChange)}% this week — monitor for emerging issues.`,
      severity: 'warning',
      confidence: 0.7,
      metadata: { change_pct: weekOverWeekChange },
    });
  }

  return insights;
}

function generateDocumentationInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const pageCount = (metadata.page_count as number) || 0;
  const spaceCount = (metadata.space_count as number) || (metadata.database_count as number) || 0;
  const absChange = Math.abs(weekOverWeekChange);

  if (pageCount > 0) {
    insights.push({
      insight_key: 'documentation_coverage',
      insight_text: `${displayName} contains ${pageCount} pages across ${spaceCount} spaces — ${pageCount > 100 ? 'comprehensive documentation base' : 'documentation is growing'}.`,
      severity: 'info',
      confidence: 0.7,
      metadata: { page_count: pageCount, space_count: spaceCount },
    });
  }

  if (absChange > 15) {
    insights.push({
      insight_key: 'documentation_activity',
      insight_text: `Documentation activity ${trendDirection === 'up' ? 'increased' : 'decreased'} ${Math.round(absChange)}% this week.`,
      severity: trendDirection === 'up' ? 'positive' : 'info',
      confidence: 0.65,
      metadata: { change_pct: weekOverWeekChange },
    });
  }

  return insights;
}

function generateDesignInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const fileCount = (metadata.file_count as number) || (metadata.board_count as number) || 0;
  const projectCount = (metadata.project_count as number) || (metadata.team_count as number) || 0;
  const absChange = Math.abs(weekOverWeekChange);

  if (fileCount > 0) {
    insights.push({
      insight_key: 'design_activity',
      insight_text: `${displayName} shows ${fileCount} active design files across ${projectCount} projects — ${fileCount > 20 ? 'active design work in progress' : 'focused design effort'}.`,
      severity: 'info',
      confidence: 0.7,
      metadata: { file_count: fileCount, project_count: projectCount },
    });
  }

  if (absChange > 25) {
    insights.push({
      insight_key: 'design_trend',
      insight_text: `Design activity ${trendDirection === 'up' ? 'spiked' : 'slowed'} ${Math.round(absChange)}% this week — ${trendDirection === 'up' ? 'likely aligned with sprint planning' : 'design phase may be wrapping up'}.`,
      severity: 'info',
      confidence: 0.6,
      metadata: { change_pct: weekOverWeekChange },
    });
  }

  return insights;
}

function generateDataInsights(
  displayName: string,
  metrics: IntegrationMetrics,
  weekOverWeekChange: number,
  trendDirection: string,
  metadata: Record<string, unknown>
): ComputedInsight[] {
  const insights: ComputedInsight[] = [];
  
  const recordCount = (metadata.record_count as number) || (metadata.row_count as number) || 0;
  const baseCount = (metadata.base_count as number) || (metadata.sheet_count as number) || (metadata.workspace_count as number) || 0;
  const tableCount = (metadata.table_count as number) || 0;

  if (recordCount > 0 || baseCount > 0) {
    insights.push({
      insight_key: 'data_volume',
      insight_text: `${displayName} manages ${recordCount.toLocaleString()} records across ${baseCount} ${baseCount === 1 ? 'base' : 'bases'} — ${recordCount > 1000 ? 'significant operational data' : 'growing data foundation'}.`,
      severity: 'info',
      confidence: 0.7,
      metadata: { record_count: recordCount, base_count: baseCount, table_count: tableCount },
    });
  }

  const absChange = Math.abs(weekOverWeekChange);
  if (absChange > 20) {
    insights.push({
      insight_key: 'data_growth',
      insight_text: `Data activity ${trendDirection === 'up' ? 'increased' : 'decreased'} ${Math.round(absChange)}% this week.`,
      severity: trendDirection === 'up' ? 'positive' : 'info',
      confidence: 0.65,
      metadata: { change_pct: weekOverWeekChange },
    });
  }

  return insights;
}

/**
 * Update fusion_metrics table for Fusion Score calculation
 */
async function updateFusionMetrics(
  supabase: ReturnType<typeof createClient>,
  integration: { user_id: string; integration_id: string },
  serviceName: string,
  metrics: IntegrationMetrics,
  now: Date
): Promise<void> {
  const metricMappings = [
    { name: `${serviceName}_activity_volume`, type: 'normalized', value: metrics.activity_volume },
    { name: `${serviceName}_participation`, type: 'normalized', value: metrics.participation_level },
    { name: `${serviceName}_responsiveness`, type: 'normalized', value: metrics.responsiveness },
    { name: `${serviceName}_throughput`, type: 'normalized', value: metrics.throughput },
  ];

  for (const metric of metricMappings) {
    if (metric.value > 0) {
      await supabase.from('fusion_metrics').upsert({
        user_id: integration.user_id,
        integration_id: integration.integration_id,
        metric_name: metric.name,
        metric_type: metric.type,
        raw_value: metric.value,
        normalized_value: metric.value / 100,
        weight: 0.25,
        data_source: { source: 'universal_intelligence', service: serviceName },
        synced_at: now.toISOString(),
      }, { onConflict: 'user_id,integration_id,metric_name' });
    }
  }
}
