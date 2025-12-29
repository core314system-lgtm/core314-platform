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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          slack_event_count: 0,
          teams_event_count: 0,
          last_slack_event_at: null,
          last_teams_event_at: null,
          error: 'Server configuration incomplete',
        }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { count: slackCount } = await supabase
      .from('integration_events')
      .select('*', { count: 'exact', head: true })
      .eq('service_name', 'slack');

    const { count: teamsCount } = await supabase
      .from('integration_events')
      .select('*', { count: 'exact', head: true })
      .eq('service_name', 'microsoft_teams');

    const { data: lastSlackEvent } = await supabase
      .from('integration_events')
      .select('occurred_at')
      .eq('service_name', 'slack')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single();

    const { data: lastTeamsEvent } = await supabase
      .from('integration_events')
      .select('occurred_at')
      .eq('service_name', 'microsoft_teams')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single();

    const response = {
      slack_event_count: slackCount || 0,
      teams_event_count: teamsCount || 0,
      last_slack_event_at: lastSlackEvent?.occurred_at || null,
      last_teams_event_at: lastTeamsEvent?.occurred_at || null,
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('[ingestion-status] Error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        slack_event_count: 0,
        teams_event_count: 0,
        last_slack_event_at: null,
        last_teams_event_at: null,
        error: error.message,
      }),
    };
  }
};
