import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const ALPHA = 0.3;
const BETA = 0.5;
const GAMMA = 0.2;

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  const startTime = Date.now();
  
  try {
    const { userId, integrationId, eventType = 'scheduled_recalibration' } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: metrics } = await supabase
      .from('fusion_metrics')
      .select('id, metric_name, normalized_value, weight')
      .eq('user_id', userId)
      .eq('integration_id', integrationId);

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ error: 'No metrics found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: history } = await supabase
      .from('fusion_score_history')
      .select('fusion_score')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .order('recorded_at', { ascending: false })
      .limit(30);

    let variance = 0.5;
    if (history && history.length >= 2) {
      const values = history.map(h => h.fusion_score);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const varianceRaw = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(varianceRaw);
      const cv = mean > 0 ? stdDev / mean : 0;
      variance = Math.min(cv, 1.0);
    }

    const ai_confidence = Math.max(0, Math.min(1, 1 - variance));

    const calculations = metrics.map(metric => {
      const base_weight = metric.weight || 1.0;
      const correlation_penalty = 0;
      
      const raw_weight = base_weight * (
        1 + ALPHA * variance + BETA * ai_confidence - GAMMA * correlation_penalty
      );
      
      return {
        metric_id: metric.id,
        raw_weight,
        variance,
        ai_confidence
      };
    });

    const totalWeight = calculations.reduce((sum, c) => sum + c.raw_weight, 0);
    
    const weightChanges: Record<string, { old: number; new: number }> = {};
    
    for (const calc of calculations) {
      const final_weight = totalWeight > 0 ? calc.raw_weight / totalWeight : 1.0 / metrics.length;
      
      const metric = metrics.find(m => m.id === calc.metric_id);
      const metricName = metric?.metric_name || 'unknown';
      
      const { data: existing } = await supabase
        .from('fusion_weightings')
        .select('final_weight')
        .eq('user_id', userId)
        .eq('integration_id', integrationId)
        .eq('metric_id', calc.metric_id)
        .single();

      if (existing) {
        weightChanges[metricName] = {
          old: existing.final_weight,
          new: final_weight
        };
      }
      
      await supabase
        .from('fusion_weightings')
        .upsert({
          user_id: userId,
          integration_id: integrationId,
          metric_id: calc.metric_id,
          metric_name: metricName,
          final_weight,
          variance: calc.variance,
          ai_confidence: calc.ai_confidence,
          correlation_penalty: 0,
          adjustment_reason: eventType === 'manual_recalibration' ? 'Manual recalibration' : 'Automated recalibration',
          adaptive: true
        });
    }

    await supabase
      .from('fusion_audit_log')
      .insert({
        user_id: userId,
        integration_id: integrationId,
        event_type: eventType,
        metrics_count: metrics.length,
        total_variance: variance,
        avg_ai_confidence: ai_confidence,
        weight_changes: weightChanges,
        triggered_by: eventType === 'manual_recalibration' ? 'user' : 'system',
        execution_time_ms: Date.now() - startTime,
        status: 'success'
      });

    return new Response(JSON.stringify({ 
      success: true,
      variance,
      ai_confidence,
      metricsCount: metrics.length
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const body = await req.json().catch(() => ({}));
    if (body.userId && body.integrationId) {
      await supabase
        .from('fusion_audit_log')
        .insert({
          user_id: body.userId,
          integration_id: body.integrationId,
          event_type: body.eventType || 'scheduled_recalibration',
          metrics_count: 0,
          triggered_by: 'system',
          execution_time_ms: Date.now() - startTime,
          status: 'failed',
          error_message: error.message
        });
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}), { name: "calculate-weights" }));