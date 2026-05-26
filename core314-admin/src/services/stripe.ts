interface CheckoutParams {
  priceId: string;
  email?: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession({
  priceId,
  email,
  metadata = {},
}: CheckoutParams) {
  try {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        email,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    
    if (url) {
      window.location.href = url;
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
    const response = await fetch('/.netlify/functions/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { url } = await response.json();
    window.location.href = url;
  } catch (err) {
    console.error('Failed to create portal session:', err);
    throw err;
  }
}
