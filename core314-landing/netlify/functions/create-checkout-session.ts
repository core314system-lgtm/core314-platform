import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { isDisposableDomain, isConsumerDomain, extractDomain } from './lib/disposable-domains';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// Supabase client with service role for backend-only access to trial_attempts
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Expected price amounts in cents (source of truth: shared/pricing.ts)
// Starter (Observe) = $199/month = 19900 cents
// Pro (Analyze) = $999/month = 99900 cents
const EXPECTED_PRICE_AMOUNTS: Record<string, number> = {
  starter: 19900, // $199/month
  pro: 99900,     // $999/month
};

// Plans eligible for 14-day free trial
// Both Starter and Pro get trials; Enterprise is custom/contact-sales
const TRIAL_ELIGIBLE_PLANS = ['starter', 'pro'];

// Trial abuse protection constants
const MAX_TRIALS_PER_IP_30_DAYS = 2;

/**
 * Hash email for logging (privacy-preserving)
 */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
}

/**
 * Get client IP address from Netlify function event
 * Netlify provides x-nf-client-connection-ip header
 */
function getClientIP(event: any): string {
  // Netlify-specific header (most reliable)
  const netlifyIP = event.headers['x-nf-client-connection-ip'];
  if (netlifyIP) return netlifyIP;
  
  // Fallback to x-forwarded-for (first IP in chain)
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    if (ips[0]) return ips[0];
  }
  
  // Last resort fallback
  return event.headers['client-ip'] || 'unknown';
}

/**
 * Structured logging for trial events (server-side only)
 */
function logTrialEvent(
  eventType: 'trial_blocked_email' | 'trial_blocked_domain' | 'trial_blocked_ip' | 'trial_blocked_disposable' | 'trial_allowed',
  data: { email: string; domain: string; ipAddress: string; reason?: string }
) {
  const logEntry = {
    event: eventType,
    email_hash: hashEmail(data.email),
    domain: data.domain,
    ip_address: data.ipAddress,
    timestamp: new Date().toISOString(),
    reason: data.reason || eventType,
  };
  console.log('TRIAL_EVENT:', JSON.stringify(logEntry));
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { plan, addons = [], email, userId } = JSON.parse(event.body || '{}');

    if (!plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Plan is required' }),
      };
    }

    const planLower = plan.toLowerCase();
    
    // Validate plan is supported
    if (!['starter', 'pro'].includes(planLower)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan' }),
      };
    }

    // ========================================
    // TRIAL ABUSE PROTECTION CHECKS
    // Must pass ALL checks before Stripe Checkout session is created
    // ========================================
    
    // Only enforce trial checks for trial-eligible plans
    const isTrialEligible = TRIAL_ELIGIBLE_PLANS.includes(planLower);
    
    if (isTrialEligible && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const domain = extractDomain(normalizedEmail);
      const clientIP = getClientIP(event);
      
      if (!domain) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email address.' }),
        };
      }
      
      // CHECK 0: Block disposable/temporary email domains
      if (isDisposableDomain(domain)) {
        logTrialEvent('trial_blocked_disposable', {
          email: normalizedEmail,
          domain,
          ipAddress: clientIP,
          reason: 'Disposable email domain blocked',
        });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Please use a valid business or personal email address.' }),
        };
      }
      
      // CHECK 1: One free trial per EMAIL (lifetime)
      const { data: emailCheck, error: emailError } = await supabase
        .from('trial_attempts')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1);
      
      if (emailError) {
        console.error('Trial check error (email):', emailError);
        // Don't block on DB errors - fail open but log
      } else if (emailCheck && emailCheck.length > 0) {
        logTrialEvent('trial_blocked_email', {
          email: normalizedEmail,
          domain,
          ipAddress: clientIP,
          reason: 'Email already used for trial',
        });
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'A free trial has already been used for this account.' }),
        };
      }
      
      // CHECK 2: One free trial per COMPANY DOMAIN (lifetime)
      // EXCEPTION: Consumer domains (Gmail, Outlook, Yahoo) are exempt from domain rule
      if (!isConsumerDomain(domain)) {
        const { data: domainCheck, error: domainError } = await supabase
          .from('trial_attempts')
          .select('id')
          .eq('domain', domain)
          .limit(1);
        
        if (domainError) {
          console.error('Trial check error (domain):', domainError);
          // Don't block on DB errors - fail open but log
        } else if (domainCheck && domainCheck.length > 0) {
          logTrialEvent('trial_blocked_domain', {
            email: normalizedEmail,
            domain,
            ipAddress: clientIP,
            reason: 'Domain already used for trial',
          });
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'A free trial has already been used for this account.' }),
          };
        }
      }
      
      // CHECK 3: Max 2 free trials per IP address per rolling 30-day window
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: ipCheck, error: ipError } = await supabase
        .from('trial_attempts')
        .select('id')
        .eq('ip_address', clientIP)
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      if (ipError) {
        console.error('Trial check error (IP):', ipError);
        // Don't block on DB errors - fail open but log
      } else if (ipCheck && ipCheck.length >= MAX_TRIALS_PER_IP_30_DAYS) {
        logTrialEvent('trial_blocked_ip', {
          email: normalizedEmail,
          domain,
          ipAddress: clientIP,
          reason: `IP exceeded ${MAX_TRIALS_PER_IP_30_DAYS} trials in 30 days`,
        });
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Too many free trials have been created from this network. Please contact support.' }),
        };
      }
      
      // ALL CHECKS PASSED - Record this trial attempt
      const { error: insertError } = await supabase
        .from('trial_attempts')
        .insert({
          email: normalizedEmail,
          domain,
          ip_address: clientIP,
        });
      
      if (insertError) {
        console.error('Failed to record trial attempt:', insertError);
        // Don't block on insert errors - proceed with checkout
      }
      
      logTrialEvent('trial_allowed', {
        email: normalizedEmail,
        domain,
        ipAddress: clientIP,
        reason: 'All trial abuse checks passed',
      });
    }
    
    // ========================================
    // END TRIAL ABUSE PROTECTION CHECKS
    // ========================================

    // Get expected amount for this plan (source of truth)
    const expectedAmount = EXPECTED_PRICE_AMOUNTS[planLower];
    
    let selectedPrice: Stripe.Price | undefined;
    let allPricesForDiagnostics: Stripe.Price[] = [];

    if (planLower === 'starter') {
      // STARTER: Use lookup_key (known to work in production)
      const prices = await stripe.prices.list({
        lookup_keys: ['starter_monthly'],
        limit: 10,
        active: true,
      });
      allPricesForDiagnostics = prices.data;
      
      // Find exact match: active + USD + monthly + $199
      selectedPrice = prices.data.find(p => 
        p.active &&
        p.currency === 'usd' &&
        p.recurring?.interval === 'month' &&
        p.unit_amount === expectedAmount
      );
    } else if (planLower === 'pro') {
      // PRO: Deterministic search by price attributes (lookup_key not set in Stripe)
      // Fetch all active recurring prices and filter deterministically
      const prices = await stripe.prices.list({
        active: true,
        type: 'recurring',
        limit: 100,
      });
      allPricesForDiagnostics = prices.data;
      
      // Find exact match: active + USD + monthly + $999
      // This is deterministic because there should be exactly one price matching all criteria
      selectedPrice = prices.data.find(p => 
        p.active &&
        p.currency === 'usd' &&
        p.recurring?.interval === 'month' &&
        p.unit_amount === expectedAmount
      );
    }

    // If no exact match found, log diagnostics and return error
    if (!selectedPrice) {
      // Log full diagnostic info server-side only
      const diagnosticInfo = allPricesForDiagnostics.map(p => ({
        id: p.id,
        unit_amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval,
        active: p.active,
        livemode: p.livemode,
      }));
      
      console.error(
        'PRO PRICE RESOLUTION FAILED:',
        'Plan:', planLower,
        'Expected amount (cents):', expectedAmount,
        'Total prices returned:', allPricesForDiagnostics.length,
        'All prices:', JSON.stringify(diagnosticInfo, null, 2)
      );
      
      // Return user-safe error (no Stripe internals exposed)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `Unable to load pricing for ${plan} plan. Please try again or contact support.`,
        }),
      };
    }

    const priceId = selectedPrice.id;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    if (addons && addons.length > 0) {
      for (const addon of addons) {
        const addonPrices = await stripe.prices.list({
          lookup_keys: [addon.lookupKey],
          limit: 1,
        });

        if (addonPrices.data && addonPrices.data.length > 0) {
          lineItems.push({
            price: addonPrices.data[0].id,
            quantity: addon.quantity || 1,
          });
        }
      }
    }

    // isTrialEligible already determined above during trial abuse checks

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${process.env.URL || 'https://core314.com'}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://core314.com'}/pricing`,
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        // 14-day free trial for Starter and Pro plans
        // Stripe Checkout will show "14 days free" and "$0 due today"
        ...(isTrialEligible && { trial_period_days: 14 }),
        metadata: {
          plan,
          userId: userId || '',
        },
      },
      metadata: {
        plan,
        userId: userId || '',
      },
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
    };
  }
};
