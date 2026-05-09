import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

interface CreateUserPayload {
  email: string;
  fullName: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
  subscriptionTier: 'none' | 'intelligence' | 'command_center' | 'enterprise';
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!supabaseServiceRoleKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set' }),
      };
    }

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
        body: JSON.stringify({ error: 'Only platform administrators can create users' }),
      };
    }

    const payload: CreateUserPayload = JSON.parse(event.body || '{}');
    const { email, fullName, password, role, subscriptionTier } = payload;

    if (!email || !fullName || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'email, fullName, and password are required' }),
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' }),
      };
    }

    if (!['admin', 'manager', 'user'].includes(role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid role. Must be admin, manager, or user' }),
      };
    }

    if (!['none', 'intelligence', 'command_center', 'enterprise'].includes(subscriptionTier)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid subscription tier' }),
      };
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: `A user with email ${email} already exists` }),
      };
    }

    // Create auth user via Supabase Admin API
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createAuthError || !authData.user) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: createAuthError?.message || 'Failed to create auth user' }),
      };
    }

    const newUserId = authData.user.id;

    // Determine profile values based on role
    const isAdmin = role === 'admin';
    const effectiveTier = isAdmin ? 'none' : subscriptionTier;
    const effectiveStatus = isAdmin ? 'inactive' : (subscriptionTier !== 'none' ? 'active' : 'inactive');

    // Create profile
    const { data: newProfile, error: profileCreateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        email,
        full_name: fullName,
        role,
        is_platform_admin: isAdmin,
        subscription_tier: effectiveTier,
        subscription_status: effectiveStatus,
        account_status: 'active',
        beta_status: 'approved',
        onboarding_status: 'not_started',
        two_factor_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileCreateError) {
      // Try to clean up auth user if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      } catch (cleanupError) {
        console.error('Failed to clean up auth user after profile creation failure:', cleanupError);
      }
      throw profileCreateError;
    }

    // If a subscription tier was assigned, create user_subscriptions record
    if (!isAdmin && subscriptionTier !== 'none') {
      const tierToPlanName: Record<string, string> = {
        'intelligence': 'Intelligence',
        'command_center': 'Command Center',
        'enterprise': 'Enterprise',
      };

      const planName = tierToPlanName[subscriptionTier];
      if (planName) {
        try {
          const { error: subInsertError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
              user_id: newUserId,
              plan_name: planName,
              status: 'active',
              metadata: { source: 'admin_created', created_by: caller.id },
            });
          if (subInsertError) {
            console.error('Failed to create user_subscriptions (non-fatal):', subInsertError);
          }
        } catch (subError) {
          console.error('Failed to create user_subscriptions (non-fatal):', subError);
        }
      }
    }

    // Audit log
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: caller.id,
        target_user_id: newUserId,
        action: 'user_created',
        details: {
          email,
          full_name: fullName,
          role,
          subscription_tier: effectiveTier,
          subscription_status: effectiveStatus,
          created_by: callerProfile.email,
        },
        ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || null,
        user_agent: event.headers['user-agent'] || null,
      });
    } catch (auditError) {
      console.error('Failed to write audit log:', auditError);
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        user: newProfile,
        message: `User ${email} created successfully`,
      }),
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create user',
      }),
    };
  }
};
