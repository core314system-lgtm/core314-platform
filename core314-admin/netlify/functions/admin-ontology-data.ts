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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

async function fetchEntityTypes() {
  const { data, error } = await supabaseAdmin
    .from('entity_type_definitions')
    .select('*')
    .order('name', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

async function fetchFieldMappings() {
  const { data, error } = await supabaseAdmin
    .from('integration_field_mappings')
    .select('*')
    .order('integration_service_name', { ascending: true })
    .order('priority', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

async function fetchMappingOverrides() {
  const { data, error } = await supabaseAdmin
    .from('mapping_overrides')
    .select('*, integration_field_mappings(integration_service_name, source_field_path, target_entity_type, target_field)')
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };

  const userIds = [...new Set((data || []).map(o => o.user_id).filter(Boolean))];
  let profiles: Array<{ id: string; full_name: string; email: string }> = [];
  if (userIds.length > 0) {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    profiles = p || [];
  }
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const enriched = (data || []).map(o => ({
    ...o,
    profiles: o.user_id ? profileMap.get(o.user_id) || null : null,
  }));
  return { data: enriched };
}

async function fetchOntologyStats() {
  const { data: types } = await supabaseAdmin
    .from('entity_type_definitions')
    .select('id, name, is_active');
  const { data: mappings } = await supabaseAdmin
    .from('integration_field_mappings')
    .select('id, integration_service_name, target_entity_type, is_active');
  const { data: overrides } = await supabaseAdmin
    .from('mapping_overrides')
    .select('id, override_type');
  const { data: logs } = await supabaseAdmin
    .from('ontology_processing_log')
    .select('id, integration_service_name, mappings_applied, entities_extracted, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const integrationNames = [...new Set((mappings || []).map(m => m.integration_service_name))];
  const entityTypeNames = [...new Set((mappings || []).map(m => m.target_entity_type))];
  const mappingsByIntegration: Record<string, number> = {};
  (mappings || []).forEach(m => {
    mappingsByIntegration[m.integration_service_name] = (mappingsByIntegration[m.integration_service_name] || 0) + 1;
  });
  const mappingsByEntityType: Record<string, number> = {};
  (mappings || []).forEach(m => {
    mappingsByEntityType[m.target_entity_type] = (mappingsByEntityType[m.target_entity_type] || 0) + 1;
  });
  const mappingMatrix: Record<string, Record<string, number>> = {};
  (mappings || []).forEach(m => {
    if (!mappingMatrix[m.integration_service_name]) mappingMatrix[m.integration_service_name] = {};
    mappingMatrix[m.integration_service_name][m.target_entity_type] = (mappingMatrix[m.integration_service_name][m.target_entity_type] || 0) + 1;
  });

  return {
    entityTypes: types || [],
    totalMappings: (mappings || []).length,
    activeMappings: (mappings || []).filter(m => m.is_active).length,
    totalOverrides: (overrides || []).length,
    integrationNames,
    entityTypeNames,
    mappingsByIntegration,
    mappingsByEntityType,
    mappingMatrix,
    recentLogs: (logs || []).slice(0, 50),
  };
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const auth = await verifyAdmin(authHeader);
  if (!auth.valid) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
  }

  const dataType = event.queryStringParameters?.type;

  try {
    if (event.httpMethod === 'GET') {
      let result: unknown;
      switch (dataType) {
        case 'entity-types':
          result = await fetchEntityTypes();
          break;
        case 'field-mappings':
          result = await fetchFieldMappings();
          break;
        case 'mapping-overrides':
          result = await fetchMappingOverrides();
          break;
        case 'ontology-stats':
          result = await fetchOntologyStats();
          break;
        default:
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid type. Use: entity-types, field-mappings, mapping-overrides, ontology-stats' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      let result: unknown;

      switch (dataType) {
        case 'entity-types': {
          if (event.httpMethod === 'POST') {
            const { data, error } = await supabaseAdmin
              .from('entity_type_definitions')
              .insert(body)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          } else {
            const { id, ...updates } = body;
            updates.updated_at = new Date().toISOString();
            const { data, error } = await supabaseAdmin
              .from('entity_type_definitions')
              .update(updates)
              .eq('id', id)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          }
          break;
        }
        case 'field-mappings': {
          if (event.httpMethod === 'POST') {
            const { data, error } = await supabaseAdmin
              .from('integration_field_mappings')
              .insert(body)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          } else {
            const { id, ...updates } = body;
            updates.updated_at = new Date().toISOString();
            const { data, error } = await supabaseAdmin
              .from('integration_field_mappings')
              .update(updates)
              .eq('id', id)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          }
          break;
        }
        case 'mapping-overrides': {
          if (event.httpMethod === 'POST') {
            const { data, error } = await supabaseAdmin
              .from('mapping_overrides')
              .insert(body)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          } else {
            const { id, ...updates } = body;
            updates.updated_at = new Date().toISOString();
            const { data, error } = await supabaseAdmin
              .from('mapping_overrides')
              .update(updates)
              .eq('id', id)
              .select()
              .single();
            if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            result = { data };
          }
          break;
        }
        default:
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid type for POST/PUT' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id parameter' }) };

      let table: string;
      switch (dataType) {
        case 'entity-types': table = 'entity_type_definitions'; break;
        case 'field-mappings': table = 'integration_field_mappings'; break;
        case 'mapping-overrides': table = 'mapping_overrides'; break;
        default:
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid type for DELETE' }) };
      }

      const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
      if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    console.error('admin-ontology-data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
    };
  }
};
