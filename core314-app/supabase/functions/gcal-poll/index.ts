import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; responseStatus?: string }>;
  status?: string;
}

interface GCalMetrics {
  eventCount: number;
  meetingCount: number;
  totalDuration: number;
  lastEventTimestamp: string | null;
  events: Array<{
    event_id: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    attendee_count: number;
    is_meeting: boolean;
  }>;
}

async function fetchGCalMetrics(accessToken: string): Promise<GCalMetrics> {
  const metrics: GCalMetrics = {
    eventCount: 0,
    meetingCount: 0,
    totalDuration: 0,
    lastEventTimestamp: null,
    events: [],
  };

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${weekAgo.toISOString()}&timeMax=${now.toISOString()}&maxResults=50&singleEvents=true&orderBy=startTime`;
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      const events: CalendarEvent[] = eventsData.items || [];
      
      metrics.eventCount = events.length;
      
      for (const event of events) {
        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        
        if (!startTime || !endTime) continue;
        
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        
        const attendeeCount = event.attendees?.length || 0;
        const isMeeting = attendeeCount > 1;
        
        if (isMeeting) {
          metrics.meetingCount++;
        }
        
        metrics.totalDuration += durationMinutes;
        
        metrics.events.push({
          event_id: event.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          duration_minutes: durationMinutes,
          attendee_count: attendeeCount,
          is_meeting: isMeeting,
        });
      }
      
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        metrics.lastEventTimestamp = lastEvent.start?.dateTime || lastEvent.start?.date || null;
      }
    } else {
      console.log('[gcal-poll] Failed to fetch events:', eventsResponse.status, await eventsResponse.text());
    }
  } catch (error) {
    console.error('[gcal-poll] Error fetching Google Calendar metrics:', error);
  }

  return metrics;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runStartTime = Date.now();
  const runTimestamp = new Date().toISOString();
  let recordsFetched = 0;
  let recordsWritten = 0;
  let usersProcessed = 0;
  let usersSkipped = 0;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: gcalIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'google_calendar');

    if (intError) {
      console.error('[gcal-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!gcalIntegrations || gcalIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Google Calendar integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of gcalIntegrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'google_calendar')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[gcal-poll] Skipping user (rate limited):', integration.user_id);
          usersSkipped++;
          continue;
        }

        const { data: decryptedToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !decryptedToken) {
          console.error('[gcal-poll] No access token found for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = decryptedToken;

        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[gcal-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchGCalMetrics(accessToken);
        const eventTime = metrics.lastEventTimestamp || now.toISOString();
        
        // Track records fetched
        recordsFetched += metrics.eventCount;

        if (metrics.eventCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'google_calendar',
            event_type: 'gcal.calendar_activity',
            occurred_at: eventTime,
            source: 'gcal_api_poll',
            metadata: {
              event_count: metrics.eventCount,
              meeting_count: metrics.meetingCount,
              total_duration_minutes: metrics.totalDuration,
              events: metrics.events,
              week_range: {
                start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: now.toISOString(),
              },
              poll_timestamp: now.toISOString(),
            },
          });
          recordsWritten++;
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'google_calendar',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        usersProcessed++;
        console.log('[gcal-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[gcal-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    // Log run metadata
    const runDurationMs = Date.now() - runStartTime;
    await supabase.from('poll_run_logs').insert({
      integration_name: 'google_calendar',
      run_timestamp: runTimestamp,
      run_duration_ms: runDurationMs,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: true,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      metadata: { total_integrations: gcalIntegrations.length, errors_count: errors.length },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: gcalIntegrations.length,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      run_duration_ms: runDurationMs,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gcal-poll] Error:', error);
    
    // Log failed run
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await supabase.from('poll_run_logs').insert({
      integration_name: 'google_calendar',
      run_timestamp: runTimestamp,
      run_duration_ms: Date.now() - runStartTime,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: false,
      error_message: errorMessage,
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
