# Core314 Billing E2E Tests

## Overview

Comprehensive end-to-end test suite for the Core314 Stripe billing system.

## Prerequisites

1. Node.js v18+ with ES modules support
2. Required npm packages:
   - @supabase/supabase-js
   - stripe

## Environment Variables

Set the following environment variables before running tests:

```bash
export SUPABASE_URL="https://ygvkegcstaowikessigx.supabase.co"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export TEST_USER_EMAIL="core314-test-user@proton.me"
export TEST_USER_PASSWORD="Core314TestUser!2025"
```

Or create a `.env` file in the project root (DO NOT COMMIT):

```
SUPABASE_URL=https://ygvkegcstaowikessigx.supabase.co
SUPABASE_ANON_KEY=your_key_here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
TEST_USER_EMAIL=core314-test-user@proton.me
TEST_USER_PASSWORD=Core314TestUser!2025
```

## Running Tests

### Basic Test Suite

```bash
cd core314-app
node ../scripts/e2e/test-billing.mjs
```

### Comprehensive Test Suite

```bash
cd core314-app
node ../scripts/e2e/test-billing-comprehensive.mjs
```

## Test Coverage

The comprehensive test suite includes:

1. **Checkout Session Creation** - Validates checkout URL generation
2. **14-Day Free Trial** - Confirms trial configuration
3. **Webhook Signature Verification** - Tests security
4. **Webhook Event Processing** - Validates event handling
5. **Subscription Status Updates** - Tests lifecycle events
6. **Cancellation Flow** - Validates cancellation handling
7. **Billing Portal** - Tests portal session generation
8. **Error Handling** - Tests edge cases and idempotency

## Expected Output

```
=== CORE314 COMPREHENSIVE BILLING E2E TEST SUITE ===

1️⃣ Testing Checkout Session Creation...
✅ Checkout Session Creation

2️⃣ Testing 14-Day Free Trial...
✅ 14-Day Free Trial - Starter Price
✅ 14-Day Free Trial - Pro Price

...

=== TEST SUMMARY ===
✅ Passed: 16
❌ Failed: 0
⚠️  Warnings: 1

✅ ALL TESTS PASSED
```

## Troubleshooting

### Missing Dependencies

If you see "Cannot find package '@supabase/supabase-js'":

```bash
cd core314-app
npm install --save-dev @supabase/supabase-js stripe
```

### Authentication Errors

Ensure the test user exists in Supabase Auth:
- Email: core314-test-user@proton.me
- Password: Core314TestUser!2025

### Webhook Errors

Verify the webhook secret matches the one configured in Supabase:

```bash
cd core314-app
supabase secrets list | grep STRIPE_WEBHOOK_SECRET
```

## Security Notes

- Never commit files with hardcoded secrets
- Always use environment variables for sensitive data
- The test files are configured to read from environment variables
- Add `.env` to `.gitignore` if not already present
