import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GoogleMeetMetrics {
  meetingCount: number;
  upcomingMeetings: number;
  pastMeetings: number;
  lastActivityTimestamp: string | null;
}

async function fetchGoogleMeetMetrics(accessToken: string): Promise<GoogleMeetMetrics> {
  const metrics: GoogleMeetMetrics = {
    meetingCount: 0,
    upcomingMeetings: 0,
    pastMeetings: 0,
    lastActivityTimestamp: null,
  };

  try {
    // Google Meet events are stored in Google Calendar with conferenceData
    // We query calendar events that have Google Meet links
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=100&singleEvents=true`;

    const response = await fetch(calendarUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const events = data.items || [];
      
      // Filter for events with Google Meet conference data
      const meetEvents = events.filter((event: { conferenceData?: { conferenceSolution?: { name?: string } } }) => 
        event.conferenceData?.conferenceSolution?.name === 'Google Meet'
      );
      
      metrics.meetingCount = meetEvents.length;
      
      for (const event of meetEvents) {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        if (eventStart > now) {
          metrics.upcomingMeetings++;
        } else {
          metrics.pastMeetings++;
        }
      }
      
      if (meetEvents.length > 0) {
        const sortedEvents = meetEvents.sort((a: { updated?: string }, b: { updated?: string }) => 
          new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime()
        );
        metrics.lastActivityTimestamp = sortedEvents[0].updated;
      }
    } else {
      console.log('[gmeet-poll] Failed to fetch calendar events:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[gmeet-poll] Error fetching Google Meet metrics:', error);
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

    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        config,
        provider_id,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'google_meet')
      .eq('status', 'active');

    if (intError) {
      console.error('[gmeet-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Google Meet integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'google_meet')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[gmeet-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { access_token?: string } | null;
        if (!config?.access_token) {
          console.error('[gmeet-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchGoogleMeetMetrics(config.access_token);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.meetingCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'google_meet',
            event_type: 'google_meet.meeting_activity',
            occurred_at: eventTime,
            source: 'google_meet_api_poll',
            metadata: {
              meeting_count: metrics.meetingCount,
              upcoming_meetings: metrics.upcomingMeetings,
              past_meetings: metrics.pastMeetings,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'google_meet',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[gmeet-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[gmeet-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gmeet-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
