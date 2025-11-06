import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OversightResult {
  audit_entries_created: number;
  anomalies_detected: number;
  high_impact_decisions: number;
  avg_confidence: number;
}

interface AuditLogEntry {
  id: string;
  fusion_event_id: string | null;
  action_type: string;
  decision_summary: string;
  confidence_level: number;
  system_context: Record<string, any> | null;
  decision_impact: string | null;
  anomaly_detected: boolean;
  triggered_by: string;
  created_at: string;
}

interface OversightSummary {
  success: boolean;
  timestamp: string;
  result: OversightResult | null;
  recent_audit_entries: AuditLogEntry[];
  anomalies: AuditLogEntry[];
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Executing fusion_oversight_engine()...');

    const { data: oversightData, error: oversightError } = await supabase
      .rpc('fusion_oversight_engine');

    if (oversightError) {
      console.error('Error executing oversight engine:', oversightError);
      throw oversightError;
    }

    console.log('Oversight engine result:', oversightData);

    const result: OversightResult = oversightData && oversightData.length > 0
      ? {
          audit_entries_created: oversightData[0].audit_entries_created || 0,
          anomalies_detected: oversightData[0].anomalies_detected || 0,
          high_impact_decisions: oversightData[0].high_impact_decisions || 0,
          avg_confidence: oversightData[0].avg_confidence || 0,
        }
      : {
          audit_entries_created: 0,
          anomalies_detected: 0,
          high_impact_decisions: 0,
          avg_confidence: 0,
        };

    const { data: recentAuditEntries, error: auditError } = await supabase
      .from('fusion_audit_log')
      .select(`
        id,
        fusion_event_id,
        action_type,
        decision_summary,
        confidence_level,
        system_context,
        decision_impact,
        anomaly_detected,
        triggered_by,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (auditError) {
      console.error('Error fetching recent audit entries:', auditError);
      throw auditError;
    }

    const { data: anomalies, error: anomaliesError } = await supabase
      .from('fusion_audit_log')
      .select(`
        id,
        fusion_event_id,
        action_type,
        decision_summary,
        confidence_level,
        system_context,
        decision_impact,
        anomaly_detected,
        triggered_by,
        created_at
      `)
      .eq('anomaly_detected', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (anomaliesError) {
      console.error('Error fetching anomalies:', anomaliesError);
      throw anomaliesError;
    }

    const summary: OversightSummary = {
      success: true,
      timestamp: new Date().toISOString(),
      result,
      recent_audit_entries: recentAuditEntries || [],
      anomalies: anomalies || [],
    };

    console.log('Oversight summary:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Fusion Oversight Engine error:', error);

    const errorSummary: OversightSummary = {
      success: false,
      timestamp: new Date().toISOString(),
      result: null,
      recent_audit_entries: [],
      anomalies: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(JSON.stringify(errorSummary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
