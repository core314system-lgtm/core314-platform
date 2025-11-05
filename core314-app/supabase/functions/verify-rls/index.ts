
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createAdminClient,
  createUserClient,
  requireAdmin,
  postToTeams,
  postToSlack,
  verifyInternalToken,
} from '../_shared/integration-utils.ts';

interface AuditResult {
  audit_run_id: string;
  pass_count: number;
  fail_count: number;
  total_tables: number;
  issues: Array<{
    table: string;
    rls_enabled: boolean;
    policy_count: number;
    reason: string;
  }>;
  timestamp: string;
}

/**
 * Verify a service role JWT token
 * Returns true if the token is valid and has service_role
 */
async function verifyServiceRoleToken(authHeader: string): Promise<boolean> {
  try {
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      console.warn('JWT_SECRET not set - cannot verify service role tokens');
      return false;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    console.log('Attempting to verify service role token...');
    
    const payload = await verify(
      token,
      new TextEncoder().encode(jwtSecret),
      'HS256'
    );

    console.log('JWT verified successfully, payload:', JSON.stringify(payload));
    
    if (
      payload.role === 'service_role' &&
      payload.iss === 'supabase'
    ) {
      console.log('Service role token validated successfully');
      return true;
    }

    console.warn('JWT payload missing required fields:', { role: payload.role, iss: payload.iss });
    return false;
  } catch (error) {
    console.error('Error verifying service role token:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const internalTokenHeader = req.headers.get('X-Internal-Token');
    
    let isSchedulerCall = false;
    let triggeredBy = 'unknown';

    if (internalTokenHeader) {
      if (!verifyInternalToken(`Bearer ${internalTokenHeader}`)) {
        return new Response(
          JSON.stringify({ 
            error: 'Unauthorized: Invalid internal token',
            reason: 'X-Internal-Token header present but token is invalid'
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      isSchedulerCall = true;
      triggeredBy = 'scheduler';
    }
    else if (authHeader && await verifyServiceRoleToken(authHeader)) {
      triggeredBy = 'service_role';
    }
    else if (authHeader) {
      const supabaseClient = createUserClient(authHeader);
      try {
        const adminUserId = await requireAdmin(supabaseClient);
        triggeredBy = adminUserId;
      } catch (err) {
        return new Response(
          JSON.stringify({ 
            error: 'Forbidden: Platform administrator access required',
            reason: String(err)
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    else {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: No valid authentication provided',
          reason: 'Must provide either X-Internal-Token, service_role JWT, or admin user JWT'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(req.url);
    const ignoreTables = url.searchParams.get('ignore_tables')?.split(',') || [];
    const sendAlerts = url.searchParams.get('alerts') === 'true' || isSchedulerCall;

    const supabaseAdmin = createAdminClient();

    const { data: auditResult, error: rpcError } = await supabaseAdmin.rpc(
      'rls_audit_check',
      { ignore_tables: ignoreTables }
    );

    if (rpcError) {
      console.error('Error calling rls_audit_check:', rpcError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to execute RLS audit', 
          details: rpcError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = auditResult as AuditResult;

    if (sendAlerts && result.fail_count > 0) {
      const alertMessage = formatAlertMessage(result);
      const alertTitle = `🚨 RLS Audit Failed: ${result.fail_count} table(s) with issues`;

      const teamsWebhookUrl = Deno.env.get('MICROSOFT_TEAMS_WEBHOOK_URL');
      const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

      if (teamsWebhookUrl) {
        const teamsResult = await postToTeams(alertMessage, teamsWebhookUrl, alertTitle);
        if (!teamsResult.success) {
          console.error('Failed to send Teams alert:', teamsResult.error);
        }
      }

      if (slackWebhookUrl) {
        const slackResult = await postToSlack(alertMessage, slackWebhookUrl, alertTitle);
        if (!slackResult.success) {
          console.error('Failed to send Slack alert:', slackResult.error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        audit_run_id: result.audit_run_id,
        summary: {
          pass_count: result.pass_count,
          fail_count: result.fail_count,
          total_tables: result.total_tables,
          status: result.fail_count === 0 ? 'PASS' : 'FAIL',
        },
        issues: result.issues,
        alerts_sent: sendAlerts && result.fail_count > 0,
        triggered_by: triggeredBy,
        timestamp: result.timestamp,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('RLS verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatAlertMessage(result: AuditResult): string {
  const lines = [
    `RLS Audit completed at ${result.timestamp}`,
    ``,
    `**Summary:**`,
    `- Total tables audited: ${result.total_tables}`,
    `- Passed: ${result.pass_count}`,
    `- Failed: ${result.fail_count}`,
    ``,
  ];

  if (result.issues.length > 0) {
    lines.push(`**Issues Found:**`);
    result.issues.forEach((issue) => {
      lines.push(`- **${issue.table}**: ${issue.reason}`);
      lines.push(`  - RLS Enabled: ${issue.rls_enabled ? 'Yes' : 'No'}`);
      lines.push(`  - Policy Count: ${issue.policy_count}`);
    });
    lines.push(``);
  }

  lines.push(`View detailed logs in Supabase Dashboard:`);
  lines.push(`https://supabase.com/dashboard/project/ygvkegcstaowikessigx/editor`);
  lines.push(``);
  lines.push(`Query: SELECT * FROM rls_audit_log WHERE table_name = '_SUMMARY_' ORDER BY last_checked DESC LIMIT 1;`);

  return lines.join('\n');
}
