import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cold start: Log credential presence (never log values)
const googleClientIdPresent = !!Deno.env.get('GOOGLE_CLIENT_ID');
const googleClientSecretPresent = !!Deno.env.get('GOOGLE_CLIENT_SECRET');
console.log('[google-calendar-poll] Cold start - Credentials check:', {
  GOOGLE_CLIENT_ID_present: googleClientIdPresent,
  GOOGLE_CLIENT_SECRET_present: googleClientSecretPresent,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[google-calendar-poll] Starting poll run');

    const { data: integrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'google_calendar');

    if (intError) {
      console.error('[google-calendar-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      console.log('[google-calendar-poll] No integrations found');
      return new Response(JSON.stringify({ message: 'No Google Calendar integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[google-calendar-poll] Found', integrations.length, 'integration(s)');

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      // Production hardening: per-user error and scope tracking
      const apiErrors: string[] = [];
      let scopeWarning: string | null = null;

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
          console.log('[google-calendar-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[google-calendar-poll] No access token for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        let currentToken = accessToken;

        // Token refresh if expired
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          console.log('[google-calendar-poll] Token expired, attempting refresh for user:', integration.user_id);
          const { data: refreshToken, error: rtError } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });

          if (rtError || !refreshToken) {
            const errMsg = `Token refresh failed: no refresh token for user ${integration.user_id}`;
            console.error('[google-calendar-poll]', errMsg);
            apiErrors.push(errMsg);
            errors.push(errMsg);
            continue;
          }

          try {
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
              currentToken = tokenData.access_token;

              // Update token in vault using update_secret (consistent with HubSpot pattern)
              await supabase.rpc('update_secret', {
                secret_id: integration.access_token_secret_id,
                new_secret: tokenData.access_token,
              });

              const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
              await supabase.from('oauth_tokens').update({
                expires_at: newExpiry,
                updated_at: new Date().toISOString(),
              }).eq('id', integration.id);

              console.log('[google-calendar-poll] Token refreshed successfully, new expiry:', newExpiry);
            } else {
              const errText = await tokenResponse.text();
              const errMsg = `Token refresh HTTP ${tokenResponse.status}: ${errText.slice(0, 200)}`;
              console.error('[google-calendar-poll]', errMsg);
              apiErrors.push(errMsg);
              errors.push(`Token refresh failed for user ${integration.user_id}: ${tokenResponse.status}`);
              continue;
            }
          } catch (refreshErr) {
            const errMsg = `Token refresh exception: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`;
            console.error('[google-calendar-poll]', errMsg);
            apiErrors.push(errMsg);
            errors.push(errMsg);
            continue;
          }
        }

        // Fetch calendar events for next 7 days
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        console.log('[google-calendar-poll] Fetching events for user:', integration.user_id);

        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
          }),
          { headers: { 'Authorization': `Bearer ${currentToken}` } }
        );

        if (!eventsResponse.ok) {
          const errBody = await eventsResponse.text();
          const errMsg = `Calendar API error ${eventsResponse.status}: ${errBody.slice(0, 200)}`;
          console.error('[google-calendar-poll]', errMsg);
          apiErrors.push(errMsg);

          if (eventsResponse.status === 403) {
            scopeWarning = 'Calendar API returned 403 Forbidden. The calendar.readonly scope may not be granted.';
          } else if (eventsResponse.status === 401) {
            scopeWarning = 'Calendar API returned 401 Unauthorized. Token may be invalid or revoked.';
          }

          errors.push(`API error for user ${integration.user_id}: ${eventsResponse.status}`);

          // Store error state in config for transparency
          try {
            const { data: existingInt } = await supabase
              .from('user_integrations').select('config')
              .eq('id', integration.user_integration_id).single();
            const existingCfg = (existingInt?.config as Record<string, unknown>) || {};
            await supabase.from('user_integrations').update({
              config: { ...existingCfg, calendar_synced_at: now.toISOString(), scope_warning: scopeWarning, last_api_errors: apiErrors.slice(0, 10) },
            }).eq('id', integration.user_integration_id);
          } catch (_) { /* best effort */ }
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

        // Calculate total meeting hours and busiest day
        let totalMeetingMinutes = 0;
        const dayCountMap: Record<string, number> = {};
        for (const event of events) {
          const start = (event as Record<string, unknown>).start as Record<string, string> | undefined;
          const end = (event as Record<string, unknown>).end as Record<string, string> | undefined;
          if (start?.dateTime && end?.dateTime) {
            const duration = (new Date(end.dateTime).getTime() - new Date(start.dateTime).getTime()) / 60000;
            totalMeetingMinutes += duration;
            const dayKey = start.dateTime.split('T')[0];
            dayCountMap[dayKey] = (dayCountMap[dayKey] || 0) + 1;
          }
        }

        const totalMeetingHours = Math.round(totalMeetingMinutes / 60 * 10) / 10;

        let busiestDay: string | null = null;
        let busiestDayCount = 0;
        for (const [day, count] of Object.entries(dayCountMap)) {
          if (count > busiestDayCount) {
            busiestDayCount = count;
            busiestDay = day;
          }
        }

        // DATA COMPLETENESS LOG
        console.log('[google-calendar-poll] Events fetched:', {
          total: totalEvents, meetings_with_attendees: meetingsWithAttendees,
          all_day: allDayEvents, recurring: recurringEvents,
          meeting_hours: totalMeetingHours, busiest_day: busiestDay, api_errors: apiErrors.length,
        });

        // Insert integration event
        const { error: eventError } = await supabase.from('integration_events').insert({
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
            total_meeting_hours: totalMeetingHours,
            busiest_day: busiestDay,
            busiest_day_count: busiestDayCount,
            poll_timestamp: now.toISOString(),
            period: '7_days_ahead',
          },
        });

        if (eventError) {
          console.error('[google-calendar-poll] Error inserting event:', eventError);
          apiErrors.push(`DB insert error: ${eventError.message}`);
        }

        // Update ingestion state
        const { error: stateError } = await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'google_calendar',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_events: totalEvents, meeting_hours: totalMeetingHours, meetings_with_attendees: meetingsWithAttendees },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        if (stateError) {
          console.error('[google-calendar-poll] Error updating state:', stateError);
          apiErrors.push(`State update error: ${stateError.message}`);
        }

        // Store transparency data in user_integrations config (matches Slack/HubSpot pattern)
        try {
          const { data: existingIntegration } = await supabase
            .from('user_integrations').select('config')
            .eq('id', integration.user_integration_id).single();

          const existingConfig = (existingIntegration?.config as Record<string, unknown>) || {};
          await supabase.from('user_integrations').update({
            config: {
              ...existingConfig,
              total_events: totalEvents,
              meetings_with_attendees: meetingsWithAttendees,
              all_day_events: allDayEvents,
              recurring_events: recurringEvents,
              total_meeting_hours: totalMeetingHours,
              busiest_day: busiestDay,
              busiest_day_count: busiestDayCount,
              calendar_synced_at: now.toISOString(),
              scope_warning: scopeWarning,
              last_api_errors: apiErrors.slice(0, 10),
              data_completeness: {
                events_fetched: totalEvents,
                period: '7_days_ahead',
                coverage_pct: 100,
              },
            },
          }).eq('id', integration.user_integration_id);

          console.log('[google-calendar-poll] Stored transparency data in config');
        } catch (storeError) {
          console.error('[google-calendar-poll] Error storing config:', storeError);
        }

        processedCount++;
      } catch (userError) {
        const errMsg = `Error for user ${integration.user_id}: ${(userError as Error).message}`;
        console.error('[google-calendar-poll]', errMsg);
        errors.push(errMsg);
      }
    }

    console.log('[google-calendar-poll] Poll complete:', { processed: processedCount, total: integrations.length, errors: errors.length });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[google-calendar-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
