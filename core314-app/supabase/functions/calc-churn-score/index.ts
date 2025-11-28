import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

interface ChurnScoreRequest {
  user_id: string;
}

interface ChurnScoreResult {
  success: boolean;
  churn_score: number;
  sessions_last_7d: number;
  events_last_7d: number;
  streak_days: number;
  last_activity: string | null;
  prediction_reason: string;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: "Admin access required" }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const { user_id }: ChurnScoreRequest = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: events, error: eventsError } = await supabase
      .from('beta_events_admin_view')
      .select('user_id, event_name, created_at')
      .eq('user_id', user_id)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return new Response(JSON.stringify({ error: "Failed to fetch user events" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const events_last_7d = events?.length || 0;
    const last_activity = events && events.length > 0 ? events[0].created_at : null;

    const uniqueDays = new Set<string>();
    events?.forEach(event => {
      const date = new Date(event.created_at).toDateString();
      uniqueDays.add(date);
    });
    const sessions_last_7d = uniqueDays.size;

    let streak_days = 0;
    if (events && events.length > 0) {
      const sortedDates = Array.from(uniqueDays).sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
      );
      
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (sortedDates[0] === today || sortedDates[0] === yesterday) {
        streak_days = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const currentDate = new Date(sortedDates[i]);
          const previousDate = new Date(sortedDates[i - 1]);
          const dayDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / 86400000);
          
          if (dayDiff === 1) {
            streak_days++;
          } else {
            break;
          }
        }
      }
    }

    const activity_factor = Math.min(events_last_7d / 20, 1);
    const streak_factor = Math.min(streak_days / 7, 1);
    let churn_score = 1 - ((0.6 * activity_factor) + (0.4 * streak_factor));
    
    churn_score = Math.max(0, Math.min(1, churn_score));

    let prediction_reason = "";
    if (churn_score >= 0.8) {
      if (events_last_7d === 0) {
        prediction_reason = "No activity in last 7 days - high churn risk";
      } else if (events_last_7d < 3) {
        prediction_reason = "Very low recent activity - high churn risk";
      } else {
        prediction_reason = "Inactive for 3+ days - high churn risk";
      }
    } else if (churn_score >= 0.6) {
      prediction_reason = "Low recent activity - moderate churn risk";
    } else if (churn_score >= 0.4) {
      prediction_reason = "Moderate activity - some churn risk";
    } else if (churn_score >= 0.2) {
      if (streak_days >= 5) {
        prediction_reason = "Strong return streak - low churn risk";
      } else {
        prediction_reason = "Good activity level - low churn risk";
      }
    } else {
      if (streak_days >= 7) {
        prediction_reason = "Excellent engagement streak - very low churn risk";
      } else {
        prediction_reason = "High activity level - very low churn risk";
      }
    }

    const { error: upsertError } = await supabase
      .from('user_churn_scores')
      .upsert({
        user_id,
        churn_score: Number(churn_score.toFixed(4)),
        last_activity,
        sessions_last_7d,
        events_last_7d,
        streak_days,
        prediction_reason,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error upserting churn score:', upsertError);
      return new Response(JSON.stringify({ error: "Failed to save churn score" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result: ChurnScoreResult = {
      success: true,
      churn_score: Number(churn_score.toFixed(4)),
      sessions_last_7d,
      events_last_7d,
      streak_days,
      last_activity,
      prediction_reason,
    };

    return new Response(JSON.stringify(result), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
