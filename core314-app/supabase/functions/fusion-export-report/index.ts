import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { format = 'csv', integration } = await req.json();

    const { data: visualData, error: visualError } = await supabase
      .from('fusion_visual_cache')
      .select('*')
      .eq('integration_name', integration || 'all')
      .eq('data_type', 'complete_visualization')
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (visualError) throw visualError;
    
    if (!visualData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No visualization data available. Please refresh the data first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (format === 'csv') {
      const csvLines = [
        'Date,Fusion Score,Variance,Type',
        ...(visualData.data.timeline || []).map((item: { date: string; fusion_score: number; variance: number }) => 
          `${item.date},${item.fusion_score},${item.variance},timeline`
        ),
        '',
        'Date,Predicted Score,Confidence Low,Confidence High',
        ...(visualData.data.forecasts || []).map((item: { date: string; predicted_score: number; confidence_low: number; confidence_high: number }) => 
          `${item.date},${item.predicted_score},${item.confidence_low},${item.confidence_high}`
        ),
        '',
        'Date,Severity,Type,Message',
        ...(visualData.data.anomalies || []).map((item: { date: string; severity: string; type: string; message?: string }) => 
          `${item.date},${item.severity},${item.type},"${item.message || ''}"`
        ),
        '',
        'Timestamp,Rule,Result,Integration',
        ...(visualData.data.actions || []).map((item: { timestamp: string; rule: string; result: string; integration: string }) => 
          `${item.timestamp},${item.rule},${item.result},${item.integration}`
        )
      ];

      return new Response(csvLines.join('\n'), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="core314_intelligence_report_${new Date().toISOString().split('T')[0]}.csv"`
        },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'PDF export not yet implemented'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "fusion-export-report" }));