import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin endpoint to list HubSpot connections with sync details.
 * Returns connected HubSpot accounts, last sync time, sync status, and data counts.
 */
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Auth check
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization header' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !caller) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
    }

    // Admin check
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .single();

    if (!callerProfile?.is_platform_admin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    // Fetch HubSpot connections
    const { data: connections, error: queryError } = await supabaseAdmin
      .from('hubspot_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) {
      return { statusCode: 500, body: JSON.stringify({ error: queryError.message }) };
    }

    // Get user emails for each connection
    const userIds = [...new Set((connections || []).map(c => c.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const profileMap = new Map<string, { email: string; full_name: string | null }>();
    for (const p of profiles || []) {
      profileMap.set(p.id, { email: p.email, full_name: p.full_name });
    }

    const enrichedConnections = (connections || []).map(conn => {
      const profile = profileMap.get(conn.user_id);
      return {
        id: conn.id,
        user_id: conn.user_id,
        user_email: profile?.email || 'Unknown',
        user_name: profile?.full_name || null,
        hubspot_portal_id: conn.hubspot_portal_id,
        sync_status: conn.sync_status,
        sync_error: conn.sync_error,
        last_sync_at: conn.last_sync_at,
        contacts_synced: conn.contacts_synced,
        deals_synced: conn.deals_synced,
        companies_synced: conn.companies_synced,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
      };
    });

    const stats = {
      total: enrichedConnections.length,
      syncing: enrichedConnections.filter(c => c.sync_status === 'syncing').length,
      success: enrichedConnections.filter(c => c.sync_status === 'success').length,
      error: enrichedConnections.filter(c => c.sync_status === 'error').length,
      pending: enrichedConnections.filter(c => c.sync_status === 'pending').length,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ connections: enrichedConnections, stats }),
    };
  } catch (error) {
    console.error('Error in admin-hubspot-connections:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
    };
  }
};
