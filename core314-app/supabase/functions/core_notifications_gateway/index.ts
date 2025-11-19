
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry@7.119.0/index.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    release: 'phase59-action-debug',
    tracesSampleRate: 0.1,
  });
}

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

interface NotificationRecord {
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  metadata?: string;
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

    const enrichedMetadata = {
      ...(notificationData.metadata || {}),
      rule_id: notificationData.rule_id || null,
      severity: severity,
      triggered_at: new Date().toISOString(),
    };

    const notification: NotificationRecord = {
      user_id: notificationData.user_id,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      is_read: false,
      action_url: notificationData.action_url || null,
      metadata: JSON.stringify(enrichedMetadata),
    };

    const { data, error } = await supabaseClient
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      
      if (SENTRY_DSN) {
        Sentry.captureException(error, {
          extra: {
            function: 'core_notifications_gateway',
            user_id: notificationData.user_id,
            notification_type: notificationData.type,
            error_code: error.code,
            error_details: error.details,
            error_hint: error.hint,
          },
          tags: {
            function: 'core_notifications_gateway',
            error_type: 'database_insert',
          },
        });
        await Sentry.flush(2000);
      }
      
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
    
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          function: 'core_notifications_gateway',
          error_message: error.message,
          error_stack: error.stack,
        },
        tags: {
          function: 'core_notifications_gateway',
          error_type: 'unexpected',
        },
      });
      await Sentry.flush(2000);
    }
    
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
