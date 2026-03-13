import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Signal Correlator
 *
 * Analyzes active operational_signals and groups them into correlated
 * operational events when signals from multiple integrations occur
 * within the same time window for the same organization.
 *
 * INTEGRATION-AGNOSTIC: Uses only generic fields from operational_signals:
 *   - organization_id / user_id
 *   - source_integration
 *   - signal_type
 *   - signal_data
 *   - detected_at
 *   - severity
 *
 * No integration-specific code is written. Categories are inferred
 * from signal_type using a generic mapping.
 *
 * Pipeline position:
 *   integration_events -> signal-detector -> operational_signals
 *   -> signal-correlator -> operational-brief-generate
 *
 * Designed to be called by integration-scheduler after signal detection.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Operational Category Inference ────────────────────────────────────
// Maps signal_type patterns to broad operational categories.
// This is integration-agnostic: any integration producing signals with
// these types will be automatically categorized.

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Communication patterns (no integration names — matches signal_type keywords only)
  { pattern: /communication|message|chat|response_time|engagement|spike/i, category: 'communication_activity' },
  // Revenue / pipeline patterns
  { pattern: /deal|pipeline|revenue|sales|opportunity|stalled|velocity/i, category: 'revenue_pipeline' },
  // Financial patterns
  { pattern: /invoice|payment|expense|collection|financial|overdue|billing/i, category: 'financial_activity' },
  // Operational system patterns
  { pattern: /workflow|system|health|uptime|error|failure|outage/i, category: 'operational_systems' },
  // Document / content patterns
  { pattern: /document|file|content|backlog|approval/i, category: 'document_workflow' },
  // Customer patterns
  { pattern: /customer|contact|crm|ticket|support|churn/i, category: 'customer_activity' },
  // Integration connectivity patterns
  { pattern: /integration_inactive|connection|oauth|token/i, category: 'operational_systems' },
];

/**
 * Infer the operational category from signal_type and optional signal_data.
 * Falls back to 'operational_systems' if no pattern matches.
 */
function inferCategory(signalType: string, signalData: Record<string, unknown>): string {
  // Check signal_type against known patterns
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(signalType)) {
      return category;
    }
  }

  // Check signal_data keys for hints
  const dataKeys = Object.keys(signalData).join(' ');
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(dataKeys)) {
      return category;
    }
  }

  return 'operational_systems'; // default fallback
}

// ── Correlation Types ────────────────────────────────────────────────

interface OperationalSignal {
  id: string;
  user_id: string;
  organization_id: string | null;
  signal_type: string;
  severity: string;
  confidence: number;
  description: string;
  source_integration: string;
  signal_data: Record<string, unknown>;
  detected_at: string;
  is_active: boolean;
}

interface CorrelatedEvent {
  correlation_id: string;
  organization_id: string | null;
  user_id: string;
  signal_ids: string[];
  integrations_involved: string[];
  operational_categories: string[];
  time_window_start: string;
  time_window_end: string;
  combined_severity: string;
  signals: Array<{
    id: string;
    signal_type: string;
    severity: string;
    source_integration: string;
    category: string;
    description: string;
  }>;
}

/**
 * Compute combined severity from a set of signal severities.
 *
 * Rules:
 *   - critical if any signal is critical
 *   - high if two or more high signals
 *   - medium if multiple medium signals
 *   - otherwise low
 */
function computeCombinedSeverity(severities: string[]): string {
  if (severities.includes('critical')) return 'critical';

  const highCount = severities.filter(s => s === 'high').length;
  if (highCount >= 2) return 'high';

  const mediumCount = severities.filter(s => s === 'medium').length;
  if (mediumCount >= 2) return 'medium';

  if (highCount === 1) return 'medium';

  return 'low';
}

/**
 * Cluster signals within a 30-minute window.
 * Uses a sliding window approach: sort by detected_at, then group
 * signals where each pair is within 30 minutes of each other.
 */
function clusterByTimeWindow(
  signals: Array<OperationalSignal & { category: string }>,
  windowMinutes: number = 30
): Array<Array<OperationalSignal & { category: string }>> {
  if (signals.length === 0) return [];

  // Sort by detected_at ascending
  const sorted = [...signals].sort(
    (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
  );

  const clusters: Array<Array<OperationalSignal & { category: string }>> = [];
  let currentCluster: Array<OperationalSignal & { category: string }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].detected_at).getTime();
    const currTime = new Date(sorted[i].detected_at).getTime();
    const diffMinutes = (currTime - prevTime) / (1000 * 60);

    if (diffMinutes <= windowMinutes) {
      currentCluster.push(sorted[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [sorted[i]];
    }
  }
  clusters.push(currentCluster);

  return clusters;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('[signal-correlator] Starting correlation run');

    // ── Step 1: Query active signals from the last 60 minutes ─────────
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentSignals, error: signalsError } = await supabase
      .from('operational_signals')
      .select('*')
      .eq('is_active', true)
      .gte('detected_at', sixtyMinutesAgo)
      .order('detected_at', { ascending: true });

    if (signalsError) {
      console.error('[signal-correlator] Error fetching signals:', signalsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch signals' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signals = (recentSignals || []) as OperationalSignal[];
    console.log(`[signal-correlator] Found ${signals.length} active signals in last 60 minutes`);

    if (signals.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        correlated_events: [],
        signals_analyzed: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Annotate each signal with its inferred category ───────
    const annotatedSignals = signals.map(s => ({
      ...s,
      category: inferCategory(s.signal_type, (s.signal_data as Record<string, unknown>) || {}),
    }));

    // ── Step 3: Group by user_id (and organization_id if available) ───
    // We use user_id as the primary grouping key since organization_id
    // may not always be set. Signals from the same user represent
    // the same operational context.
    const groupKey = (s: OperationalSignal) =>
      `${s.user_id}::${s.organization_id || 'no-org'}`;

    const groups = new Map<string, Array<OperationalSignal & { category: string }>>();
    for (const signal of annotatedSignals) {
      const key = groupKey(signal);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(signal);
    }

    // ── Step 4: For each group, cluster by 30-min window ─────────────
    const correlatedEvents: CorrelatedEvent[] = [];

    for (const [, groupSignals] of groups) {
      const clusters = clusterByTimeWindow(groupSignals, 30);

      for (const cluster of clusters) {
        // Only correlate clusters with signals from 2+ different integrations
        const uniqueIntegrations = [...new Set(cluster.map(s => s.source_integration))];
        if (uniqueIntegrations.length < 2) continue;

        // Only correlate clusters with signals from 2+ different categories
        const uniqueCategories = [...new Set(cluster.map(s => s.category))];
        if (uniqueCategories.length < 2) continue;

        // Build the correlated event
        const timestamps = cluster.map(s => new Date(s.detected_at).getTime());
        const severities = cluster.map(s => s.severity);

        const event: CorrelatedEvent = {
          correlation_id: crypto.randomUUID(),
          organization_id: cluster[0].organization_id,
          user_id: cluster[0].user_id,
          signal_ids: cluster.map(s => s.id),
          integrations_involved: uniqueIntegrations,
          operational_categories: uniqueCategories,
          time_window_start: new Date(Math.min(...timestamps)).toISOString(),
          time_window_end: new Date(Math.max(...timestamps)).toISOString(),
          combined_severity: computeCombinedSeverity(severities),
          signals: cluster.map(s => ({
            id: s.id,
            signal_type: s.signal_type,
            severity: s.severity,
            source_integration: s.source_integration,
            category: s.category,
            description: s.description,
          })),
        };

        correlatedEvents.push(event);
        console.log(
          `[signal-correlator] Correlated event: ${event.correlation_id} ` +
          `(${uniqueIntegrations.join(', ')}) ` +
          `[${uniqueCategories.join(', ')}] ` +
          `severity=${event.combined_severity} ` +
          `signals=${cluster.length}`
        );
      }
    }

    // ── Step 5: Return correlated events ───────────────────────────────
    // Correlated events are returned in the response body rather than
    // stored in a DB table. The operational-brief-generate function
    // invokes signal-correlator directly to retrieve fresh data,
    // avoiding FK constraints on integration_ingestion_state.

    const duration = Date.now() - startTime;
    console.log(
      `[signal-correlator] Complete in ${duration}ms: ` +
      `${signals.length} signals analyzed, ${correlatedEvents.length} correlated events`
    );

    return new Response(JSON.stringify({
      success: true,
      signals_analyzed: signals.length,
      correlated_events: correlatedEvents.length,
      events: correlatedEvents,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[signal-correlator] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
