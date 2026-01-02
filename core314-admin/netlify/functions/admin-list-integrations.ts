import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

interface AdminIntegrationRecord {
  id: string;
  user_id: string;
  provider_id: string;
  status: string;
  date_added: string;
  last_verified_at: string | null;
  error_message: string | null;
  user_email: string;
  user_name: string | null;
  service_name: string;
  display_name: string;
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // Diagnostic logging - entry point
  console.log(JSON.stringify({
    op: 'admin-list-integrations',
    stage: 'start',
    method: event.httpMethod,
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!supabaseServiceRoleKey,
    hasAnonKey: !!supabaseAnonKey,
  }));

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'auth_header',
      hasAuthHeader: !!authHeader,
    }));

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser(token);
    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'auth_result',
      hasCaller: !!caller,
      authError: authError?.message ?? null,
    }));

    if (authError || !caller) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .single();

    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'admin_check',
      isPlatformAdmin: !!callerProfile?.is_platform_admin,
      profileError: profileError?.message ?? null,
    }));

    if (profileError || !callerProfile?.is_platform_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only platform administrators can view integration tracking' }),
      };
    }

    // Query user_integrations with join to integration_registry only
    // NOTE: We cannot join profiles directly because user_integrations.user_id -> auth.users.id,
    // not profiles.id. We'll fetch profiles separately.
    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'query_user_integrations_start',
    }));

    const { data: integrations, error: queryError } = await supabaseAdmin
      .from('user_integrations')
      .select(`
        id,
        user_id,
        provider_id,
        status,
        date_added,
        last_verified_at,
        error_message,
        integration_registry (
          service_name,
          display_name
        )
      `)
      .eq('added_by_user', true)
      .order('date_added', { ascending: false });

    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'query_user_integrations_result',
      rowCount: integrations?.length ?? 0,
      queryError: queryError?.message ?? null,
    }));

    if (queryError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `user_integrations query failed: ${queryError.message}` }),
      };
    }

    // Fetch profiles separately for all unique user_ids
    const userIds = Array.from(new Set((integrations || []).map(r => r.user_id)));
    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'query_profiles_start',
      userIdCount: userIds.length,
    }));

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'query_profiles_result',
      profileCount: profiles?.length ?? 0,
      profilesError: profilesError?.message ?? null,
    }));

    if (profilesError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `profiles query failed: ${profilesError.message}` }),
      };
    }

    // Build a map of user_id -> profile for quick lookup
    const profileMap = new Map<string, { email: string; full_name: string | null }>();
    for (const p of profiles || []) {
      profileMap.set(p.id, { email: p.email, full_name: p.full_name });
    }

    // Transform the data to a flat structure for the frontend
    const transformedIntegrations: AdminIntegrationRecord[] = (integrations || [])
      .filter((item) => item.integration_registry)
      .map((item) => {
        // Handle both single object and array responses from Supabase join
        const registry = Array.isArray(item.integration_registry) ? item.integration_registry[0] : item.integration_registry;
        const profile = profileMap.get(item.user_id);
        
        return {
          id: item.id,
          user_id: item.user_id,
          provider_id: item.provider_id,
          status: item.status,
          date_added: item.date_added,
          last_verified_at: item.last_verified_at,
          error_message: item.error_message,
          user_email: profile?.email || 'Unknown',
          user_name: profile?.full_name || null,
          service_name: registry?.service_name || 'unknown',
          display_name: registry?.display_name || 'Unknown Integration',
        };
      });

    // Compute stats
    const stats = {
      total: transformedIntegrations.length,
      active: transformedIntegrations.filter(i => i.status === 'active').length,
      inactive: transformedIntegrations.filter(i => i.status === 'inactive').length,
      error: transformedIntegrations.filter(i => i.status === 'error').length,
      pending: transformedIntegrations.filter(i => i.status === 'pending').length,
    };

    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'build_response',
      total: stats.total,
      active: stats.active,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        integrations: transformedIntegrations,
        stats,
      }),
    };
  } catch (error) {
    console.error('Error in admin-list-integrations:', error);
    console.log(JSON.stringify({
      op: 'admin-list-integrations',
      stage: 'catch',
      errorMessage: (error as Error)?.message ?? String(error),
    }));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch integrations',
      }),
    };
  }
};
