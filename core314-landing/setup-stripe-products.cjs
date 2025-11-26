#!/usr/bin/env node

/**
 * Setup script to create Stripe products and prices
 * Run with: STRIPE_SECRET_KEY=sk_test_... node setup-stripe-products.js
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function setupProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  try {
    console.log('Creating Starter plan...');
    const starterProduct = await stripe.products.create({
      name: 'Core314 Starter',
      description: 'Perfect for small teams getting started with unified dashboards and 2 integrations',
      metadata: {
        plan: 'starter',
        integrations: '2',
      },
    });

    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 9900, // $99.00
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 14,
      },
      lookup_key: 'starter_monthly',
      metadata: {
        plan: 'starter',
      },
    });

    console.log(`✅ Starter: ${starterProduct.id} / ${starterPrice.id}`);
    console.log(`   Lookup key: starter_monthly\n`);

    console.log('Creating Pro plan...');
    const proProduct = await stripe.products.create({
      name: 'Core314 Pro',
      description: 'For growing businesses with 10 integrations, Proactive Optimization Engine™, and advanced analytics',
      metadata: {
        plan: 'pro',
        integrations: '10',
      },
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 99900, // $999.00
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 14,
      },
      lookup_key: 'pro_monthly',
      metadata: {
        plan: 'pro',
      },
    });

    console.log(`✅ Pro: ${proProduct.id} / ${proPrice.id}`);
    console.log(`   Lookup key: pro_monthly\n`);

    console.log('Creating Additional Integration (Starter) add-on...');
    const addonStarterProduct = await stripe.products.create({
      name: 'Additional Integration (Starter)',
      description: 'Connect more business apps on Starter plan',
      metadata: {
        addon: 'integration',
        plan: 'starter',
      },
    });

    const addonStarterPrice = await stripe.prices.create({
      product: addonStarterProduct.id,
      unit_amount: 7500, // $75.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      lookup_key: 'addon_integration_starter',
      metadata: {
        addon: 'integration',
        plan: 'starter',
      },
    });

    console.log(`✅ Add-on (Starter): ${addonStarterProduct.id} / ${addonStarterPrice.id}`);
    console.log(`   Lookup key: addon_integration_starter\n`);

    console.log('Creating Additional Integration (Pro) add-on...');
    const addonProProduct = await stripe.products.create({
      name: 'Additional Integration (Pro)',
      description: 'Connect more business apps on Pro plan',
      metadata: {
        addon: 'integration',
        plan: 'pro',
      },
    });

    const addonProPrice = await stripe.prices.create({
      product: addonProProduct.id,
      unit_amount: 5000, // $50.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      lookup_key: 'addon_integration_pro',
      metadata: {
        addon: 'integration',
        plan: 'pro',
      },
    });

    console.log(`✅ Add-on (Pro): ${addonProProduct.id} / ${addonProPrice.id}`);
    console.log(`   Lookup key: addon_integration_pro\n`);

    console.log('Creating Custom Integration setup...');
    const customProduct = await stripe.products.create({
      name: 'Custom Integration',
      description: 'Build a custom connector for your unique business needs',
      metadata: {
        addon: 'custom_integration',
      },
    });

    const customPrice = await stripe.prices.create({
      product: customProduct.id,
      unit_amount: 50000, // $500.00
      currency: 'usd',
      lookup_key: 'custom_integration_setup',
      metadata: {
        addon: 'custom_integration',
        type: 'one_time',
      },
    });

    console.log(`✅ Custom Integration: ${customProduct.id} / ${customPrice.id}`);
    console.log(`   Lookup key: custom_integration_setup\n`);

    console.log('✨ All products and prices created successfully!\n');
    console.log('📋 Summary:');
    console.log('   - Starter: $99/mo (14-day trial, 2 integrations)');
    console.log('   - Pro: $999/mo (14-day trial, 10 integrations)');
    console.log('   - Additional Integration (Starter): $75/mo');
    console.log('   - Additional Integration (Pro): $50/mo');
    console.log('   - Custom Integration: $500 one-time\n');
    console.log('🔗 Next steps:');
    console.log('   1. Configure Stripe webhook endpoint in dashboard');
    console.log('   2. Add environment variables to Netlify');
    console.log('   3. Deploy the updated site\n');

  } catch (error) {
    console.error('❌ Error setting up products:', error.message);
    process.exit(1);
  }
}

setupProducts();
