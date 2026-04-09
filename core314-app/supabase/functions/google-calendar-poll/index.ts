import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all Google Calendar OAuth integrations
    const { data: integrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'google_calendar');

    if (intError || !integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Google Calendar integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        // Check rate limiting
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'google_calendar')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          continue;
        }

        // Get access token from vault
        const { data: accessToken } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!accessToken) {
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        // Check if token is expired and needs refresh
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          const { data: refreshToken } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });

          if (refreshToken) {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
              }),
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              const { data: newSecretId } = await supabase.rpc('vault_create_secret', {
                secret: tokenData.access_token,
              });

              await supabase.from('oauth_tokens').update({
                access_token_secret_id: newSecretId,
                expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
              }).eq('id', integration.id);

              // Use refreshed token for polling
              // Recursion-free: just use the new token directly
            }
          }
        }

        // Fetch calendar events for next 7 days
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '100',
          }),
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (!eventsResponse.ok) {
          errors.push(`API error for user ${integration.user_id}: ${eventsResponse.status}`);
          continue;
        }

        const eventsData = await eventsResponse.json();
        const events = eventsData.items || [];

        // Calculate metrics
        const totalEvents = events.length;
        const meetingsWithAttendees = events.filter((e: Record<string, unknown>) => 
          Array.isArray(e.attendees) && (e.attendees as unknown[]).length > 1
        ).length;
        const allDayEvents = events.filter((e: Record<string, unknown>) => 
          !!(e.start as Record<string, unknown>)?.date
        ).length;
        const recurringEvents = events.filter((e: Record<string, unknown>) => !!e.recurringEventId).length;

        // Calculate total meeting hours
        let totalMeetingMinutes = 0;
        for (const event of events) {
          const start = (event as Record<string, unknown>).start as Record<string, string> | undefined;
          const end = (event as Record<string, unknown>).end as Record<string, string> | undefined;
          if (start?.dateTime && end?.dateTime) {
            const duration = (new Date(end.dateTime).getTime() - new Date(start.dateTime).getTime()) / 60000;
            totalMeetingMinutes += duration;
          }
        }

        // Insert integration event
        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'google_calendar',
          event_type: 'google_calendar.weekly_summary',
          occurred_at: now.toISOString(),
          source: 'google_calendar_api_poll',
          metadata: {
            total_events: totalEvents,
            meetings_with_attendees: meetingsWithAttendees,
            all_day_events: allDayEvents,
            recurring_events: recurringEvents,
            total_meeting_minutes: Math.round(totalMeetingMinutes),
            total_meeting_hours: Math.round(totalMeetingMinutes / 60 * 10) / 10,
            poll_timestamp: now.toISOString(),
            period: '7_days_ahead',
          },
        });

        // Update ingestion state
        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'google_calendar',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_events: totalEvents, meeting_hours: Math.round(totalMeetingMinutes / 60 * 10) / 10 },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount, total: integrations.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[google-calendar-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: 'google-calendar-poll' }));
