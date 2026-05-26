-- ============================================================================
-- Pre-Launch Cleanup: Reset Test Subscription Data
-- Phase: Billing Cleanup & Pricing Fix
-- 
-- This migration resets all test subscription data created during development
-- to ensure clean billing metrics (MRR = $0, Active Subscriptions = 0) before
-- Stripe Live Mode activation.
--
-- SAFE FOR PRODUCTION: This only affects internal test data, not Stripe config.
-- ============================================================================

-- Reset all test subscriptions to canceled status
-- This ensures MRR calculations show $0 and no phantom subscribers appear
UPDATE user_subscriptions
SET 
    status = 'canceled',
    canceled_at = NOW(),
    ended_at = NOW(),
    updated_at = NOW(),
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{pre_launch_cleanup}',
        jsonb_build_object(
            'cleaned_at', NOW(),
            'reason', 'Pre-launch test data cleanup',
            'original_status', status
        )
    )
WHERE status IN ('active', 'trialing')
  AND (
    -- Only reset subscriptions without real Stripe subscription IDs
    stripe_subscription_id IS NULL
    OR stripe_subscription_id LIKE 'test_%'
    OR stripe_subscription_id LIKE 'sub_test_%'
  );

-- Log the cleanup action for audit purposes
DO $$
DECLARE
    v_affected_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    RAISE NOTICE 'Pre-launch cleanup: Reset % test subscriptions', v_affected_count;
END $$;

-- ============================================================================
-- Verification Query (for manual verification after migration)
-- Run this to confirm cleanup was successful:
--
-- SELECT 
--     COUNT(*) FILTER (WHERE status IN ('active', 'trialing')) as active_count,
--     COUNT(*) FILTER (WHERE status = 'canceled') as canceled_count,
--     COUNT(*) as total_count
-- FROM user_subscriptions;
--
-- Expected result: active_count = 0 (or only legitimate admin accounts)
-- ============================================================================
