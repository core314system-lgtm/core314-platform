import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status');

    const activeSubscriptions = {
      starter: 0,
      professional: 0,
      enterprise: 0,
    };

    let mrr = 0;

    if (profiles) {
      profiles.forEach((profile) => {
        if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
          if (profile.subscription_tier === 'starter') {
            activeSubscriptions.starter++;
            mrr += 99;
          } else if (profile.subscription_tier === 'professional') {
            activeSubscriptions.professional++;
            mrr += 299;
          } else if (profile.subscription_tier === 'enterprise') {
            activeSubscriptions.enterprise++;
            mrr += 999;
          }
        }
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        mrr,
        activeSubscriptions,
        failedPayments: 0,
        trialConversions: 0,
      }),
    };
  } catch (err) {
    console.error('Billing metrics error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch billing metrics' }),
    };
  }
};
