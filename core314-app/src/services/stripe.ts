import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';

// ============================================================================
// STRIPE CHECKOUT SERVICE
// ============================================================================
// Calls the stripe-create-checkout Edge Function to create a Stripe
// Checkout session. The Edge Function handles customer creation, plan
// mapping, and metadata — the frontend only needs to pass the plan name.
// ============================================================================

interface CheckoutParams {
  plan: 'intelligence' | 'command_center';
}

export async function createCheckoutSession({ plan }: CheckoutParams) {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated. Please log in first.');
    }

    const url = await getSupabaseFunctionUrl('stripe-create-checkout');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': session.access_token,
      },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Checkout failed (${response.status})`);
    }

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (err) {
    console.error('Failed to create checkout session:', err);
    throw err;
  }
}

export async function createPortalSession() {
  try {
    const supabase = await initSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated. Please log in first.');
    }

    const url = await getSupabaseFunctionUrl('stripe-create-portal');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': session.access_token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Portal session failed (${response.status})`);
    }

    const data = await response.json();
    window.location.href = data.url;
  } catch (err) {
    console.error('Failed to create portal session:', err);
    throw err;
  }
}
