/**
 * Core314 CFFE Reinforcement Sync
 * =================================
 * Phase 28: Integrates adaptive calibration recommendations directly into
 * the private Core Fusion Feedback Engine (CFFE) for live parameter tuning.
 * 
 * This function:
 * - Calls adaptive-reinforcement-calibration to get recommendations
 * - Parses calibration data (variance, recommendations)
 * - Applies reinforcement tuning to the private CFFE module
 * - Enables live parameter adjustment based on variance data
 * 
 * Secure internal sync function - does not expose CFFE internals.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { applyReinforcement } from '../_private/core-fusion-feedback-engine.ts';
import { logAuditEvent } from '../_shared/audit-logger.ts';

interface CalibrationResult {
  event_type: string;
  baseline_stability: number;
  current_stability: number;
  variance: number;
  recommendation: string;
  sample_count: number;
}

interface CalibrationResponse {
  status: string;
  calibrations: CalibrationResult[];
  timestamp: string;
}

interface SyncAction {
  event_type: string;
  recommendation: string;
  variance: number;
}

interface SyncResponse {
  status: string;
  actions_applied: SyncAction[];
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalToken = req.headers.get('X-Internal-Token');
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      console.warn('[CFFE SYNC] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[CFFE SYNC] Starting Reinforcement Sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const calibrationUrl = `${supabaseUrl}/functions/v1/adaptive-reinforcement-calibration`;
    
    const authHeader = req.headers.get('Authorization');
    
    console.log('[CFFE SYNC] Fetching adaptive calibration data...');
    
    const calibrationResponse = await fetch(calibrationUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'X-Internal-Token': expectedToken!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!calibrationResponse.ok) {
      console.error('[CFFE SYNC] Failed to fetch calibration data:', calibrationResponse.status);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch calibration data',
          status: calibrationResponse.status 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const calibrationData: CalibrationResponse = await calibrationResponse.json();
    
    if (calibrationData.status !== 'success' || !calibrationData.calibrations || calibrationData.calibrations.length === 0) {
      console.warn('[CFFE SYNC] No calibration data available');
      return new Response(
        JSON.stringify({
          status: 'success',
          actions_applied: [],
          timestamp: new Date().toISOString(),
          message: 'No calibration data available for sync'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[CFFE SYNC] Calibration data retrieved: ${calibrationData.calibrations.length} event types`);

    const actionsApplied: SyncAction[] = [];

    for (const calibration of calibrationData.calibrations) {
      const { event_type, variance, recommendation } = calibration;
      
      console.log(
        `[CFFE SYNC] ${event_type} → ${recommendation} (Δ ${variance.toFixed(3)})`
      );

      try {
        await applyReinforcement(event_type, recommendation);
        
        actionsApplied.push({
          event_type,
          recommendation,
          variance
        });
      } catch (error) {
        console.error(`[CFFE SYNC] Error applying reinforcement for ${event_type}:`, error.message);
      }
    }

    console.log(`[CFFE SYNC] Reinforcement Sync Complete. ${actionsApplied.length} event types processed.`);

    const response: SyncResponse = {
      status: 'success',
      actions_applied: actionsApplied,
      timestamp: new Date().toISOString()
    };

    const avgVariance = actionsApplied.length > 0
      ? actionsApplied.reduce((sum, a) => sum + Math.abs(a.variance), 0) / actionsApplied.length
      : 0;

    await logAuditEvent({
      event_type: 'cffe_sync',
      event_source: 'cffe-reinforcement-sync',
      event_payload: {
        actions_count: actionsApplied.length,
        actions: actionsApplied.map(a => ({
          event_type: a.event_type,
          recommendation: a.recommendation,
          variance: a.variance
        }))
      },
      reinforcement_delta: avgVariance,
    });

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[CFFE SYNC] Unexpected error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
