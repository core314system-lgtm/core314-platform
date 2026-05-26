
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface IntegrationEvent {
  service_name: string;
  event_type: string;
  payload: Record<string, any>;
  user_id?: string;
}

/**
 * Log an integration event to the integration_events table
 * Uses service role to bypass RLS
 */
export async function logEvent(
  supabaseAdmin: SupabaseClient,
  event: IntegrationEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('integration_events')
      .insert({
        service_name: event.service_name,
        event_type: event.event_type,
        payload: event.payload,
        user_id: event.user_id || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging integration event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception logging integration event:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Verify that the authenticated user is a platform admin
 * Returns the user ID if admin, throws error otherwise
 */
export async function requireAdmin(
  supabaseClient: SupabaseClient
): Promise<string> {
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Unauthorized: No valid authentication');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Unauthorized: Profile not found');
  }

  if (!profile.is_platform_admin) {
    throw new Error('Forbidden: Platform administrator access required');
  }

  return user.id;
}

/**
 * Post a message to Microsoft Teams webhook
 */
export async function postToTeams(
  message: string,
  webhookUrl: string,
  title?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title || 'Core314 Alert',
      themeColor: '0078D4',
      title: title || 'Core314 Alert',
      text: message,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Teams webhook error:', errorText);
      return { success: false, error: `Teams API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception posting to Teams:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Post a message to Slack webhook
 */
export async function postToSlack(
  message: string,
  webhookUrl: string,
  title?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      text: title ? `*${title}*\n${message}` : message,
      mrkdwn: true,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack webhook error:', errorText);
      return { success: false, error: `Slack API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception posting to Slack:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Create a Supabase admin client with service role
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create a Supabase client from user JWT in Authorization header
 */
export function createUserClient(authHeader: string | null): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Verify internal webhook token for mock/test endpoints
 */
export function verifyInternalToken(authHeader: string | null): boolean {
  const internalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');
  
  if (!internalToken) {
    console.warn('INTERNAL_WEBHOOK_TOKEN not set - webhook endpoint is unprotected!');
    return true; // Allow in development if not set
  }

  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === internalToken;
}
