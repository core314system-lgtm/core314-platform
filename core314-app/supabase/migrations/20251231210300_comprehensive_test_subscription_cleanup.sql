-- ============================================================================
-- COMPREHENSIVE TEST SUBSCRIPTION CLEANUP
-- Migration: 20251231210300
-- 
-- PURPOSE: Cancel ALL test-era subscriptions to ensure:
--   - MRR = $0 until Stripe Live Mode is enabled
--   - Active Subscriptions = 0
--   - No phantom subscribers in Billing Overview
--
-- SCOPE: Only affects rows where:
--   - stripe_subscription_id IS NULL
--   - OR stripe_subscription_id LIKE 'test_%'
--
-- DOES NOT TOUCH: Real Stripe subscriptions (sub_live_*, sub_1*, etc.)
-- ============================================================================

-- Step 1: Cancel all test-era subscriptions
UPDATE user_subscriptions
SET 
    status = 'canceled',
    canceled_at = NOW(),
    ended_at = NOW(),
    updated_at = NOW(),
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{launch_cleanup}',
        jsonb_build_object(
            'cleaned_at', NOW()::text,
            'reason', 'Comprehensive pre-launch test data cleanup',
            'original_status', status,
            'migration', '20251231210300_comprehensive_test_subscription_cleanup'
        )
    )
WHERE status IN ('active', 'trialing', 'past_due', 'incomplete')
  AND (
    stripe_subscription_id IS NULL
    OR stripe_subscription_id LIKE 'test_%'
    OR stripe_subscription_id LIKE 'sub_test_%'
  );

-- Step 2: Verify cleanup results
DO $$
DECLARE
    v_active_count INTEGER;
    v_canceled_count INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE status IN ('active', 'trialing')) INTO v_active_count
    FROM user_subscriptions
    WHERE stripe_subscription_id IS NULL 
       OR stripe_subscription_id LIKE 'test_%'
       OR stripe_subscription_id LIKE 'sub_test_%';
    
    SELECT 
        COUNT(*) FILTER (WHERE status = 'canceled') INTO v_canceled_count
    FROM user_subscriptions;
    
    SELECT COUNT(*) INTO v_total_count FROM user_subscriptions;
    
    RAISE NOTICE '=== SUBSCRIPTION CLEANUP RESULTS ===';
    RAISE NOTICE 'Active test subscriptions remaining: %', v_active_count;
    RAISE NOTICE 'Total canceled subscriptions: %', v_canceled_count;
    RAISE NOTICE 'Total subscriptions in table: %', v_total_count;
    RAISE NOTICE '====================================';
    
    -- Assert that no test subscriptions remain active
    IF v_active_count > 0 THEN
        RAISE WARNING 'WARNING: % test subscriptions still active after cleanup', v_active_count;
    END IF;
END $$;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually to confirm)
-- 
-- Expected results after this migration:
--   - All subscriptions with NULL or test_* stripe_subscription_id are canceled
--   - MRR calculation returns $0
--   - Active subscription count = 0 (for test data)
--
-- Verification queries:
--
-- 1. Check active subscriptions (should be 0 for test data):
--    SELECT COUNT(*) FROM user_subscriptions 
--    WHERE status IN ('active', 'trialing')
--    AND (stripe_subscription_id IS NULL OR stripe_subscription_id LIKE 'test_%');
--
-- 2. Check all subscription statuses:
--    SELECT status, COUNT(*) FROM user_subscriptions GROUP BY status;
--
-- 3. Verify cleanup metadata was applied:
--    SELECT id, plan_name, status, metadata->'launch_cleanup' 
--    FROM user_subscriptions 
--    WHERE metadata ? 'launch_cleanup';
-- ============================================================================
