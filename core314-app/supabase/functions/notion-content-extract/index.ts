/**
 * Notion Content Extraction
 *
 * Extracts page content (text blocks, headings, lists, etc.) from Notion
 * connected via OAuth. Converts Notion blocks to plain text / markdown
 * and stores in integration_documents for full-text search.
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

/** Convert Notion rich text array to plain text. */
function richTextToPlain(richText: Array<{ plain_text: string }> | undefined): string {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text).join('');
}

/** Convert Notion blocks to markdown-ish plain text. */
function blocksToText(blocks: Array<Record<string, unknown>>): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const type = block.type as string;
    const data = block[type] as Record<string, unknown> | undefined;
    if (!data) continue;

    const text = richTextToPlain(data.rich_text as Array<{ plain_text: string }> | undefined);

    switch (type) {
      case 'paragraph':
        if (text) lines.push(text);
        break;
      case 'heading_1':
        lines.push(`# ${text}`);
        break;
      case 'heading_2':
        lines.push(`## ${text}`);
        break;
      case 'heading_3':
        lines.push(`### ${text}`);
        break;
      case 'bulleted_list_item':
        lines.push(`- ${text}`);
        break;
      case 'numbered_list_item':
        lines.push(`1. ${text}`);
        break;
      case 'to_do': {
        const checked = data.checked ? '[x]' : '[ ]';
        lines.push(`${checked} ${text}`);
        break;
      }
      case 'toggle':
        lines.push(`> ${text}`);
        break;
      case 'quote':
        lines.push(`> ${text}`);
        break;
      case 'callout':
        lines.push(`> ${text}`);
        break;
      case 'code':
        lines.push('```\n' + text + '\n```');
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'table_row': {
        const cells = data.cells as Array<Array<{ plain_text: string }>> | undefined;
        if (cells) {
          lines.push('| ' + cells.map(c => richTextToPlain(c)).join(' | ') + ' |');
        }
        break;
      }
      default:
        if (text) lines.push(text);
    }
  }

  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id ?? null;
    } catch { /* no body */ }

    const query = supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'notion');

    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: integrations } = await query;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Notion integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const allResults: ExtractionResult[] = [];
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        // Check quota
        const plan = await resolveUserPlan(supabase, integration.user_id);
        const quota = await checkContentQuota(supabase, integration.user_id, plan);
        if (!quota.allowed) {
          errors.push(`Quota exceeded for user ${integration.user_id}: ${quota.reason}`);
          continue;
        }

        // Get access token
        const { data: tokenJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!tokenJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let accessToken: string;
        try {
          const parsed = JSON.parse(tokenJson);
          accessToken = parsed.access_token || parsed.api_token || tokenJson;
        } catch {
          accessToken = tokenJson;
        }

        const notionHeaders = {
          'Authorization': `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        // Search for recently edited pages
        const pagesResponse = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            filter: { property: 'object', value: 'page' },
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 50,
          }),
        });

        if (!pagesResponse.ok) {
          const errText = await pagesResponse.text().catch(() => '');
          errors.push(`Notion API error for user ${integration.user_id}: ${pagesResponse.status} ${errText.slice(0, 200)}`);
          continue;
        }

        const pagesData = await pagesResponse.json();
        const pages = pagesData.results || [];

        console.log('[notion-content-extract] Found pages', {
          user_id: integration.user_id,
          count: pages.length,
        });

        const documents: DocumentUpsert[] = [];

        for (const page of pages.slice(0, 30)) {
          try {
            // Extract page title
            const titleProp = (page.properties?.title || page.properties?.Name || page.properties?.name) as {
              title?: Array<{ plain_text: string }>;
            } | undefined;
            const title = richTextToPlain(titleProp?.title) || 'Untitled';

            // Fetch page blocks (content)
            const blocksResponse = await fetch(
              `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`,
              { headers: notionHeaders },
            );

            let contentText = '';
            let blockCount = 0;

            if (blocksResponse.ok) {
              const blocksData = await blocksResponse.json();
              const blocks = blocksData.results || [];
              blockCount = blocks.length;
              contentText = blocksToText(blocks);
            }

            const fullContent = `Page: ${title}\n\n${contentText}`;
            const pageUrl = page.url || `https://notion.so/${page.id.replace(/-/g, '')}`;

            // Determine parent info
            let parentId: string | null = null;
            if (page.parent?.type === 'database_id') {
              parentId = page.parent.database_id;
            } else if (page.parent?.type === 'page_id') {
              parentId = page.parent.page_id;
            }

            documents.push({
              user_id: integration.user_id,
              organization_id: null,
              user_integration_id: integration.user_integration_id,
              service_name: 'notion',
              source_type: 'page',
              external_id: page.id,
              external_url: pageUrl,
              parent_external_id: parentId,
              title,
              description: `Notion page with ${blockCount} content blocks`,
              content_text: fullContent,
              content_json: null, // Raw blocks too large; text is sufficient
              content_preview: buildPreview(fullContent),
              mime_type: 'application/vnd.notion.page',
              file_size_bytes: estimateBytes(fullContent),
              source_created_at: page.created_time || null,
              source_modified_at: page.last_edited_time || null,
              extraction_status: 'complete',
              extraction_error: null,
              metadata: {
                block_count: blockCount,
                parent_type: page.parent?.type || null,
                parent_id: parentId,
                last_edited_by: page.last_edited_by?.id || null,
              },
            });
          } catch (pageErr) {
            errors.push(`Page ${page.id}: ${(pageErr as Error).message}`);
          }
        }

        // Also extract databases as documents
        const dbResponse = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            filter: { property: 'object', value: 'database' },
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 20,
          }),
        });

        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          const databases = dbData.results || [];

          for (const db of databases.slice(0, 10)) {
            const dbTitleParts = (db.title || []) as Array<{ plain_text: string }>;
            const dbTitle = richTextToPlain(dbTitleParts) || 'Untitled Database';
            const descParts = (db.description || []) as Array<{ plain_text: string }>;
            const dbDesc = richTextToPlain(descParts);

            // List property names as content
            const properties = db.properties || {};
            const propNames = Object.keys(properties);
            const propContent = propNames.map(name => {
              const prop = properties[name] as Record<string, unknown>;
              return `- ${name} (${prop.type})`;
            }).join('\n');

            const fullContent = `Database: ${dbTitle}\n${dbDesc ? `Description: ${dbDesc}\n` : ''}\nProperties:\n${propContent}`;

            documents.push({
              user_id: integration.user_id,
              organization_id: null,
              user_integration_id: integration.user_integration_id,
              service_name: 'notion',
              source_type: 'database',
              external_id: db.id,
              external_url: db.url || `https://notion.so/${db.id.replace(/-/g, '')}`,
              parent_external_id: null,
              title: dbTitle,
              description: dbDesc || `Notion database with ${propNames.length} properties`,
              content_text: fullContent,
              content_json: { properties: propNames },
              content_preview: buildPreview(fullContent),
              mime_type: 'application/vnd.notion.database',
              file_size_bytes: estimateBytes(fullContent),
              source_created_at: db.created_time || null,
              source_modified_at: db.last_edited_time || null,
              extraction_status: 'complete',
              extraction_error: null,
              metadata: {
                property_count: propNames.length,
                property_names: propNames,
              },
            });
          }
        }

        if (documents.length > 0) {
          const result = await upsertDocuments(supabase, documents);
          allResults.push(result);
          console.log('[notion-content-extract] Upserted documents', {
            user_id: integration.user_id,
            upserted: result.documentsUpserted,
            skipped: result.documentsSkipped,
          });
        }

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
    console.error('[notion-content-extract] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
