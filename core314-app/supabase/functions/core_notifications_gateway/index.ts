
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_id: string;
  rule_id?: string;
  type: 'alert' | 'notify' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  action_url?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const notificationData: NotificationRequest = await req.json();

    if (!notificationData.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!notificationData.type) {
      return new Response(
        JSON.stringify({ error: 'type is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!notificationData.title || !notificationData.message) {
      return new Response(
        JSON.stringify({ error: 'title and message are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const severity = notificationData.severity || (
      notificationData.type === 'alert' ? 'high' :
      notificationData.type === 'error' ? 'high' :
      notificationData.type === 'warning' ? 'medium' :
      'low'
    );

    const { data, error } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: notificationData.user_id,
        rule_id: notificationData.rule_id || null,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        severity: severity,
        status: 'unread',
        action_url: notificationData.action_url || null,
        metadata: notificationData.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create notification',
          details: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }


    return new Response(
      JSON.stringify({
        success: true,
        notification: data,
        message: 'Notification created successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
