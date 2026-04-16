import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const { data: integrations } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'zoom');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Zoom integrations found', processed: 0 }), {
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
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'zoom')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: tokenJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!tokenJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let accessToken: string;
        try {
          const parsed = JSON.parse(tokenJson);
          accessToken = parsed.access_token || parsed.api_token || tokenJson;
        } catch {
          accessToken = tokenJson;
        }

        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        };

        // Fetch user profile
        let userDisplayName = 'Unknown';
        try {
          const profileResponse = await fetch('https://api.zoom.us/v2/users/me', { headers });
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            userDisplayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
          }
        } catch (apiErr) {
          console.warn('[zoom-poll] Profile fetch error:', apiErr);
        }

        // Fetch upcoming meetings
        let totalUpcoming = 0;
        let totalScheduledMinutes = 0;
        const meetingSummary: { topic: string; start_time: string; duration: number }[] = [];

        try {
          const meetingsResponse = await fetch(
            'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=30',
            { headers }
          );

          if (meetingsResponse.ok) {
            const meetingsData = await meetingsResponse.json();
            const meetings = meetingsData.meetings || [];
            totalUpcoming = meetings.length;

            for (const meeting of meetings) {
              const duration = (meeting.duration as number) || 0;
              totalScheduledMinutes += duration;
              meetingSummary.push({
                topic: meeting.topic as string,
                start_time: meeting.start_time as string,
                duration,
              });
            }
          }
        } catch (apiErr) {
          console.warn('[zoom-poll] Meetings fetch error:', apiErr);
        }

        // Fetch past meetings (last 30 days)
        let totalPastMeetings = 0;
        let totalParticipants = 0;
        const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = now.toISOString().split('T')[0];

        try {
          const pastResponse = await fetch(
            `https://api.zoom.us/v2/users/me/meetings?type=previous_meetings&from=${fromDate}&to=${toDate}&page_size=30`,
            { headers }
          );

          if (pastResponse.ok) {
            const pastData = await pastResponse.json();
            totalPastMeetings = (pastData.meetings || []).length;
            totalParticipants = (pastData.meetings || []).reduce(
              (sum: number, m: Record<string, number>) => sum + ((m.total_minutes || 0) > 0 ? 1 : 0), 0
            );
          }
        } catch (apiErr) {
          console.warn('[zoom-poll] Past meetings fetch error:', apiErr);
        }

        const avgMeetingDuration = totalUpcoming > 0 ? Math.round(totalScheduledMinutes / totalUpcoming) : 0;
        const weeklyMeetingRate = totalPastMeetings > 0 ? Math.round(totalPastMeetings / 4) : 0;

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'zoom',
          event_type: 'zoom.meeting_activity',
          occurred_at: now.toISOString(),
          source: 'zoom_api_poll',
          metadata: {
            user_name: userDisplayName,
            upcoming_meetings: totalUpcoming,
            scheduled_minutes: totalScheduledMinutes,
            avg_meeting_duration: avgMeetingDuration,
            past_meetings_30d: totalPastMeetings,
            weekly_meeting_rate: weeklyMeetingRate,
            total_participants: totalParticipants,
            meeting_summary: meetingSummary.slice(0, 10),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'zoom',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { upcoming: totalUpcoming, past_30d: totalPastMeetings, avg_duration: avgMeetingDuration },
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
    console.error('[zoom-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
