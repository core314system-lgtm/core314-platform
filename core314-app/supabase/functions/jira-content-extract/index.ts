/**
 * Jira Content Extraction
 *
 * Extracts issue descriptions, comments, and attachment metadata from Jira
 * connected via OAuth or API key. Stores extracted content in integration_documents
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

/** Convert Atlassian Document Format (ADF) to plain text. */
function adfToText(adf: Record<string, unknown> | null | undefined): string {
  if (!adf) return '';
  try {
    const content = adf.content as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(content)) return '';
    return content.map(node => extractTextFromNode(node)).join('\n').trim();
  } catch {
    return '';
  }
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || '';
  const children = node.content as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(children)) return '';
  return children.map(child => extractTextFromNode(child)).join('');
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
        access_token_secret_id, refresh_token_secret_id, token_type, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'jira');

    if (targetUserId) query.eq('user_id', targetUserId);

    const { data: integrations } = await query;

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Jira integrations found', processed: 0 }), {
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

        // Determine auth method
        const tokenType = (integration as Record<string, unknown>).token_type as string | null;
        const isOAuth = tokenType === 'bearer' || tokenType === 'Bearer';

        let fetchHeaders: Record<string, string>;
        let baseUrl: string;

        if (isOAuth) {
          const { data: accessToken } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });
          if (!accessToken) { errors.push(`No access token for user ${integration.user_id}`); continue; }

          const { data: userInt } = await supabase
            .from('user_integrations')
            .select('config')
            .eq('id', integration.user_integration_id)
            .single();

          const cloudId = (userInt?.config as Record<string, unknown>)?.cloud_id as string | undefined;
          if (!cloudId) { errors.push(`No cloud_id for user ${integration.user_id}`); continue; }

          fetchHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };
          baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
        } else {
          const { data: credentialJson } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });
          if (!credentialJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

          let credentials: { domain: string; email: string; api_token: string };
          try { credentials = JSON.parse(credentialJson); } catch {
            errors.push(`Invalid credentials format for user ${integration.user_id}`); continue;
          }

          fetchHeaders = {
            'Authorization': `Basic ${btoa(`${credentials.email}:${credentials.api_token}`)}`,
            'Accept': 'application/json',
          };
          baseUrl = `https://${credentials.domain}`;
        }

        // Fetch recent issues with descriptions
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const jqlQuery = `updated >= "${weekAgo}" ORDER BY updated DESC`;

        const issuesResponse = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jql: jqlQuery,
            maxResults: 50,
            fields: ['summary', 'description', 'comment', 'attachment', 'status', 'priority',
                     'assignee', 'project', 'issuetype', 'updated', 'created'],
          }),
        });

        if (!issuesResponse.ok) {
          const errText = await issuesResponse.text().catch(() => '');
          errors.push(`Jira API error for user ${integration.user_id}: ${issuesResponse.status} ${errText.slice(0, 200)}`);
          continue;
        }

        const issuesData = await issuesResponse.json();
        const issues = issuesData.issues || [];

        console.log('[jira-content-extract] Found issues', {
          user_id: integration.user_id,
          count: issues.length,
        });

        const documents: DocumentUpsert[] = [];

        for (const issue of issues) {
          try {
            const fields = issue.fields || {};
            const summary = fields.summary || issue.key;
            const descriptionText = adfToText(fields.description);
            const projectName = fields.project?.name || 'Unknown';
            const statusName = fields.status?.name || 'Unknown';
            const assigneeName = fields.assignee?.displayName || 'Unassigned';

            // Build full content: summary + description + top comments
            let fullContent = `Issue: ${issue.key} - ${summary}\nProject: ${projectName}\nStatus: ${statusName}\nAssignee: ${assigneeName}\n\n`;
            if (descriptionText) {
              fullContent += `Description:\n${descriptionText}\n\n`;
            }

            // Include top 5 most recent comments
            const comments = fields.comment?.comments || [];
            if (comments.length > 0) {
              fullContent += 'Recent Comments:\n';
              for (const comment of comments.slice(-5)) {
                const author = comment.author?.displayName || 'Unknown';
                const commentText = adfToText(comment.body);
                if (commentText) {
                  fullContent += `  [${author}]: ${commentText}\n`;
                }
              }
            }

            // Attachments metadata
            const attachments = fields.attachment || [];
            const attachmentMeta = attachments.map((a: Record<string, unknown>) => ({
              filename: a.filename,
              size: a.size,
              mimeType: a.mimeType,
              created: a.created,
            }));

            const issueUrl = isOAuth
              ? `${baseUrl.replace('api.atlassian.com/ex/jira/', '')}/browse/${issue.key}`
              : `${baseUrl}/browse/${issue.key}`;

            documents.push({
              user_id: integration.user_id,
              organization_id: null,
              user_integration_id: integration.user_integration_id,
              service_name: 'jira',
              source_type: 'issue',
              external_id: issue.key,
              external_url: issueUrl,
              parent_external_id: projectName,
              title: `${issue.key}: ${summary}`,
              description: `${projectName} | ${statusName} | ${assigneeName}`,
              content_text: fullContent,
              content_json: {
                key: issue.key,
                summary,
                project: projectName,
                status: statusName,
                assignee: assigneeName,
                priority: fields.priority?.name || 'None',
                issue_type: fields.issuetype?.name || 'Unknown',
                comments_count: comments.length,
                attachments_count: attachments.length,
                attachment_metadata: attachmentMeta.slice(0, 10),
              },
              content_preview: buildPreview(fullContent),
              mime_type: 'application/vnd.atlassian.jira.issue',
              file_size_bytes: estimateBytes(fullContent),
              source_created_at: fields.created || null,
              source_modified_at: fields.updated || null,
              extraction_status: 'complete',
              extraction_error: null,
              metadata: {
                project_key: fields.project?.key || null,
                issue_type: fields.issuetype?.name || null,
                priority: fields.priority?.name || null,
              },
            });
          } catch (issueErr) {
            errors.push(`Issue ${issue.key}: ${(issueErr as Error).message}`);
          }
        }

        if (documents.length > 0) {
          const result = await upsertDocuments(supabase, documents);
          allResults.push(result);
          console.log('[jira-content-extract] Upserted documents', {
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
    console.error('[jira-content-extract] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
