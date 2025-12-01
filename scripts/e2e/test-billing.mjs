#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjU0MjYsImV4cCI6MjA0NjUwMTQyNn0.lKzNvVYOLhAnii_VPXqCEqPOSHQXBTEVwFLqTGxKkqI';
console.log('\n=== CORE314 BILLING E2E TEST SUITE ===\n');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function testCheckoutSession() {
  console.log('1️⃣ Testing create-checkout-session...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: 'core314-test-user@proton.me', password: 'Core314TestUser!2025' });
  if (authError) { console.error('❌ Auth failed:', authError.message); return false; }
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, { method: 'POST', headers: { 'Authorization': `Bearer ${authData.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'starter' }) });
  if (!response.ok) { console.error('❌ Checkout failed:', response.status, await response.text()); return false; }
  const data = await response.json();
  if (!data.url || !data.url.includes('checkout.stripe.com')) { console.error('❌ Invalid checkout URL:', data.url); return false; }
  console.log('✅ Checkout session created:', data.url.substring(0, 50) + '...');
  return true;
}
async function testBillingPortal() {
  console.log('\n2️⃣ Testing billing-portal...');
  const { data: authData } = await supabase.auth.signInWithPassword({ email: 'core314-test-user@proton.me', password: 'Core314TestUser!2025' });
  const response = await fetch(`${SUPABASE_URL}/functions/v1/billing-portal`, { method: 'POST', headers: { 'Authorization': `Bearer ${authData.session.access_token}`, 'Content-Type': 'application/json' } });
  if (response.status === 400) { console.log('⚠️  No billing account yet (expected for new user)'); return true; }
  if (!response.ok) { console.error('❌ Portal failed:', response.status); return false; }
  console.log('✅ Billing portal URL generated');
  return true;
}
async function testSubscriptionFields() {
  console.log('\n3️⃣ Testing subscription fields in database...');
  const { data: authData } = await supabase.auth.signInWithPassword({ email: 'core314-test-user@proton.me', password: 'Core314TestUser!2025' });
  const { data: profile, error } = await supabase.from('profiles').select('stripe_customer_id, subscription_tier, subscription_status').eq('id', authData.user.id).single();
  if (error) { console.error('❌ Failed to query profile:', error.message); return false; }
  console.log('✅ Subscription fields exist:', { has_customer_id: !!profile.stripe_customer_id, tier: profile.subscription_tier || 'free', status: profile.subscription_status || 'inactive' });
  return true;
}
(async () => {
  const results = { checkout: await testCheckoutSession(), portal: await testBillingPortal(), fields: await testSubscriptionFields() };
  console.log('\n=== TEST SUMMARY ===');
  console.log('Checkout Session:', results.checkout ? '✅ PASS' : '❌ FAIL');
  console.log('Billing Portal:', results.portal ? '✅ PASS' : '❌ FAIL');
  console.log('Database Fields:', results.fields ? '✅ PASS' : '❌ FAIL');
  const allPassed = Object.values(results).every(r => r);
  console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  process.exit(allPassed ? 0 : 1);
})();
