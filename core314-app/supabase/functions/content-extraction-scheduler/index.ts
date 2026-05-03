/**
 * Content Extraction Scheduler
 *
 * Orchestrates content extraction across all supported integrations.
 * Calls individual content extraction functions (sheets, jira, notion)
 * in sequence to extract document content for full-text search and
 * content-based signal detection.
 *
 * Designed to be invoked by pg_cron every 6 hours (content doesn't change
 * as frequently as operational metrics).
 *
 * Pipeline:
 *   pg_cron (every 6 hours) → content-extraction-scheduler
 *     → sheets-content-extract
 *     → jira-content-extract
 *     → notion-content-extract
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExtractorResult {
  name: string;
  success: boolean;
  processed?: number;
  documents_upserted?: number;
  documents_skipped?: number;
  error?: string;
  duration_ms: number;
}

async function invokeExtractor(functionName: string): Promise<ExtractorResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      name: functionName,
      success: false,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      duration_ms: 0,
    };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        triggered_by: 'content-extraction-scheduler',
        scheduled_at: new Date().toISOString(),
      }),
    });

    const duration_ms = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        name: functionName,
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        duration_ms,
      };
    }

    const data = await response.json();
    return {
      name: functionName,
      success: true,
      processed: data.processed || 0,
      documents_upserted: data.documents_upserted || 0,
      documents_skipped: data.documents_skipped || 0,
      duration_ms,
    };
  } catch (err) {
    return {
      name: functionName,
      success: false,
      error: (err as Error).message,
      duration_ms: Date.now() - startTime,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const overallStart = Date.now();

  console.log('[content-extraction-scheduler] Starting content extraction pipeline');

  // Run extractors sequentially to avoid overwhelming APIs
  const extractors = [
    'sheets-content-extract',
    'jira-content-extract',
    'notion-content-extract',
  ];

  const results: ExtractorResult[] = [];

  for (const extractorName of extractors) {
    console.log(`[content-extraction-scheduler] Invoking ${extractorName}`);
    const result = await invokeExtractor(extractorName);
    results.push(result);

    console.log(`[content-extraction-scheduler] ${extractorName} completed`, {
      success: result.success,
      processed: result.processed,
      documents_upserted: result.documents_upserted,
      duration_ms: result.duration_ms,
    });
  }

  const totalDuration = Date.now() - overallStart;
  const totalUpserted = results.reduce((sum, r) => sum + (r.documents_upserted || 0), 0);
  const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
  const failedExtractors = results.filter(r => !r.success);

  console.log('[content-extraction-scheduler] Pipeline complete', {
    total_duration_ms: totalDuration,
    total_processed: totalProcessed,
    total_documents_upserted: totalUpserted,
    failed_count: failedExtractors.length,
  });

  return new Response(JSON.stringify({
    success: failedExtractors.length === 0,
    total_duration_ms: totalDuration,
    total_processed: totalProcessed,
    total_documents_upserted: totalUpserted,
    results,
    errors: failedExtractors.length > 0
      ? failedExtractors.map(r => `${r.name}: ${r.error}`)
      : undefined,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
