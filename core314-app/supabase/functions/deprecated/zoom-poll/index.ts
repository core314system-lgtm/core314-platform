import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  participants_count?: number;
  type: number;
}

interface ZoomMetrics {
  meetingCount: number;
  totalDuration: number;
  totalParticipants: number;
  lastMeetingTimestamp: string | null;
  meetings: Array<{
    meeting_id: string;
    start_time: string;
    end_time: string;
    duration: number;
    participant_count: number;
  }>;
}

async function fetchZoomMetrics(accessToken: string): Promise<ZoomMetrics> {
  const metrics: ZoomMetrics = {
    meetingCount: 0,
    totalDuration: 0,
    totalParticipants: 0,
    lastMeetingTimestamp: null,
    meetings: [],
  };

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const meetingsUrl = `https://api.zoom.us/v2/users/me/meetings?type=scheduled&from=${weekAgo.toISOString().split('T')[0]}&to=${now.toISOString().split('T')[0]}&page_size=30`;
    
    const meetingsResponse = await fetch(meetingsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (meetingsResponse.ok) {
      const meetingsData = await meetingsResponse.json();
      const meetings: ZoomMeeting[] = meetingsData.meetings || [];
      
      metrics.meetingCount = meetings.length;
      
      for (const meeting of meetings) {
        const duration = meeting.duration || 0;
        metrics.totalDuration += duration;
        
        const endTime = meeting.start_time 
          ? new Date(new Date(meeting.start_time).getTime() + duration * 60 * 1000).toISOString()
          : now.toISOString();
        
        metrics.meetings.push({
          meeting_id: String(meeting.id),
          start_time: meeting.start_time || now.toISOString(),
          end_time: endTime,
          duration: duration,
          participant_count: meeting.participants_count || 0,
        });
        
        metrics.totalParticipants += meeting.participants_count || 0;
      }
      
      if (meetings.length > 0 && meetings[0].start_time) {
        metrics.lastMeetingTimestamp = meetings[0].start_time;
      }
    } else {
      console.log('[zoom-poll] Failed to fetch meetings:', meetingsResponse.status, await meetingsResponse.text());
    }
  } catch (error) {
    console.error('[zoom-poll] Error fetching Zoom metrics:', error);
  }

  return metrics;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: zoomIntegrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id,
        user_id,
        user_integration_id,
        integration_registry_id,
        access_token_secret_id,
        expires_at,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'zoom');

    if (intError) {
      console.error('[zoom-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!zoomIntegrations || zoomIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Zoom integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of zoomIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'zoom')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[zoom-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const { data: tokenData } = await supabase
          .from('vault.decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', integration.access_token_secret_id)
          .single();

        if (!tokenData?.decrypted_secret) {
          console.error('[zoom-poll] No access token found for user:', integration.user_id);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = tokenData.decrypted_secret;

        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[zoom-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchZoomMetrics(accessToken);
        const eventTime = metrics.lastMeetingTimestamp || now.toISOString();

        if (metrics.meetingCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'zoom',
            event_type: 'zoom.meeting_activity',
            occurred_at: eventTime,
            source: 'zoom_api_poll',
            metadata: {
              meeting_count: metrics.meetingCount,
              total_duration_minutes: metrics.totalDuration,
              total_participants: metrics.totalParticipants,
              meetings: metrics.meetings,
              week_range: {
                start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: now.toISOString(),
              },
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'zoom',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[zoom-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[zoom-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: zoomIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[zoom-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
