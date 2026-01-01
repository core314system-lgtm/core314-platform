import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
});

interface DeleteUserPayload {
  user_id: string;
  mode: 'soft' | 'hard';
  reason?: string;
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !caller) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin, email')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile?.is_platform_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only platform administrators can delete users' }),
      };
    }

    const payload: DeleteUserPayload = JSON.parse(event.body || '{}');
    const { user_id, mode, reason } = payload;

    if (!user_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'user_id is required' }),
      };
    }

    if (!mode || !['soft', 'hard'].includes(mode)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'mode must be "soft" or "hard"' }),
      };
    }

    if (user_id === caller.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'You cannot delete your own account' }),
      };
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, is_platform_admin, stripe_customer_id, stripe_subscription_id')
      .eq('id', user_id)
      .single();

    if (targetError || !targetUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
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
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'Cannot delete the last platform administrator' }),
        };
      }
    }

    let stripeSubscriptionsCanceled = 0;
    const stripeErrors: string[] = [];

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
        } catch (stripeError) {
          const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown error';
          stripeErrors.push(`Failed to cancel subscription ${sub.stripe_subscription_id}: ${errorMsg}`);
        }
      }
    }

    const { data: addons } = await supabaseAdmin
      .from('user_addons')
      .select('stripe_subscription_id')
      .eq('user_id', user_id)
      .in('status', ['active', 'trialing', 'past_due']);

    for (const addon of addons || []) {
      if (addon.stripe_subscription_id && !addon.stripe_subscription_id.startsWith('test_')) {
        try {
          await stripe.subscriptions.cancel(addon.stripe_subscription_id);
          stripeSubscriptionsCanceled++;
        } catch (stripeError) {
          const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown error';
          stripeErrors.push(`Failed to cancel add-on ${addon.stripe_subscription_id}: ${errorMsg}`);
        }
      }
    }

    if (mode === 'hard' && stripeErrors.length > 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to cancel all Stripe subscriptions. Hard delete blocked to prevent orphaned state.',
          stripe_errors: stripeErrors,
        }),
      };
    }

    if (mode === 'soft') {
      try {
        await supabaseAdmin.auth.admin.signOut(user_id, 'global');
      } catch (signOutError) {
        console.error('Failed to revoke sessions:', signOutError);
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
    } else {
      try {
        await supabaseAdmin.auth.admin.signOut(user_id, 'global');
      } catch (signOutError) {
        console.error('Failed to revoke sessions:', signOutError);
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) {
        throw deleteError;
      }
    }

    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: caller.id,
        target_user_id: user_id,
        action: mode === 'soft' ? 'user_soft_deleted' : 'user_hard_deleted',
        details: {
          target_email: targetUser.email,
          target_name: targetUser.full_name,
          reason: reason || 'No reason provided',
          stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
          stripe_errors: stripeErrors.length > 0 ? stripeErrors : undefined,
          performed_by: callerProfile.email,
        },
        ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || null,
        user_agent: event.headers['user-agent'] || null,
      });
    } catch (auditError) {
      console.error('Failed to write audit log:', auditError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: mode === 'soft'
          ? `User ${targetUser.email} has been soft deleted`
          : `User ${targetUser.email} has been permanently deleted`,
        stripe_subscriptions_canceled: stripeSubscriptionsCanceled,
        stripe_errors: stripeErrors.length > 0 ? stripeErrors : undefined,
      }),
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to delete user',
      }),
    };
  }
};
