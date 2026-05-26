-- ============================================================================
-- BILLING STATE ENFORCEMENT
-- Migration 139: Post-trial and payment-failure enforcement
-- ============================================================================
--
-- This migration implements:
-- 1. billing_state table for tracking access state
-- 2. Grace period logic (24h full, 24h-7d grace, >7d locked)
-- 3. Access enforcement functions
--
-- AUTHORITATIVE POLICY:
-- - trialing  -> Full access
-- - active    -> Full access
-- - past_due (<=24h) -> Full access (buffer)
-- - past_due (>24h, <=7 days) -> Billing Grace Mode (read-only / no actions)
-- - canceled / unpaid -> Locked (read-only)
--
-- No re-trial allowed. No silent access continuation.
-- ============================================================================

-- ============================================================================
-- PART 1: BILLING STATE TABLE
-- ============================================================================

-- Create access_state enum type
DO $$ BEGIN
    CREATE TYPE access_state_enum AS ENUM ('full', 'grace', 'locked');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create billing_state table
CREATE TABLE IF NOT EXISTS billing_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    payment_failed_at TIMESTAMPTZ,
    access_state access_state_enum NOT NULL DEFAULT 'full',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_billing_state_stripe_customer_id 
    ON billing_state(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_state_stripe_subscription_id 
    ON billing_state(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_state_access_state 
    ON billing_state(access_state);
CREATE INDEX IF NOT EXISTS idx_billing_state_payment_failed_at 
    ON billing_state(payment_failed_at) WHERE payment_failed_at IS NOT NULL;

-- Enable RLS
ALTER TABLE billing_state ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access billing_state (no authenticated user access)
CREATE POLICY "Service role has full access to billing_state"
    ON billing_state FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

COMMENT ON TABLE billing_state IS 
    'Billing enforcement state table. Service role only. Tracks access_state based on Stripe subscription status and payment failures.';

-- ============================================================================
-- PART 2: COMPUTE ACCESS STATE FUNCTION
-- ============================================================================
-- Single source of truth for computing access_state from subscription_status and payment_failed_at

CREATE OR REPLACE FUNCTION compute_access_state(
    p_subscription_status TEXT,
    p_payment_failed_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS access_state_enum
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_hours_since_failure NUMERIC;
BEGIN
    -- Handle null or empty status
    IF p_subscription_status IS NULL OR p_subscription_status = '' THEN
        RETURN 'locked'::access_state_enum;
    END IF;

    -- Check subscription status
    CASE p_subscription_status
        WHEN 'trialing' THEN
            RETURN 'full'::access_state_enum;
            
        WHEN 'active' THEN
            RETURN 'full'::access_state_enum;
            
        WHEN 'past_due' THEN
            -- Grace period logic based on payment_failed_at
            IF p_payment_failed_at IS NULL THEN
                -- No failure timestamp, assume just transitioned, give full access
                RETURN 'full'::access_state_enum;
            END IF;
            
            v_hours_since_failure := EXTRACT(EPOCH FROM (NOW() - p_payment_failed_at)) / 3600;
            
            IF v_hours_since_failure <= 24 THEN
                -- Within 24h buffer: full access
                RETURN 'full'::access_state_enum;
            ELSIF v_hours_since_failure <= 168 THEN -- 7 days = 168 hours
                -- 24h to 7 days: grace mode (read-only)
                RETURN 'grace'::access_state_enum;
            ELSE
                -- Beyond 7 days: locked
                RETURN 'locked'::access_state_enum;
            END IF;
            
        WHEN 'canceled', 'unpaid' THEN
            RETURN 'locked'::access_state_enum;
            
        ELSE
            -- Unknown status: locked for safety
            RETURN 'locked'::access_state_enum;
    END CASE;
END;
$$;

COMMENT ON FUNCTION compute_access_state IS 
    'Computes access_state from subscription_status and payment_failed_at. Single source of truth for grace period logic.';

GRANT EXECUTE ON FUNCTION compute_access_state TO service_role;

-- ============================================================================
-- PART 3: UPDATE BILLING STATE FUNCTION
-- ============================================================================
-- Called by webhook handlers to update billing_state

CREATE OR REPLACE FUNCTION update_billing_state(
    p_user_id UUID,
    p_stripe_customer_id TEXT DEFAULT NULL,
    p_stripe_subscription_id TEXT DEFAULT NULL,
    p_subscription_status TEXT DEFAULT NULL,
    p_payment_failed_at TIMESTAMPTZ DEFAULT NULL,
    p_clear_payment_failed BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing RECORD;
    v_new_access_state access_state_enum;
    v_old_access_state access_state_enum;
    v_payment_failed_at TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Get existing state
    SELECT * INTO v_existing FROM billing_state WHERE user_id = p_user_id;
    
    -- Determine payment_failed_at value
    IF p_clear_payment_failed THEN
        v_payment_failed_at := NULL;
    ELSIF p_payment_failed_at IS NOT NULL THEN
        v_payment_failed_at := p_payment_failed_at;
    ELSIF v_existing IS NOT NULL THEN
        v_payment_failed_at := v_existing.payment_failed_at;
    ELSE
        v_payment_failed_at := NULL;
    END IF;
    
    -- Compute new access state
    v_new_access_state := compute_access_state(
        COALESCE(p_subscription_status, v_existing.subscription_status),
        v_payment_failed_at
    );
    
    -- Store old access state for logging
    v_old_access_state := COALESCE(v_existing.access_state, 'full'::access_state_enum);
    
    -- Upsert billing_state
    INSERT INTO billing_state (
        user_id,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        payment_failed_at,
        access_state,
        updated_at
    ) VALUES (
        p_user_id,
        COALESCE(p_stripe_customer_id, v_existing.stripe_customer_id),
        COALESCE(p_stripe_subscription_id, v_existing.stripe_subscription_id),
        COALESCE(p_subscription_status, v_existing.subscription_status),
        v_payment_failed_at,
        v_new_access_state,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, billing_state.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, billing_state.stripe_subscription_id),
        subscription_status = COALESCE(EXCLUDED.subscription_status, billing_state.subscription_status),
        payment_failed_at = EXCLUDED.payment_failed_at,
        access_state = EXCLUDED.access_state,
        updated_at = NOW();
    
    -- Build result with state transition info
    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'old_access_state', v_old_access_state::TEXT,
        'new_access_state', v_new_access_state::TEXT,
        'subscription_status', COALESCE(p_subscription_status, v_existing.subscription_status),
        'payment_failed_at', v_payment_failed_at,
        'state_changed', v_old_access_state IS DISTINCT FROM v_new_access_state
    );
    
    -- Log state transition if changed
    IF v_old_access_state IS DISTINCT FROM v_new_access_state THEN
        INSERT INTO subscription_history (
            user_id,
            stripe_customer_id,
            stripe_subscription_id,
            event_type,
            new_status,
            metadata
        ) VALUES (
            p_user_id,
            COALESCE(p_stripe_customer_id, v_existing.stripe_customer_id),
            COALESCE(p_stripe_subscription_id, v_existing.stripe_subscription_id),
            'access_state_changed',
            v_new_access_state::TEXT,
            jsonb_build_object(
                'old_access_state', v_old_access_state::TEXT,
                'new_access_state', v_new_access_state::TEXT,
                'subscription_status', COALESCE(p_subscription_status, v_existing.subscription_status),
                'payment_failed_at', v_payment_failed_at
            )
        );
    END IF;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION update_billing_state IS 
    'Updates billing_state table and computes access_state. Logs state transitions to subscription_history.';

GRANT EXECUTE ON FUNCTION update_billing_state TO service_role;

-- ============================================================================
-- PART 4: GET USER ACCESS STATE FUNCTION
-- ============================================================================
-- Returns current access state for a user (for backend enforcement)

CREATE OR REPLACE FUNCTION get_user_access_state(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_billing RECORD;
    v_profile RECORD;
    v_computed_state access_state_enum;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'access_state', 'locked',
            'reason', 'no_user'
        );
    END IF;
    
    -- Get profile for admin/beta checks
    SELECT role, is_beta_tenant INTO v_profile
    FROM profiles WHERE id = v_user_id;
    
    -- Admins always have full access
    IF v_profile.role = 'admin' THEN
        RETURN jsonb_build_object(
            'access_state', 'full',
            'reason', 'admin_access'
        );
    END IF;
    
    -- Beta tenants always have full access
    IF v_profile.is_beta_tenant = TRUE THEN
        RETURN jsonb_build_object(
            'access_state', 'full',
            'reason', 'beta_access'
        );
    END IF;
    
    -- Get billing state
    SELECT * INTO v_billing FROM billing_state WHERE user_id = v_user_id;
    
    IF v_billing IS NULL THEN
        -- No billing state yet - check if they have a subscription in profiles
        SELECT subscription_status INTO v_profile FROM profiles WHERE id = v_user_id;
        
        IF v_profile.subscription_status IN ('trialing', 'active') THEN
            RETURN jsonb_build_object(
                'access_state', 'full',
                'reason', 'subscription_active_no_billing_state'
            );
        END IF;
        
        RETURN jsonb_build_object(
            'access_state', 'locked',
            'reason', 'no_billing_state'
        );
    END IF;
    
    -- Recompute access state in case time has passed (grace period may have expired)
    v_computed_state := compute_access_state(
        v_billing.subscription_status,
        v_billing.payment_failed_at
    );
    
    -- If computed state differs from stored, update it
    IF v_computed_state IS DISTINCT FROM v_billing.access_state THEN
        UPDATE billing_state 
        SET access_state = v_computed_state, updated_at = NOW()
        WHERE user_id = v_user_id;
    END IF;
    
    RETURN jsonb_build_object(
        'access_state', v_computed_state::TEXT,
        'subscription_status', v_billing.subscription_status,
        'payment_failed_at', v_billing.payment_failed_at,
        'reason', CASE 
            WHEN v_computed_state = 'full' THEN 'subscription_valid'
            WHEN v_computed_state = 'grace' THEN 'payment_failed_grace_period'
            WHEN v_computed_state = 'locked' THEN 'subscription_canceled_or_expired'
        END
    );
END;
$$;

COMMENT ON FUNCTION get_user_access_state IS 
    'Returns current access state for a user. Recomputes grace period on each call.';

GRANT EXECUTE ON FUNCTION get_user_access_state TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_access_state TO service_role;

-- ============================================================================
-- PART 5: IS USER MUTATION ALLOWED FUNCTION
-- ============================================================================
-- Returns TRUE only if user has full access (can perform mutations)

CREATE OR REPLACE FUNCTION is_user_mutation_allowed(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_access_state JSONB;
BEGIN
    v_access_state := get_user_access_state(p_user_id);
    RETURN (v_access_state->>'access_state') = 'full';
END;
$$;

COMMENT ON FUNCTION is_user_mutation_allowed IS 
    'Returns TRUE only if user has full access state. Use for mutation/action gating.';

GRANT EXECUTE ON FUNCTION is_user_mutation_allowed TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_mutation_allowed TO service_role;

-- ============================================================================
-- PART 6: IS USER READ ALLOWED FUNCTION
-- ============================================================================
-- Returns TRUE if user can read (full, grace, or locked all allow reads)

CREATE OR REPLACE FUNCTION is_user_read_allowed(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_access_state JSONB;
    v_state TEXT;
BEGIN
    v_access_state := get_user_access_state(p_user_id);
    v_state := v_access_state->>'access_state';
    -- All states allow read access
    RETURN v_state IN ('full', 'grace', 'locked');
END;
$$;

COMMENT ON FUNCTION is_user_read_allowed IS 
    'Returns TRUE if user can read data. All access states allow reads.';

GRANT EXECUTE ON FUNCTION is_user_read_allowed TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_read_allowed TO service_role;

-- ============================================================================
-- PART 7: CHECK AND CANCEL EXPIRED SUBSCRIPTIONS FUNCTION
-- ============================================================================
-- Returns users whose grace period has expired (>7 days past_due)
-- Webhook handler will call Stripe API to cancel these

CREATE OR REPLACE FUNCTION get_expired_grace_period_users()
RETURNS TABLE (
    user_id UUID,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    payment_failed_at TIMESTAMPTZ,
    hours_since_failure NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT 
        bs.user_id,
        bs.stripe_customer_id,
        bs.stripe_subscription_id,
        bs.payment_failed_at,
        EXTRACT(EPOCH FROM (NOW() - bs.payment_failed_at)) / 3600 AS hours_since_failure
    FROM billing_state bs
    WHERE bs.subscription_status = 'past_due'
    AND bs.payment_failed_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - bs.payment_failed_at)) / 3600 > 168 -- 7 days
    AND bs.access_state != 'locked';
$$;

COMMENT ON FUNCTION get_expired_grace_period_users IS 
    'Returns users whose grace period has expired (>7 days past_due). Used by webhook to trigger Stripe cancellation.';

GRANT EXECUTE ON FUNCTION get_expired_grace_period_users TO service_role;

-- ============================================================================
-- PART 8: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON billing_state TO service_role;

-- ============================================================================
-- PART 9: COMMENTS
-- ============================================================================

COMMENT ON COLUMN billing_state.user_id IS 'User ID (primary key, references auth.users)';
COMMENT ON COLUMN billing_state.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN billing_state.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN billing_state.subscription_status IS 'Current Stripe subscription status (trialing, active, past_due, canceled, unpaid)';
COMMENT ON COLUMN billing_state.payment_failed_at IS 'Timestamp when payment first failed (for grace period calculation)';
COMMENT ON COLUMN billing_state.access_state IS 'Computed access state: full (all access), grace (read-only), locked (read-only, subscription canceled)';
COMMENT ON COLUMN billing_state.updated_at IS 'Last update timestamp';
