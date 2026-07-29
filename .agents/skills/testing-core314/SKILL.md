# Testing Core314 Platform

## App URLs
- **Production app:** https://polite-mochi-fc5be5.netlify.app (app.core314.com redirects to admin in browser)
- **Admin panel:** https://admin.core314.com
- **Landing site:** https://core314.com
- **Deploy previews:** https://deploy-preview-{PR#}--polite-mochi-fc5be5.netlify.app

## Auth
- Sign out of admin panel before logging into the app (they share Supabase auth)
- App login is at `/login` on the Netlify URL
- Test user credentials are stored as secrets: `CORE314_TEST_EMAIL` / `CORE314_TEST_PASSWORD`

## Edge Function Deployment
- Use `SUPABASE_ACCESS_TOKEN_2` (not `SUPABASE_ACCESS_TOKEN`) for Supabase CLI auth
- Deploy command: `SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN_2" supabase functions deploy <function-name> --no-verify-jwt --project-ref ygvkegcstaowikessigx`
- Run from `core314-app/` directory

## Supabase RPC Queries
- Use `SUPABASE_SERVICE_ROLE_KEY` for direct API queries
- Example: `curl -s "https://ygvkegcstaowikessigx.supabase.co/rest/v1/rpc/<function_name>" -X POST -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{"param": "value"}'`

## Stripe Integration
- Coupon names must be <= 40 characters (Stripe API limit)
- The `STRIPE_COMMAND_CENTER_PRICE_ID` must be a valid price ID from the Stripe dashboard
- Beta checkout edge function: `beta-create-checkout`
- Coupon ID: `beta-tester-50-off-6mo`

## Beta Tester Flow
- Beta lifecycle status: query via `get_beta_lifecycle_status` RPC with `p_user_id`
- Billing page shows discount banner when `found=true` and `stripe_subscription_id=null`
- Billing page shows "Beta Discount Active" when `stripe_subscription_id` is set
- CTA redirects to edge function which creates Stripe Checkout session with coupon
