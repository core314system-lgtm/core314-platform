import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { withSentry, handleSentryTest } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteUserPayload {
  user_id: string;
  mode: 'soft' | 'hard';
  reason?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin, email')
      .eq('id', caller.id)
      .single();

    if (callerProfileError || !callerProfile?.is_platform_admin) {
      return new Response(JSON.stringify({ error: 'Only platform administrators can delete users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: DeleteUserPayload = await req.json();
    const { user_id, mode, reason } = payload;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mode || !['soft', 'hard'].includes(mode)) {
      return new Response(JSON.stringify({ error: 'mode must be "soft" or "hard"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, is_platform_admin, stripe_customer_id, stripe_subscription_id')
      .eq('id', user_id)
      .single();

    if (targetError || !targetUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetUser.is_platform_admin) {
      const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_platform_admin', true);

      if (countError) {
        throw countError;
      }

      if (count === 1) {
        return new Response(JSON.stringify({ error: 'Cannot delete the last platform administrator' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CORE314_STRIPE_SECRET_KEY') || '';
    let stripeSubscriptionsCanceled = 0;
    let stripeErrors: string[] = [];

    if (stripeSecretKey) {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      const { data: subscriptions } = await supabaseAdmin
        .from('user_subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', user_id)
        .in('status', ['active', 'trialing', 'past_due']);

      for (const sub of subscriptions || []) {
        if (sub.stripe_subscription_id && !sub.stripe_subscription_id.startsWith('test_')) {
          try {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            stripeSubscriptionsCanceled++;
            console.log(`Canceled subscription: ${sub.stripe_subscription_id}`);
          } catch (stripeError) {
            const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
            stripeErrors.push(`Failed to cancel subscription ${sub.stripe_subscription_id}: ${errorMsg}`);
            console.error(`Failed to cancel subscription ${sub.stripe_subscription_id}:`, stripeError);
          }
        }
      }

      const { data: addons } = await supabaseAdmin
        .from('user_addons')
        .select('stripe_subscription_id')
        .eq('user_id', user_id)
        .eq('status', 'active');

      for (const addon of addons || []) {
        if (addon.stripe_subscription_id && !addon.stripe_subscription_id.startsWith('test_')) {
          try {
            await stripe.subscriptions.cancel(addon.stripe_subscription_id);
            stripeSubscriptionsCanceled++;
            console.log(`Canceled addon subscription: ${addon.stripe_subscription_id}`);
          } catch (stripeError) {
            const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
            stripeErrors.push(`Failed to cancel addon ${addon.stripe_subscription_id}: ${errorMsg}`);
            console.error(`Failed to cancel addon subscription ${addon.stripe_subscription_id}:`, stripeError);
          }
        }
      }

      if (stripeErrors.length > 0 && mode === 'hard') {
        return new Response(JSON.stringify({ 
          error: 'Failed to cancel all Stripe subscriptions. Cannot proceed with hard delete.',
          stripe_errors: stripeErrors 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (mode === 'soft') {
      try {
        await supabaseAdmin.auth.admin.signOut(user_id, 'global');
        console.log(`Revoked sessions for user: ${user_id}`);
      } catch (signOutError) {
        console.error(`Failed to revoke sessions for user ${user_id}:`, signOutError);
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          deleted_at: new Date().toISOString(),
          account_status: 'inactive',
          subscription_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (updateError) {
        throw updateError;
      }

      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)
        .in('status', ['active', 'trialing', 'past_due']);

      await supabaseAdmin
        .from('user_addons')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)
        .eq('status', 'active');

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: caller.id,
        target_user_id: user_id,
        action: 'user_soft_deleted',
        details: {
          target_email: targetUser.email,
          target_name: targetUser.full_name,
          reason: reason || 'No reason provided',
          stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
          stripe_errors: stripeErrors.length > 0 ? stripeErrors : undefined,
          performed_by: callerProfile.email,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        mode: 'soft',
        user_id,
        message: 'User has been soft-deleted',
        stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      try {
        await supabaseAdmin.auth.admin.signOut(user_id, 'global');
        console.log(`Revoked sessions for user: ${user_id}`);
      } catch (signOutError) {
        console.error(`Failed to revoke sessions for user ${user_id}:`, signOutError);
      }

      const { data: orgMemberships } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user_id);

      const { data: ownedOrgs } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('owner_id', user_id);

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: caller.id,
        target_user_id: user_id,
        action: 'user_hard_deleted',
        details: {
          target_email: targetUser.email,
          target_name: targetUser.full_name,
          reason: reason || 'No reason provided',
          stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
          org_memberships_count: orgMemberships?.length || 0,
          owned_organizations: ownedOrgs?.map(o => ({ id: o.id, name: o.name })) || [],
          performed_by: callerProfile.email,
        },
      });

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) {
        console.error(`Failed to delete user ${user_id}:`, deleteError);
        throw deleteError;
      }

      console.log(`Hard deleted user: ${user_id}`);

      return new Response(JSON.stringify({
        success: true,
        mode: 'hard',
        user_id,
        message: 'User has been permanently deleted',
        stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
        org_memberships_removed: orgMemberships?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to delete user',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: 'delete-user' }));
