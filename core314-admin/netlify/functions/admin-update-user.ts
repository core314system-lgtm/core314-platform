import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

interface UpdateUserPayload {
  userId: string;
  role: 'admin' | 'manager' | 'user';
  subscriptionTier: 'none' | 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'inactive';
  twoFactorEnabled: boolean;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile?.is_platform_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only platform administrators can update users' }),
      };
    }

    const payload: UpdateUserPayload = JSON.parse(event.body || '{}');
    const { userId, role, subscriptionTier, subscriptionStatus, twoFactorEnabled } = payload;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    if (!['admin', 'manager', 'user'].includes(role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid role. Must be admin, manager, or user' }),
      };
    }

    if (!['none', 'starter', 'professional', 'enterprise'].includes(subscriptionTier)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid subscription tier' }),
      };
    }

    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !currentUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    if (currentUser.is_platform_admin && role !== 'admin') {
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
          body: JSON.stringify({ error: 'Cannot demote the last platform administrator' }),
        };
      }
    }

    const updateData: any = {
      role,
      two_factor_enabled: twoFactorEnabled,
      updated_at: new Date().toISOString(),
    };

    if (role === 'admin') {
      updateData.subscription_tier = 'none';
      updateData.subscription_status = 'inactive';
      updateData.is_platform_admin = true;
    } else {
      updateData.subscription_tier = subscriptionTier;
      updateData.subscription_status = subscriptionStatus;
      updateData.is_platform_admin = false;
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'admin_update_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: {
          changed_by: user.email,
          target_user: currentUser.email,
          changed_fields: Object.keys(updateData),
          previous_values: {
            role: currentUser.role,
            subscription_tier: currentUser.subscription_tier,
            subscription_status: currentUser.subscription_status,
            two_factor_enabled: currentUser.two_factor_enabled,
            is_platform_admin: currentUser.is_platform_admin,
          },
          new_values: updateData,
        },
      });
    } catch (auditError) {
      console.error('Failed to write audit log:', auditError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ user: updatedUser }),
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to update user' 
      }),
    };
  }
};
