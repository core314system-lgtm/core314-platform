
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { dispatchAlert, getChannelForSeverity } from '../_shared/alert-dispatcher.ts';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AnomalyRecord {
  id: string;
  event_type: string;
  event_source: string;
  event_payload: Record<string, unknown>;
  stability_score: number | null;
  reinforcement_delta: number | null;
  anomaly_flag: boolean;
  anomaly_reason: string | null;
  created_at: string;
}

interface AlertRecord {
  anomaly_id: string;
  event_type: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  message: string;
  channel: 'slack' | 'email' | 'system';
}

/**
 * Determine severity based on anomaly characteristics
 */
function calculateSeverity(anomaly: AnomalyRecord): 'low' | 'moderate' | 'high' | 'critical' {
  const payload = anomaly.event_payload || {};
  
  const stabilityVariance = payload.stability_variance as number | undefined;
  const instabilityProb = payload.instability_probability as number | undefined;
  const reinforcementRate = payload.reinforcement_rate as number | undefined;
  
  if (
    (stabilityVariance && stabilityVariance > 0.30) ||
    (instabilityProb && instabilityProb > 0.50) ||
    (reinforcementRate && reinforcementRate > 150)
  ) {
    return 'critical';
  }
  
  if (
    (stabilityVariance && stabilityVariance > 0.25) ||
    (instabilityProb && instabilityProb > 0.40) ||
    (reinforcementRate && reinforcementRate > 120)
  ) {
    return 'high';
  }
  
  if (
    (stabilityVariance && stabilityVariance > 0.20) ||
    (instabilityProb && instabilityProb > 0.30)
  ) {
    return 'moderate';
  }
  
  return 'low';
}

/**
 * Generate human-readable alert message
 */
function generateAlertMessage(anomaly: AnomalyRecord, severity: string): string {
  const payload = anomaly.event_payload || {};
  const reason = anomaly.anomaly_reason || 'Unknown anomaly';
  
  const stabilityVariance = payload.stability_variance as number | undefined;
  const instabilityProb = payload.instability_probability as number | undefined;
  const reinforcementRate = payload.reinforcement_rate as number | undefined;
  
  let message = `${reason} detected in ${anomaly.event_source}. `;
  
  if (stabilityVariance) {
    message += `Stability variance: ${(stabilityVariance * 100).toFixed(1)}%. `;
  }
  
  if (instabilityProb) {
    message += `Instability probability: ${(instabilityProb * 100).toFixed(1)}%. `;
  }
  
  if (reinforcementRate) {
    message += `Reinforcement rate: ${reinforcementRate}/hour. `;
  }
  
  if (severity === 'critical') {
    message += 'IMMEDIATE ATTENTION REQUIRED.';
  } else if (severity === 'high') {
    message += 'Review recommended.';
  }
  
  return message.trim();
}

/**
 * Detect clustered anomalies (multiple anomaly types within 15 min window)
 */
async function detectClusteredAnomalies(): Promise<AnomalyRecord[]> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: recentAnomalies, error } = await supabase
    .from('fusion_audit_log')
    .select('*')
    .eq('anomaly_flag', true)
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Alert Engine] Error fetching recent anomalies:', error);
    return [];
  }
  
  const eventTypeGroups = new Map<string, AnomalyRecord[]>();
  
  for (const anomaly of (recentAnomalies || [])) {
    const eventType = anomaly.event_type;
    if (!eventTypeGroups.has(eventType)) {
      eventTypeGroups.set(eventType, []);
    }
    eventTypeGroups.get(eventType)!.push(anomaly as AnomalyRecord);
  }
  
  if (eventTypeGroups.size >= 3) {
    console.log(`[Alert Engine] Clustered anomaly detected: ${eventTypeGroups.size} event types`);
    return recentAnomalies as AnomalyRecord[];
  }
  
  return [];
}

/**
 * Check if alert already exists for this anomaly
 */
async function alertExists(anomalyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('fusion_alerts')
    .select('id')
    .eq('anomaly_id', anomalyId)
    .limit(1);
  
  if (error) {
    console.error('[Alert Engine] Error checking existing alert:', error);
    return false;
  }
  
  return (data?.length || 0) > 0;
}

/**
 * Main alert processing function
 */
serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    console.log('[Alert Engine] Starting alert generation process');
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: anomalies, error: fetchError } = await supabase
      .from('v_fusion_anomalies')
      .select('*')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      throw new Error(`Failed to fetch anomalies: ${fetchError.message}`);
    }
    
    if (!anomalies || anomalies.length === 0) {
      console.log('[Alert Engine] No recent anomalies found');
      return new Response(
        JSON.stringify({ status: 'success', alerts_generated: 0, message: 'No anomalies to process' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Alert Engine] Processing ${anomalies.length} anomalies`);
    
    const clusteredAnomalies = await detectClusteredAnomalies();
    const isCluster = clusteredAnomalies.length > 0;
    
    const alertsToCreate: AlertRecord[] = [];
    const alertsToDispatch: Array<{ alert: AlertRecord; metadata: Record<string, unknown> }> = [];
    
    for (const anomaly of anomalies as AnomalyRecord[]) {
      if (await alertExists(anomaly.id)) {
        console.log(`[Alert Engine] Alert already exists for anomaly ${anomaly.id}`);
        continue;
      }
      
      let severity = calculateSeverity(anomaly);
      
      if (isCluster && severity !== 'critical') {
        console.log(`[Alert Engine] Upgrading severity to critical due to anomaly clustering`);
        severity = 'critical';
      }
      
      const message = generateAlertMessage(anomaly, severity);
      
      const channel = getChannelForSeverity(severity);
      
      const alertRecord: AlertRecord = {
        anomaly_id: anomaly.id,
        event_type: anomaly.event_type,
        severity,
        message,
        channel,
      };
      
      alertsToCreate.push(alertRecord);
      alertsToDispatch.push({
        alert: alertRecord,
        metadata: {
          event_source: anomaly.event_source,
          stability_score: anomaly.stability_score,
          reinforcement_delta: anomaly.reinforcement_delta,
          is_clustered: isCluster,
        },
      });
    }
    
    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('fusion_alerts')
        .insert(alertsToCreate);
      
      if (insertError) {
        console.error('[Alert Engine] Error inserting alerts:', insertError);
        throw new Error(`Failed to insert alerts: ${insertError.message}`);
      }
      
      console.log(`[Alert Engine] Created ${alertsToCreate.length} alert records`);
    }
    
    const dispatchResults = [];
    for (const { alert, metadata } of alertsToDispatch) {
      const result = await dispatchAlert({
        event_type: alert.event_type,
        severity: alert.severity,
        message: alert.message,
        channel: alert.channel,
        metadata,
      });
      
      dispatchResults.push(result);
      
      if (result.success) {
        await supabase
          .from('fusion_alerts')
          .update({ dispatched: true })
          .eq('anomaly_id', alert.anomaly_id);
      }
    }
    
    const successfulDispatches = dispatchResults.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        status: 'success',
        alerts_generated: alertsToCreate.length,
        alerts_dispatched: successfulDispatches,
        clustered_anomaly_detected: isCluster,
        alerts: alertsToCreate.map((alert, idx) => ({
          ...alert,
          dispatched: dispatchResults[idx]?.success || false,
        })),
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
    
  } catch (error) {
    console.error('[Alert Engine] Error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
}, { name: "fusion-alert-engine" }));