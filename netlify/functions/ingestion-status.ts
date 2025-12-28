import { createClient } from '@supabase/supabase-js';

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey);

    const { data: slackEvents, error: slackError } = await adminSupabase
      .from('integration_events')
      .select('id, event_type, occurred_at, ingested_at, metadata')
      .eq('user_id', user.id)
      .eq('service_name', 'slack')
      .order('ingested_at', { ascending: false })
      .limit(10);

    const { data: teamsEvents, error: teamsError } = await adminSupabase
      .from('integration_events')
      .select('id, event_type, occurred_at, ingested_at, metadata')
      .eq('user_id', user.id)
      .eq('service_name', 'microsoft_teams')
      .order('ingested_at', { ascending: false })
      .limit(10);

    const { count: slackCount } = await adminSupabase
      .from('integration_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('service_name', 'slack');

    const { count: teamsCount } = await adminSupabase
      .from('integration_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('service_name', 'microsoft_teams');

    const { data: slackState } = await adminSupabase
      .from('integration_ingestion_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'slack')
      .single();

    const { data: teamsState } = await adminSupabase
      .from('integration_ingestion_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', 'microsoft_teams')
      .single();

    const response = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      slack: {
        total_events: slackCount || 0,
        last_event_timestamp: slackEvents?.[0]?.occurred_at || null,
        last_ingested_at: slackEvents?.[0]?.ingested_at || null,
        recent_events: slackEvents || [],
        ingestion_state: slackState || null,
        error: slackError?.message || null,
      },
      teams: {
        total_events: teamsCount || 0,
        last_event_timestamp: teamsEvents?.[0]?.occurred_at || null,
        last_ingested_at: teamsEvents?.[0]?.ingested_at || null,
        recent_events: teamsEvents || [],
        ingestion_state: teamsState || null,
        error: teamsError?.message || null,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('[ingestion-status] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
