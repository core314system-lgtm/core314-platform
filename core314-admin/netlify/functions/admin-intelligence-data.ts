import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

async function verifyAdmin(authHeader: string | undefined): Promise<{ valid: boolean; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  if (authError || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_platform_admin, role')
    .eq('id', user.id)
    .single();
  if (!profile?.is_platform_admin && profile?.role !== 'admin') {
    return { valid: false, error: 'Admin access required' };
  }
  return { valid: true };
}

async function tableExists(tableName: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(tableName).select('id').limit(1);
  if (error && error.message.includes('Could not find')) return false;
  return true;
}

async function fetchSignals() {
  const exists = await tableExists('operational_signals');
  if (!exists) return { data: [], tableExists: false };

  const { data, error } = await supabaseAdmin
    .from('operational_signals')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(200);

  if (error) return { data: [], error: error.message };

  // Enrich with profile data
  const userIds = [...new Set((data || []).map(s => s.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const enriched = (data || []).map(s => ({
    ...s,
    profiles: profileMap.get(s.user_id) || null,
  }));

  return { data: enriched, tableExists: true };
}

async function fetchBriefs() {
  const exists = await tableExists('operational_briefs');
  if (!exists) return { data: [], tableExists: false };

  const { data, error } = await supabaseAdmin
    .from('operational_briefs')
    .select('id, user_id, title, confidence, health_score, brief_type, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { data: [], error: error.message };

  const userIds = [...new Set((data || []).map(b => b.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const enriched = (data || []).map(b => ({
    ...b,
    profiles: profileMap.get(b.user_id) || null,
  }));

  return { data: enriched, tableExists: true };
}

async function fetchHealthScores() {
  const exists = await tableExists('operational_health_scores');
  if (!exists) return { data: [], tableExists: false };

  const { data, error } = await supabaseAdmin
    .from('operational_health_scores')
    .select('*')
    .order('calculated_at', { ascending: false })
    .limit(500);

  if (error) return { data: [], error: error.message };

  const userIds = [...new Set((data || []).map(s => s.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const enriched = (data || []).map(s => ({
    ...s,
    profiles: profileMap.get(s.user_id) || null,
  }));

  return { data: enriched, tableExists: true };
}

async function fetchEntities() {
  const exists = await tableExists('resolved_entities');
  if (!exists) return { data: [], tableExists: false };

  const { data, error } = await supabaseAdmin
    .from('resolved_entities')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) return { data: [], error: error.message };

  // Fetch source records for each entity
  const entityIds = (data || []).map(e => e.id);
  const { data: sourceRecords } = await supabaseAdmin
    .from('entity_source_records')
    .select('*')
    .in('resolved_entity_id', entityIds.length > 0 ? entityIds : ['00000000-0000-0000-0000-000000000000']);

  // Enrich with profile data
  const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const sourceMap = new Map<string, typeof sourceRecords>();
  (sourceRecords || []).forEach(sr => {
    const existing = sourceMap.get(sr.resolved_entity_id) || [];
    existing.push(sr);
    sourceMap.set(sr.resolved_entity_id, existing);
  });

  const enriched = (data || []).map(e => ({
    ...e,
    profiles: profileMap.get(e.user_id) || null,
    source_records: sourceMap.get(e.id) || [],
  }));

  return { data: enriched, tableExists: true };
}

async function fetchEntityMatchLog() {
  const exists = await tableExists('entity_match_log');
  if (!exists) return { data: [], tableExists: false };

  const { data, error } = await supabaseAdmin
    .from('entity_match_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return { data: [], error: error.message };

  // Enrich with entity names
  const entityIds = [...new Set((data || []).map(m => m.resolved_entity_id).filter(Boolean))];
  const { data: entities } = await supabaseAdmin
    .from('resolved_entities')
    .select('id, canonical_name, entity_type')
    .in('id', entityIds.length > 0 ? entityIds : ['00000000-0000-0000-0000-000000000000']);

  const userIds = [...new Set((data || []).map(m => m.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const entityMap = new Map((entities || []).map(e => [e.id, e]));
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const enriched = (data || []).map(m => ({
    ...m,
    entity: entityMap.get(m.resolved_entity_id) || null,
    profiles: profileMap.get(m.user_id) || null,
  }));

  return { data: enriched, tableExists: true };
}

async function fetchEntityStats() {
  const reExists = await tableExists('resolved_entities');
  const srExists = await tableExists('entity_source_records');
  const mlExists = await tableExists('entity_match_log');

  if (!reExists) return { tableExists: false, stats: {} };

  const { data: entities } = await supabaseAdmin
    .from('resolved_entities')
    .select('id, entity_type, source_count, created_at');

  const { data: sourceRecords } = srExists
    ? await supabaseAdmin.from('entity_source_records').select('id, source_integration, match_method, match_confidence')
    : { data: [] };

  const { data: matchLogs } = mlExists
    ? await supabaseAdmin.from('entity_match_log').select('id, match_method, match_confidence, created_at')
    : { data: [] };

  const totalEntities = (entities || []).length;
  const personCount = (entities || []).filter(e => e.entity_type === 'person').length;
  const companyCount = (entities || []).filter(e => e.entity_type === 'company').length;
  const totalSourceRecords = (sourceRecords || []).length;
  const totalMatchLogs = (matchLogs || []).length;

  // Match method distribution
  const methodCounts: Record<string, number> = {};
  (sourceRecords || []).forEach(sr => {
    methodCounts[sr.match_method] = (methodCounts[sr.match_method] || 0) + 1;
  });

  // Integration distribution
  const integrationCounts: Record<string, number> = {};
  (sourceRecords || []).forEach(sr => {
    integrationCounts[sr.source_integration] = (integrationCounts[sr.source_integration] || 0) + 1;
  });

  // Confidence distribution
  const confidenceBuckets = { high: 0, medium: 0, low: 0 };
  (sourceRecords || []).forEach(sr => {
    const conf = Number(sr.match_confidence);
    if (conf >= 95) confidenceBuckets.high++;
    else if (conf >= 85) confidenceBuckets.medium++;
    else confidenceBuckets.low++;
  });

  // Entities over time (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyCounts: Record<string, number> = {};
  (entities || []).forEach(e => {
    const date = new Date(e.created_at).toISOString().split('T')[0];
    if (new Date(e.created_at) >= thirtyDaysAgo) {
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    }
  });

  const avgSourcesPerEntity = totalEntities > 0 ? (totalSourceRecords / totalEntities).toFixed(1) : '0';

  return {
    tableExists: true,
    stats: {
      totalEntities,
      personCount,
      companyCount,
      totalSourceRecords,
      totalMatchLogs,
      avgSourcesPerEntity,
      methodCounts,
      integrationCounts,
      confidenceBuckets,
      dailyCounts,
    },
  };
}

async function fetchIntegrationHealth() {
  // Check both user_integrations and integration_health_logs
  const uiExists = await tableExists('user_integrations');

  if (!uiExists) {
    return { integrations: [], healthLogs: [], tableExists: false };
  }

  // Fetch user_integrations with profile data
  const { data: integrations, error: intError } = await supabaseAdmin
    .from('user_integrations')
    .select('*')
    .order('date_added', { ascending: false });

  if (intError) {
    return { integrations: [], healthLogs: [], error: intError.message };
  }

  // Enrich with profile and registry data
  const userIds = [...new Set((integrations || []).map(i => i.user_id).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const { data: registry } = await supabaseAdmin
    .from('integration_registry')
    .select('id, service_name, display_name')
    .limit(100);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const registryMap = new Map((registry || []).map(r => [r.id, r]));

  // Also try to get oauth_tokens for expiry info
  const { data: tokens } = await supabaseAdmin
    .from('oauth_tokens')
    .select('user_id, integration_registry_id, expires_at')
    .limit(500);

  const tokenMap = new Map<string, string | null>();
  (tokens || []).forEach(t => {
    tokenMap.set(`${t.user_id}:${t.integration_registry_id}`, t.expires_at);
  });

  const enriched = (integrations || []).map(i => {
    const reg = registryMap.get(i.provider_id);
    return {
      id: i.id,
      user_id: i.user_id,
      service_name: reg?.service_name || 'unknown',
      status: i.status,
      connected_at: i.date_added,
      last_health_check: i.last_verified_at || null,
      health_status: i.status === 'active' ? 'healthy' : i.status === 'error' ? 'unhealthy' : null,
      token_expires_at: tokenMap.get(`${i.user_id}:${i.provider_id}`) || null,
      profiles: profileMap.get(i.user_id) || null,
    };
  });

  // Fetch health logs if table exists
  let healthLogs: unknown[] = [];
  const hlExists = await tableExists('integration_health_logs');
  if (hlExists) {
    const { data: logs } = await supabaseAdmin
      .from('integration_health_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    healthLogs = logs || [];
  }

  return { integrations: enriched, healthLogs, tableExists: true };
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify admin access
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const auth = await verifyAdmin(authHeader);
  if (!auth.valid) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
  }

  const dataType = event.queryStringParameters?.type;

  try {
    let result: unknown;

    switch (dataType) {
      case 'signals':
        result = await fetchSignals();
        break;
      case 'briefs':
        result = await fetchBriefs();
        break;
      case 'health-scores':
        result = await fetchHealthScores();
        break;
      case 'integration-health':
        result = await fetchIntegrationHealth();
        break;
      case 'entities':
        result = await fetchEntities();
        break;
      case 'entity-match-log':
        result = await fetchEntityMatchLog();
        break;
      case 'entity-stats':
        result = await fetchEntityStats();
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid type. Use: signals, briefs, health-scores, integration-health, entities, entity-match-log, entity-stats' }),
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('admin-intelligence-data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
    };
  }
};
