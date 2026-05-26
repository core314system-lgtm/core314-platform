-- ============================================================================
-- TIER-0 LAUNCH BLOCKER: BILLING & TRIAL ENFORCEMENT
-- Migration 131: Webhook Idempotency, Logging, and Server-Side Enforcement
-- ============================================================================
-- 
-- This migration implements the following Tier-0 requirements:
-- 1. Webhook event logging with idempotency (prevent duplicate processing)
-- 2. Server-side trial/subscription enforcement via is_user_entitled()
-- 3. Explicit trial timestamps (trial_start, trial_end)
-- 4. Sync between profiles and user_subscriptions
--
-- NON-NEGOTIABLE RULES:
-- 1. No frontend-only gating - enforcement MUST be server-side
-- 2. No scenario where Stripe is paid but app shows unpaid
-- 3. No access without active subscription after trial expiry
-- 4. Webhook failures MUST be logged (not silent)
-- ============================================================================

-- ============================================================================
-- PART 1: STRIPE WEBHOOK EVENTS TABLE (Idempotency + Logging)
-- ============================================================================
-- This table serves dual purposes:
-- 1. Idempotency: Unique constraint on stripe_event_id prevents duplicate processing
-- 2. Audit trail: Persistent log of all webhook events for debugging

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    customer_id TEXT,
    subscription_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    processing_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'success', 'failed', 'skipped')),
    error_message TEXT,
    event_data JSONB,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id 
    ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_user_id 
    ON stripe_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status 
    ON stripe_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at 
    ON stripe_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type 
    ON stripe_webhook_events(event_type);

-- Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access webhook events
CREATE POLICY "Service role has full access to webhook events"
    ON stripe_webhook_events FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

-- Policy: Admins can read webhook events for debugging
CREATE POLICY "Admins can read webhook events"
    ON stripe_webhook_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

COMMENT ON TABLE stripe_webhook_events IS 
    'Tier-0: Stripe webhook event log with idempotency. Prevents duplicate processing and provides audit trail.';

-- ============================================================================
-- PART 2: ADD TRIAL TIMESTAMPS TO PROFILES
-- ============================================================================
-- Explicit trial_start and trial_end timestamps for enforcement

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

COMMENT ON COLUMN profiles.trial_start IS 'Tier-0: When the trial period started (from Stripe)';
COMMENT ON COLUMN profiles.trial_end IS 'Tier-0: When the trial period ends (from Stripe)';
COMMENT ON COLUMN profiles.current_period_start IS 'Tier-0: Current billing period start';
COMMENT ON COLUMN profiles.current_period_end IS 'Tier-0: Current billing period end';

-- ============================================================================
-- PART 3: IS_USER_ENTITLED() FUNCTION - SERVER-SIDE ENFORCEMENT
-- ============================================================================
-- Single source of truth for "is this user currently entitled to paid features?"
-- This function is used by RLS policies and backend checks

CREATE OR REPLACE FUNCTION is_user_entitled(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_subscription_status TEXT;
    v_trial_end TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
    v_is_beta_tenant BOOLEAN;
    v_role TEXT;
BEGIN
    -- Use provided user_id or fall back to auth.uid()
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get user's subscription state from profiles
    SELECT 
        subscription_status,
        trial_end,
        current_period_end,
        is_beta_tenant,
        role
    INTO 
        v_subscription_status,
        v_trial_end,
        v_current_period_end,
        v_is_beta_tenant,
        v_role
    FROM profiles
    WHERE id = v_user_id;

    -- If no profile found, not entitled
    IF v_subscription_status IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admins are always entitled (for testing/support)
    IF v_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Beta tenants are always entitled (for beta period)
    IF v_is_beta_tenant = TRUE THEN
        RETURN TRUE;
    END IF;

    -- Check subscription status
    CASE v_subscription_status
        WHEN 'active' THEN
            -- Active subscription: check if within billing period
            IF v_current_period_end IS NULL OR v_current_period_end > NOW() THEN
                RETURN TRUE;
            END IF;
            RETURN FALSE;
            
        WHEN 'trialing' THEN
            -- Trial: check if trial hasn't expired
            IF v_trial_end IS NULL OR v_trial_end > NOW() THEN
                RETURN TRUE;
            END IF;
            RETURN FALSE;
            
        WHEN 'past_due' THEN
            -- Past due: still allow access (grace period)
            -- Stripe will handle dunning and eventual cancellation
            RETURN TRUE;
            
        WHEN 'canceled' THEN
            -- Canceled: check if still within paid period
            IF v_current_period_end IS NOT NULL AND v_current_period_end > NOW() THEN
                RETURN TRUE;
            END IF;
            RETURN FALSE;
            
        ELSE
            -- inactive, unpaid, or unknown status
            RETURN FALSE;
    END CASE;
END;
$$;

COMMENT ON FUNCTION is_user_entitled IS 
    'Tier-0: Single source of truth for subscription entitlement. Returns TRUE if user has active subscription, valid trial, or is beta/admin.';

GRANT EXECUTE ON FUNCTION is_user_entitled TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_entitled TO service_role;

-- ============================================================================
-- PART 4: IS_USER_ENTITLED_FOR_RLS() - Wrapper for RLS policies
-- ============================================================================
-- Simpler wrapper that uses auth.uid() for RLS policies

CREATE OR REPLACE FUNCTION is_user_entitled_for_rls()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT is_user_entitled(auth.uid());
$$;

COMMENT ON FUNCTION is_user_entitled_for_rls IS 
    'Tier-0: RLS-friendly wrapper for is_user_entitled(). Uses auth.uid() automatically.';

GRANT EXECUTE ON FUNCTION is_user_entitled_for_rls TO authenticated;

-- ============================================================================
-- PART 5: GET_USER_ENTITLEMENT_STATUS() - Detailed status for UI
-- ============================================================================
-- Returns detailed entitlement information for UI display

CREATE OR REPLACE FUNCTION get_user_entitlement_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_is_entitled BOOLEAN;
    v_days_remaining INTEGER;
    v_status_reason TEXT;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'is_entitled', FALSE,
            'reason', 'no_user'
        );
    END IF;

    SELECT 
        subscription_status,
        subscription_tier,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end,
        is_beta_tenant,
        role
    INTO v_profile
    FROM profiles
    WHERE id = v_user_id;

    IF v_profile IS NULL THEN
        RETURN jsonb_build_object(
            'is_entitled', FALSE,
            'reason', 'no_profile'
        );
    END IF;

    v_is_entitled := is_user_entitled(v_user_id);

    -- Determine status reason and days remaining
    IF v_profile.role = 'admin' THEN
        v_status_reason := 'admin_access';
        v_days_remaining := NULL;
    ELSIF v_profile.is_beta_tenant = TRUE THEN
        v_status_reason := 'beta_access';
        v_days_remaining := NULL;
    ELSIF v_profile.subscription_status = 'active' THEN
        v_status_reason := 'active_subscription';
        IF v_profile.current_period_end IS NOT NULL THEN
            v_days_remaining := GREATEST(0, EXTRACT(DAY FROM v_profile.current_period_end - NOW())::INTEGER);
        END IF;
    ELSIF v_profile.subscription_status = 'trialing' THEN
        v_status_reason := 'trial_active';
        IF v_profile.trial_end IS NOT NULL THEN
            v_days_remaining := GREATEST(0, EXTRACT(DAY FROM v_profile.trial_end - NOW())::INTEGER);
        END IF;
    ELSIF v_profile.subscription_status = 'past_due' THEN
        v_status_reason := 'payment_past_due';
        v_days_remaining := NULL;
    ELSIF v_profile.subscription_status = 'canceled' THEN
        IF v_profile.current_period_end IS NOT NULL AND v_profile.current_period_end > NOW() THEN
            v_status_reason := 'canceled_with_access';
            v_days_remaining := GREATEST(0, EXTRACT(DAY FROM v_profile.current_period_end - NOW())::INTEGER);
        ELSE
            v_status_reason := 'canceled_expired';
            v_days_remaining := 0;
        END IF;
    ELSE
        v_status_reason := 'no_subscription';
        v_days_remaining := 0;
    END IF;

    RETURN jsonb_build_object(
        'is_entitled', v_is_entitled,
        'subscription_status', v_profile.subscription_status,
        'subscription_tier', v_profile.subscription_tier,
        'trial_start', v_profile.trial_start,
        'trial_end', v_profile.trial_end,
        'current_period_start', v_profile.current_period_start,
        'current_period_end', v_profile.current_period_end,
        'is_beta_tenant', v_profile.is_beta_tenant,
        'days_remaining', v_days_remaining,
        'status_reason', v_status_reason
    );
END;
$$;

COMMENT ON FUNCTION get_user_entitlement_status IS 
    'Tier-0: Returns detailed entitlement status for UI display including days remaining and status reason.';

GRANT EXECUTE ON FUNCTION get_user_entitlement_status TO authenticated;

-- ============================================================================
-- PART 6: WEBHOOK EVENT PROCESSING HELPERS
-- ============================================================================

-- Function to check if an event has already been processed (idempotency)
CREATE OR REPLACE FUNCTION is_webhook_event_processed(p_event_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM stripe_webhook_events 
        WHERE stripe_event_id = p_event_id 
        AND processing_status IN ('success', 'processing')
    );
$$;

COMMENT ON FUNCTION is_webhook_event_processed IS 
    'Tier-0: Check if a Stripe webhook event has already been processed (idempotency check).';

GRANT EXECUTE ON FUNCTION is_webhook_event_processed TO service_role;

-- Function to log a webhook event
CREATE OR REPLACE FUNCTION log_webhook_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_customer_id TEXT DEFAULT NULL,
    p_subscription_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'pending',
    p_error_message TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        customer_id,
        subscription_id,
        user_id,
        processing_status,
        error_message,
        event_data,
        processed_at
    ) VALUES (
        p_event_id,
        p_event_type,
        p_customer_id,
        p_subscription_id,
        p_user_id,
        p_status,
        p_error_message,
        p_event_data,
        CASE WHEN p_status IN ('success', 'failed', 'skipped') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (stripe_event_id) DO UPDATE SET
        processing_status = EXCLUDED.processing_status,
        error_message = EXCLUDED.error_message,
        processed_at = CASE WHEN EXCLUDED.processing_status IN ('success', 'failed', 'skipped') THEN NOW() ELSE stripe_webhook_events.processed_at END,
        user_id = COALESCE(EXCLUDED.user_id, stripe_webhook_events.user_id)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_webhook_event IS 
    'Tier-0: Log a Stripe webhook event with idempotency support.';

GRANT EXECUTE ON FUNCTION log_webhook_event TO service_role;

-- Function to update webhook event status
CREATE OR REPLACE FUNCTION update_webhook_event_status(
    p_event_id TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE stripe_webhook_events
    SET 
        processing_status = p_status,
        error_message = p_error_message,
        user_id = COALESCE(p_user_id, user_id),
        processed_at = CASE WHEN p_status IN ('success', 'failed', 'skipped') THEN NOW() ELSE processed_at END
    WHERE stripe_event_id = p_event_id;
END;
$$;

COMMENT ON FUNCTION update_webhook_event_status IS 
    'Tier-0: Update the processing status of a webhook event.';

GRANT EXECUTE ON FUNCTION update_webhook_event_status TO service_role;

-- ============================================================================
-- PART 7: SYNC PROFILES TO USER_SUBSCRIPTIONS
-- ============================================================================
-- Function to sync subscription data between profiles and user_subscriptions

CREATE OR REPLACE FUNCTION sync_subscription_to_user_subscriptions(
    p_user_id UUID,
    p_plan_name TEXT,
    p_stripe_subscription_id TEXT,
    p_stripe_customer_id TEXT,
    p_status TEXT,
    p_current_period_start TIMESTAMPTZ,
    p_current_period_end TIMESTAMPTZ,
    p_trial_start TIMESTAMPTZ DEFAULT NULL,
    p_trial_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_sub UUID;
    v_result JSONB;
BEGIN
    -- Check if subscription already exists
    SELECT id INTO v_existing_sub
    FROM user_subscriptions
    WHERE stripe_subscription_id = p_stripe_subscription_id;

    IF v_existing_sub IS NOT NULL THEN
        -- Update existing subscription
        UPDATE user_subscriptions
        SET
            plan_name = p_plan_name,
            status = p_status,
            current_period_start = p_current_period_start,
            current_period_end = p_current_period_end,
            updated_at = NOW()
        WHERE id = v_existing_sub;
        
        v_result := jsonb_build_object('action', 'updated', 'subscription_id', v_existing_sub);
    ELSE
        -- Insert new subscription
        INSERT INTO user_subscriptions (
            user_id,
            plan_name,
            stripe_subscription_id,
            stripe_customer_id,
            status,
            current_period_start,
            current_period_end
        ) VALUES (
            p_user_id,
            p_plan_name,
            p_stripe_subscription_id,
            p_stripe_customer_id,
            p_status,
            p_current_period_start,
            p_current_period_end
        )
        RETURNING id INTO v_existing_sub;
        
        v_result := jsonb_build_object('action', 'inserted', 'subscription_id', v_existing_sub);
    END IF;

    -- Also update profiles table for consistency
    UPDATE profiles
    SET
        trial_start = COALESCE(p_trial_start, trial_start),
        trial_end = COALESCE(p_trial_end, trial_end),
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sync_subscription_to_user_subscriptions IS 
    'Tier-0: Sync subscription data to both user_subscriptions and profiles tables.';

GRANT EXECUTE ON FUNCTION sync_subscription_to_user_subscriptions TO service_role;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON stripe_webhook_events TO service_role;
GRANT INSERT, UPDATE ON stripe_webhook_events TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN stripe_webhook_events.stripe_event_id IS 'Unique Stripe event ID for idempotency';
COMMENT ON COLUMN stripe_webhook_events.processing_status IS 'pending=received, processing=in progress, success=completed, failed=error, skipped=duplicate or irrelevant';
