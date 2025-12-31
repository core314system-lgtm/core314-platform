
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalibrationResult {
  events_processed: number;
  avg_fusion_score: number;
  amplify_count: number;
  tune_down_count: number;
  monitor_count: number;
}

interface CalibrationSummary {
  success: boolean;
  timestamp: string;
  result: CalibrationResult | null;
  recent_events: any[];
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

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

    console.log('Fusion Calibration Engine: Starting calibration run...');

    const { data: calibrationData, error: calibrationError } = await supabase
      .rpc('fusion_calibration_engine');

    if (calibrationError) {
      console.error('Calibration engine error:', calibrationError);
      throw new Error(`Calibration failed: ${calibrationError.message}`);
    }

    console.log('Calibration result:', calibrationData);

    const result: CalibrationResult = calibrationData && calibrationData.length > 0
      ? {
          events_processed: calibrationData[0].events_processed || 0,
          avg_fusion_score: parseFloat(calibrationData[0].avg_fusion_score || '0'),
          amplify_count: calibrationData[0].amplify_count || 0,
          tune_down_count: calibrationData[0].tune_down_count || 0,
          monitor_count: calibrationData[0].monitor_count || 0,
        }
      : {
          events_processed: 0,
          avg_fusion_score: 0,
          amplify_count: 0,
          tune_down_count: 0,
          monitor_count: 0,
        };

    const { data: recentEvents, error: eventsError } = await supabase
      .from('fusion_calibration_events')
      .select(`
        id,
        fusion_score,
        calibration_action,
        confidence_level,
        notes,
        created_at,
        optimization_event_id,
        behavioral_event_id,
        prediction_event_id
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error('Error fetching recent events:', eventsError);
    }

    const summary: CalibrationSummary = {
      success: true,
      timestamp: new Date().toISOString(),
      result,
      recent_events: recentEvents || [],
    };

    console.log('Fusion Calibration Engine: Completed successfully');
    console.log(`Processed: ${result.events_processed}, Avg Score: ${result.avg_fusion_score}`);
    console.log(`Actions - Amplify: ${result.amplify_count}, Tune-Down: ${result.tune_down_count}, Monitor: ${result.monitor_count}`);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Fusion Calibration Engine error:', error);

    const errorSummary: CalibrationSummary = {
      success: false,
      timestamp: new Date().toISOString(),
      result: null,
      recent_events: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(
      JSON.stringify(errorSummary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}, { name: "fusion-calibration-engine" }));