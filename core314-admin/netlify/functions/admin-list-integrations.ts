import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser(token);
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

    if (profileError || !callerProfile?.is_platform_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only platform administrators can view integration tracking' }),
      };
    }

    // Query user_integrations with joins to integration_registry and profiles
    // Filter by added_by_user = true to only show user-connected integrations (not seeded data)
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
        profiles!user_integrations_user_id_fkey (
          email,
          full_name
        ),
        integration_registry!user_integrations_provider_id_fkey (
          service_name,
          display_name
        )
      `)
      .eq('added_by_user', true)
      .order('date_added', { ascending: false });

    if (queryError) {
      console.error('Error querying integrations:', queryError);
      throw queryError;
    }

    // Transform the data to a flat structure for the frontend
    const transformedIntegrations: AdminIntegrationRecord[] = (integrations || [])
      .filter((item) => item.integration_registry && item.profiles)
      .map((item) => {
        // Handle both single object and array responses from Supabase join
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const registry = Array.isArray(item.integration_registry) ? item.integration_registry[0] : item.integration_registry;
        
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        integrations: transformedIntegrations,
        stats,
      }),
    };
  } catch (error) {
    console.error('Error in admin-list-integrations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch integrations',
      }),
    };
  }
};
