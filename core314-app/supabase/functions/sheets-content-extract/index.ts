/**
 * Google Sheets Content Extraction
 *
 * Extracts spreadsheet metadata and cell data from Google Sheets
 * connected via OAuth. Stores extracted content in integration_documents
 * for full-text search and content-based signal detection.
 *
 * Triggered by content-extraction-scheduler after polling completes.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  type DocumentUpsert,
  type ExtractionResult,
  buildPreview,
  estimateBytes,
  upsertDocuments,
  updateStorageUsage,
  checkContentQuota,
} from '../_shared/content-extraction.ts';
import { resolveUserPlan } from '../_shared/integration-limits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Accept optional body filter
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id ?? null;
    } catch { /* no body — process all */ }

    // Find all Google Sheets integrations with OAuth tokens
    const query = supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'google_sheets');

    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: integrations } = await query;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Google Sheets integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const allResults: ExtractionResult[] = [];
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        // Check quota before extracting
        const plan = await resolveUserPlan(supabase, integration.user_id);
        const quota = await checkContentQuota(supabase, integration.user_id, plan);
        if (!quota.allowed) {
          console.log('[sheets-content-extract] Quota exceeded for user:', integration.user_id, quota.reason);
          errors.push(`Quota exceeded for user ${integration.user_id}: ${quota.reason}`);
          continue;
        }

        // Get access token
        const { data: accessToken } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!accessToken) {
          errors.push(`No access token for user ${integration.user_id}`);
          continue;
        }

        // Google Sheets API: list spreadsheets via Drive API
        const driveResponse = await fetch(
          'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'files(id,name,modifiedTime,createdTime,webViewLink,owners)',
            pageSize: '50',
            orderBy: 'modifiedTime desc',
          }),
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          },
        );

        if (!driveResponse.ok) {
          const errText = await driveResponse.text().catch(() => '');
          errors.push(`Drive API error for user ${integration.user_id}: ${driveResponse.status} ${errText.slice(0, 200)}`);
          continue;
        }

        const driveData = await driveResponse.json();
        const files = driveData.files || [];

        console.log('[sheets-content-extract] Found spreadsheets', {
          user_id: integration.user_id,
          count: files.length,
        });

        const documents: DocumentUpsert[] = [];

        // For each spreadsheet, fetch sheet metadata + first sheet preview
        for (const file of files.slice(0, 25)) {
          try {
            // Fetch spreadsheet metadata
            const sheetResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=properties,sheets.properties`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } },
            );

            let sheetNames: string[] = [];
            let totalSheets = 0;

            if (sheetResponse.ok) {
              const sheetData = await sheetResponse.json();
              const sheets = sheetData.sheets || [];
              totalSheets = sheets.length;
              sheetNames = sheets.map((s: { properties: { title: string } }) => s.properties.title);
            }

            // Fetch first sheet cell data (A1:Z50 — preview)
            let cellContent = '';
            let cellJson: Record<string, unknown> | null = null;

            if (sheetNames.length > 0) {
              const firstSheet = encodeURIComponent(sheetNames[0]);
              const valuesResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${firstSheet}!A1:Z50`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } },
              );

              if (valuesResponse.ok) {
                const valuesData = await valuesResponse.json();
                const rows = valuesData.values || [];
                cellJson = { sheet_name: sheetNames[0], rows: rows.slice(0, 50) };

                // Build text representation for search
                cellContent = rows
                  .map((row: string[]) => row.join('\t'))
                  .join('\n');
              }
            }

            const fullContent = `Spreadsheet: ${file.name}\nSheets: ${sheetNames.join(', ')}\n\n${cellContent}`;

            documents.push({
              user_id: integration.user_id,
              organization_id: null,
              user_integration_id: integration.user_integration_id,
              service_name: 'google_sheets',
              source_type: 'spreadsheet',
              external_id: file.id,
              external_url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
              parent_external_id: null,
              title: file.name || 'Untitled Spreadsheet',
              description: `Google Sheets spreadsheet with ${totalSheets} sheet(s): ${sheetNames.join(', ')}`,
              content_text: fullContent,
              content_json: cellJson,
              content_preview: buildPreview(fullContent),
              mime_type: 'application/vnd.google-apps.spreadsheet',
              file_size_bytes: estimateBytes(fullContent),
              source_created_at: file.createdTime || null,
              source_modified_at: file.modifiedTime || null,
              extraction_status: 'complete',
              extraction_error: null,
              metadata: {
                total_sheets: totalSheets,
                sheet_names: sheetNames,
                owner: file.owners?.[0]?.displayName || null,
              },
            });
          } catch (fileErr) {
            console.warn('[sheets-content-extract] Error extracting file:', file.id, fileErr);
            errors.push(`File ${file.id}: ${(fileErr as Error).message}`);
          }
        }

        // Upsert extracted documents
        if (documents.length > 0) {
          const result = await upsertDocuments(supabase, documents);
          allResults.push(result);
          console.log('[sheets-content-extract] Upserted documents', {
            user_id: integration.user_id,
            upserted: result.documentsUpserted,
            skipped: result.documentsSkipped,
          });
        }

        // Recalculate storage usage
        await updateStorageUsage(supabase, integration.user_id);
        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    const totalUpserted = allResults.reduce((sum, r) => sum + r.documentsUpserted, 0);
    const totalSkipped = allResults.reduce((sum, r) => sum + r.documentsSkipped, 0);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      documents_upserted: totalUpserted,
      documents_skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sheets-content-extract] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
