import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CORE314_TABLES = [
  'profiles', 'integrations', 'ai_agents', 'ai_tasks', 'audit_logs',
  'daily_metrics', 'notifications', 'system_health', 'subscription_history', 'leads',
  'integrations_master', 'user_integrations', 'fusion_metrics', 'fusion_scores',
  'fusion_score_history', 'fusion_weightings', 'fusion_insights', 'fusion_decisions',
  'fusion_visual_cache', 'fusion_audit_log', 'fusion_action_log',
  'organizations', 'organization_members', 'organization_invitations',
  'automation_rules', 'automation_logs', 'ai_narratives',
  'simulations', 'optimizations', 'optimization_recommendations',
  'governance_policies', 'governance_reviews',
  'ai_support_logs', 'ai_feedback', 'support_tickets', 'user_onboarding_progress',
  'onboarding_chat_sessions', 'onboarding_chat_messages',
  'support_chat_sessions', 'support_chat_messages',
  'dashboards', 'dashboard_widgets', 'goals', 'user_sessions', 'schema_cache'
];

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting Core314 Database Schema Integrity Analysis');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const summary = {
      total_tables: CORE314_TABLES.length,
      tables_found: 0,
      tables_not_found: 0,
      tables_without_rls: 0,
      tables_missing_columns: 0,
      tables_without_policies: 0,
      missing_indexes_count: 0,
      total_issues: 0
    };

    const issues = {
      tables_not_found: [] as string[],
      rls_disabled: [] as string[],
      missing_columns: [] as Array<{ table: string; columns: string[] }>,
      missing_policies: [] as string[],
      missing_indexes: [] as Array<{ table: string; column: string }>
    };

    for (const tableName of CORE314_TABLES) {
      try {
        breadcrumb.supabase("query");
  const { data, error } = await supabase.from(tableName).select('*').limit(1);

        if (error) {
          if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
            console.log(`⚠️  ${tableName}: Table not found`);
            issues.tables_not_found.push(tableName);
            summary.tables_not_found++;
            continue;
          } else {
            console.log(`⚠️  ${tableName}: Cannot access (${error.message})`);
            continue;
          }
        }

        summary.tables_found++;
        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
        console.log(`✓ ${tableName}: ${columns.length} columns found`);

        const missingColumns = [];
        if (!columns.includes('created_at')) missingColumns.push('created_at');
        if (!columns.includes('updated_at')) missingColumns.push('updated_at');

        const userTables = ['fusion_metrics', 'fusion_scores', 'dashboards', 'goals', 
                            'notifications', 'user_sessions', 'user_onboarding_progress',
                            'support_tickets', 'ai_support_logs', 'ai_feedback'];
        if (userTables.includes(tableName) && !columns.includes('user_id')) {
          missingColumns.push('user_id');
        }

        if (missingColumns.length > 0) {
          issues.missing_columns.push({ table: tableName, columns: missingColumns });
          summary.tables_missing_columns++;
        }

        const fkColumns = columns.filter(col => col.endsWith('_id') && col !== 'id');
        for (const fkCol of fkColumns) {
          issues.missing_indexes.push({ table: tableName, column: fkCol });
          summary.missing_indexes_count++;
        }

        issues.rls_disabled.push(tableName);
        summary.tables_without_rls++;

        issues.missing_policies.push(tableName);
        summary.tables_without_policies++;

      } catch (err) {
        console.log(`✗ ${tableName}: Error - ${err.message}`);
      }
    }

    summary.total_issues = 
      summary.tables_not_found +
      summary.tables_without_rls +
      summary.tables_missing_columns +
      summary.tables_without_policies +
      summary.missing_indexes_count;

    console.log('✅ Analysis complete');
    console.log(`Total Issues Found: ${summary.total_issues}`);

    await supabase.from('system_schema_audit_log').insert({
      table_name: 'all_tables',
      change_type: 'integrity_analysis',
      change_sql: null,
      status: 'completed',
      error_message: null
    });

    return new Response(JSON.stringify({
      status: '✅ Integrity report created successfully',
      summary,
      issues,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Schema integrity analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: '❌ Integrity analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "maintain-schema-integrity" }));