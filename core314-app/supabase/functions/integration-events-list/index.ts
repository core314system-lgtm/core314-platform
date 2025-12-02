
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";
import {
  createAdminClient,
  createUserClient,
  requireAdmin,
} from '../_shared/integration-utils.ts';

interface QueryParams {
  service_name?: string;
  event_type?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createUserClient(authHeader);
    
    try {
      await requireAdmin(supabaseClient);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: String(err) }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(req.url);
    const params: QueryParams = {
      service_name: url.searchParams.get('service_name') || undefined,
      event_type: url.searchParams.get('event_type') || undefined,
      user_id: url.searchParams.get('user_id') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '50'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    if (params.limit && (params.limit < 1 || params.limit > 1000)) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 1000' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createAdminClient();
    let query = supabaseAdmin
      .from('integration_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.service_name) {
      query = query.eq('service_name', params.service_name);
    }
    if (params.event_type) {
      query = query.eq('event_type', params.event_type);
    }
    if (params.user_id) {
      query = query.eq('user_id', params.user_id);
    }

    query = query.range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Error fetching integration events:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: stats } = await supabaseAdmin
      .from('integration_events')
      .select('service_name, event_type')
      .limit(1000);

    const serviceCounts: Record<string, number> = {};
    const eventTypeCounts: Record<string, number> = {};

    stats?.forEach((event) => {
      serviceCounts[event.service_name] = (serviceCounts[event.service_name] || 0) + 1;
      eventTypeCounts[event.event_type] = (eventTypeCounts[event.event_type] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        events: events || [],
        pagination: {
          total: count || 0,
          limit: params.limit || 50,
          offset: params.offset || 0,
        },
        filters: {
          service_name: params.service_name || null,
          event_type: params.event_type || null,
          user_id: params.user_id || null,
        },
        summary: {
          services: serviceCounts,
          event_types: eventTypeCounts,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Integration events list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}), { name: "integration-events-list" }));