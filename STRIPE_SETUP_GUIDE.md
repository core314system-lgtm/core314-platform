# Core314 Stripe Integration Setup Guide

All the code is ready - you just need to provide credentials and run a few setup commands.

## 🚀 Step 1: Create Stripe Products and Prices

Run the setup script:

```bash
cd /home/ubuntu/core314-landing
STRIPE_SECRET_KEY=sk_test_YOUR_KEY node setup-stripe-products.js
```

Creates: Starter ($99/mo), Pro ($999/mo), Add-ons ($75/$50), Custom Integration ($500)

## 🗄️ Step 2: Set Up Supabase Database

1. Go to Supabase → SQL Editor
2. Copy contents of `supabase-schema.sql`
3. Execute the SQL

## 🔐 Step 3: Configure Netlify Environment Variables

```bash
netlify env:set STRIPE_SECRET_KEY "sk_test_YOUR_KEY"
netlify env:set VITE_STRIPE_PUBLISHABLE_KEY "pk_test_YOUR_KEY"
netlify env:set SUPABASE_URL "https://YOUR_PROJECT.supabase.co"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "YOUR_SERVICE_ROLE_KEY"
netlify env:set VITE_SUPABASE_URL "https://YOUR_PROJECT.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "YOUR_ANON_KEY"
```

## 🪝 Step 4: Configure Stripe Webhook

1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://core314.com/.netlify/functions/stripe-webhook`
3. Select events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
4. Copy signing secret and add: `netlify env:set STRIPE_WEBHOOK_SECRET "whsec_YOUR_SECRET"`

## 🚢 Step 5: Deploy

```bash
npm run build
netlify deploy --prod
```

## ✅ Step 6: Test

1. Go to https://core314.com/pricing
2. Click "Start Free Trial"
3. Fill out signup form
4. Use test card: 4242 4242 4242 4242
5. Verify in Stripe Dashboard and Supabase
