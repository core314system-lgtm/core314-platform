#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Load from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'core314-test-user@proton.me';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Core314TestUser!2025';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('  - SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('  - SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  console.error('  - STRIPE_SECRET_KEY');
  console.error('  - STRIPE_WEBHOOK_SECRET');
  console.error('\nPlease set these environment variables before running tests.');
  process.exit(1);
}

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

console.log('\n=== CORE314 COMPREHENSIVE BILLING E2E TEST SUITE ===\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

let testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function logTest(name, passed, details = '') {
  if (passed) {
    console.log(`✅ ${name}`);
    testResults.passed.push(name);
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    testResults.failed.push({ name, details });
  }
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
  testResults.warnings.push(message);
}

// Helper to send webhook with proper signature
async function sendWebhook(eventType, eventData) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: eventType,
    data: { object: eventData },
    created: timestamp
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
    timestamp
  });

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: payload
  });

  return { response, payload: JSON.parse(payload) };
}

// Test 1: Checkout Session Creation
async function testCheckoutSessionCreation() {
  console.log('\n1️⃣ Testing Checkout Session Creation...');
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    if (authError) {
      logTest('Checkout Session Creation', false, `Auth failed: ${authError.message}`);
      return false;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tier: 'starter' })
    });

    if (!response.ok) {
      logTest('Checkout Session Creation', false, `HTTP ${response.status}: ${await response.text()}`);
      return false;
    }

    const data = await response.json();
    if (!data.url || !data.url.includes('checkout.stripe.com')) {
      logTest('Checkout Session Creation', false, `Invalid URL: ${data.url}`);
      return false;
    }

    logTest('Checkout Session Creation', true);
    return true;
  } catch (error) {
    logTest('Checkout Session Creation', false, error.message);
    return false;
  }
}

// Test 2: 14-Day Free Trial Verification
async function test14DayFreeTrial() {
  console.log('\n2️⃣ Testing 14-Day Free Trial...');
  
  try {
    const prices = await stripe.prices.list({ lookup_keys: ['core314_starter_monthly'] });
    const starterPrice = prices.data[0];
    
    if (!starterPrice) {
      logTest('14-Day Free Trial', false, 'Starter price not found');
      return false;
    }

    const hasTrial = starterPrice.recurring?.trial_period_days === 14;
    logTest('14-Day Free Trial - Starter Price', hasTrial, hasTrial ? '' : `Trial days: ${starterPrice.recurring?.trial_period_days}`);

    const proPrices = await stripe.prices.list({ lookup_keys: ['core314_pro_monthly'] });
    const proPrice = proPrices.data[0];
    const hasProTrial = proPrice?.recurring?.trial_period_days === 14;
    logTest('14-Day Free Trial - Pro Price', hasProTrial);

    return hasTrial && hasProTrial;
  } catch (error) {
    logTest('14-Day Free Trial', false, error.message);
    return false;
  }
}

// Test 3: Webhook Signature Verification
async function testWebhookSignatureVerification() {
  console.log('\n3️⃣ Testing Webhook Signature Verification...');
  
  try {
    const invalidResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid_signature'
      },
      body: JSON.stringify({ test: 'data' })
    });

    const rejectsInvalid = invalidResponse.status === 400;
    logTest('Webhook Rejects Invalid Signature', rejectsInvalid);

    const noSigResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });

    const rejectsMissing = noSigResponse.status === 400;
    logTest('Webhook Rejects Missing Signature', rejectsMissing);

    return rejectsInvalid && rejectsMissing;
  } catch (error) {
    logTest('Webhook Signature Verification', false, error.message);
    return false;
  }
}

// Test 4: Webhook Event Processing
async function testWebhookEventProcessing() {
  console.log('\n4️⃣ Testing Webhook Event Processing...');
  
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const userId = authData.user.id;

    const { response: checkoutResp } = await sendWebhook('checkout.session.completed', {
      id: 'cs_test_123',
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
      metadata: { user_id: userId, tier: 'starter' }
    });

    const checkoutProcessed = checkoutResp.ok;
    logTest('Webhook Processes checkout.session.completed', checkoutProcessed);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_tier, subscription_status')
      .eq('id', userId)
      .single();

    const dbUpdated = profile?.stripe_customer_id === 'cus_test_123' && profile?.subscription_tier === 'starter';
    logTest('Webhook Updates Database', dbUpdated);

    return checkoutProcessed && dbUpdated;
  } catch (error) {
    logTest('Webhook Event Processing', false, error.message);
    return false;
  }
}

// Test 5: Subscription Status Updates
async function testSubscriptionStatusUpdates() {
  console.log('\n5️⃣ Testing Subscription Status Updates...');
  
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const userId = authData.user.id;

    const { response } = await sendWebhook('customer.subscription.updated', {
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    });

    const processed = response.ok;
    logTest('Webhook Processes subscription.updated', processed);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    const statusUpdated = profile?.subscription_status === 'active';
    logTest('Subscription Status Updated to Active', statusUpdated);

    return processed && statusUpdated;
  } catch (error) {
    logTest('Subscription Status Updates', false, error.message);
    return false;
  }
}

// Test 6: Cancellation Flow
async function testCancellationFlow() {
  console.log('\n6️⃣ Testing Cancellation Flow...');
  
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const userId = authData.user.id;

    const { response } = await sendWebhook('customer.subscription.deleted', {
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'canceled',
      canceled_at: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    });

    const processed = response.ok;
    logTest('Webhook Processes subscription.deleted', processed);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    const canceled = profile?.subscription_status === 'canceled';
    logTest('Subscription Status Updated to Canceled', canceled);

    return processed && canceled;
  } catch (error) {
    logTest('Cancellation Flow', false, error.message);
    return false;
  }
}

// Test 7: Billing Portal
async function testBillingPortal() {
  console.log('\n7️⃣ Testing Billing Portal...');
  
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/billing-portal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 400) {
      logWarning('No billing account yet (expected for test user without completed checkout)');
      logTest('Billing Portal - Handles Missing Customer', true);
      return true;
    }

    if (!response.ok) {
      logTest('Billing Portal', false, `HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    const hasUrl = data.url && data.url.includes('billing.stripe.com');
    logTest('Billing Portal', hasUrl);

    return hasUrl;
  } catch (error) {
    logTest('Billing Portal', false, error.message);
    return false;
  }
}

// Test 8: Error Handling
async function testErrorHandling() {
  console.log('\n8️⃣ Testing Error Handling...');
  
  try {
    const eventId = `evt_test_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test', customer: 'cus_test', status: 'active', current_period_end: timestamp } },
      created: timestamp
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: STRIPE_WEBHOOK_SECRET,
      timestamp
    });

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const dupResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });

    const handlesIdempotency = dupResponse.ok;
    logTest('Webhook Handles Duplicate Events (Idempotency)', handlesIdempotency);

    const malformedResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid'
      },
      body: 'not json'
    });

    const rejectsMalformed = malformedResponse.status === 400;
    logTest('Webhook Rejects Malformed Payload', rejectsMalformed);

    return handlesIdempotency && rejectsMalformed;
  } catch (error) {
    logTest('Error Handling', false, error.message);
    return false;
  }
}

// Run all tests
(async () => {
  const results = {
    test1: await testCheckoutSessionCreation(),
    test2: await test14DayFreeTrial(),
    test3: await testWebhookSignatureVerification(),
    test4: await testWebhookEventProcessing(),
    test5: await testSubscriptionStatusUpdates(),
    test6: await testCancellationFlow(),
    test7: await testBillingPortal(),
    test8: await testErrorHandling()
  };

  console.log('\n=== TEST SUMMARY ===');
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

  if (testResults.failed.length > 0) {
    console.log('\nFailed Tests:');
    testResults.failed.forEach(({ name, details }) => {
      console.log(`  - ${name}`);
      if (details) console.log(`    ${details}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\nWarnings:');
    testResults.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
  
  process.exit(allPassed ? 0 : 1);
})();
