import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapping from addon IDs (as used in AccountPlan.tsx) to Stripe Price env vars
// These are the 4 self-serve add-ons specified in the requirements
const ADDON_PRICE_MAP: Record<string, { envVar: string; category: string }> = {
  additional_integration_pro: {
    envVar: 'STRIPE_PRICE_ADDITIONAL_INTEGRATION_PRO',
    category: 'integration',
  },
  premium_analytics: {
    envVar: 'STRIPE_PRICE_PREMIUM_ANALYTICS',
    category: 'analytics',
  },
  advanced_fusion_ai: {
    envVar: 'STRIPE_PRICE_ADVANCED_FUSION_AI',
    category: 'ai_module',
  },
  data_export: {
    envVar: 'STRIPE_PRICE_DATA_EXPORT',
    category: 'custom',
  },
};

export const handler: Handler = async (event) => {
  // CORS headers for preflight requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { addonId, addonName, addonCategory, priceId } = body;

    // Support both new format (addonId) and legacy format (addonName from Billing.tsx)
    const resolvedAddonId = addonId || addonName?.toLowerCase().replace(/\s+/g, '_');

    // Get authorization header for user authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' }),
      };
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Get user's profile to find their email and org membership
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    // Get user's organization membership for org-level duplicate checking
    const { data: orgMembership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const orgId = orgMembership?.organization_id;

    // Determine the addon configuration
    const addonConfig = ADDON_PRICE_MAP[resolvedAddonId];
    
    // Get the Stripe Price ID - either from env var mapping or from request (for legacy Billing.tsx)
    let stripePriceId: string;
    let addonCategoryResolved: string;

    if (addonConfig) {
      // New flow: use env var mapping
      stripePriceId = process.env[addonConfig.envVar]!;
      addonCategoryResolved = addonConfig.category;
      
      if (!stripePriceId) {
        console.error(`Missing env var: ${addonConfig.envVar}`);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Add-on pricing not configured' }),
        };
      }
    } else if (priceId) {
      // Legacy flow: use priceId from request (for Billing.tsx compatibility)
      stripePriceId = priceId;
      addonCategoryResolved = addonCategory || 'custom';
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid add-on identifier' }),
      };
    }

    // Check if user (or anyone in their org) already has this addon active
    // This prevents duplicate purchases at the org level
    let existingAddonQuery = supabase
      .from('user_addons')
      .select('id, user_id, status')
      .eq('addon_name', resolvedAddonId || addonName)
      .eq('status', 'active');

    if (orgId) {
      // Check org-wide: any user in the same org with this addon
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId);

      if (orgMembers && orgMembers.length > 0) {
        const orgUserIds = orgMembers.map(m => m.user_id);
        existingAddonQuery = existingAddonQuery.in('user_id', orgUserIds);
      }
    } else {
      // No org, just check for this user
      existingAddonQuery = existingAddonQuery.eq('user_id', user.id);
    }

    const { data: existingAddon } = await existingAddonQuery.maybeSingle();

    if (existingAddon) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'This add-on is already active for your organization',
          alreadyActive: true,
        }),
      };
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId = profile.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: user.id,
          org_id: orgId || '',
        },
      });
      stripeCustomerId = customer.id;

      // Store the customer ID on the profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'addon',
        addon_name: resolvedAddonId || addonName,
        addon_category: addonCategoryResolved,
        user_id: user.id,
        org_id: orgId || '',
        source: 'core314_app',
      },
      subscription_data: {
        metadata: {
          kind: 'addon',
          addon_name: resolvedAddonId || addonName,
          addon_category: addonCategoryResolved,
          user_id: user.id,
          org_id: orgId || '',
        },
      },
      success_url: `${process.env.URL}/dashboard?billing_success=1&addon=${encodeURIComponent(resolvedAddonId || addonName)}`,
      cancel_url: `${process.env.URL}/account/plan?billing_cancelled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Addon checkout session creation error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    };
  }
};
