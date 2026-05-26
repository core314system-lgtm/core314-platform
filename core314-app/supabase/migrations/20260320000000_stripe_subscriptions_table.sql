-- ============================================================================
-- STRIPE SUBSCRIPTIONS TABLE — Production Foundation
-- ============================================================================
-- Single source of truth for billing + plan enforcement
-- Integrates with auth.users, supports Intelligence + Command Center plans
-- Stripe webhooks write via service_role; users can only read their own row
-- ============================================================================

-- ============================================================================
-- STEP 1 — CREATE SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User linkage (1:1 with auth.users)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Stripe identifiers
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,

    -- Plan: intelligence ($299) or command_center ($799)
    plan TEXT NOT NULL,

    -- Stripe subscription lifecycle status
    status TEXT NOT NULL,

    -- Seat allocation (derived from plan, enforced at DB level)
    seats_allowed INTEGER NOT NULL DEFAULT 1,

    -- Billing period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,

    -- Cancellation flag
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Single source of truth for Stripe billing and plan enforcement';
COMMENT ON COLUMN public.subscriptions.plan IS 'Plan tier: intelligence ($299, 1 seat) or command_center ($799, 5 seats)';
COMMENT ON COLUMN public.subscriptions.status IS 'Stripe subscription status: active, trialing, past_due, canceled, incomplete';
COMMENT ON COLUMN public.subscriptions.seats_allowed IS 'Max team members allowed by plan (intelligence=1, command_center=5)';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'If true, subscription will not renew at period end';

-- ============================================================================
-- STEP 2 — CONSTRAINTS
-- ============================================================================

-- One subscription per user
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- Valid plan values only
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('intelligence', 'command_center'));

-- Valid status values only
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete'));

-- ============================================================================
-- STEP 3 — INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
    ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
    ON public.subscriptions (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
    ON public.subscriptions (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON public.subscriptions (status);

-- ============================================================================
-- STEP 4 — AUTO UPDATE TIMESTAMP TRIGGER
-- ============================================================================

-- Create the trigger function if it doesn't already exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Attach trigger to subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5 — ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own subscription
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy 2: Service role has full access (Stripe webhooks)
DROP POLICY IF EXISTS "Service role full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Service role full access to subscriptions"
    ON public.subscriptions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users CANNOT insert/update/delete directly
-- (No INSERT/UPDATE/DELETE policies for authenticated role)

-- Grant minimal permissions
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- ============================================================================
-- STEP 6 — PLAN → SEAT MAPPING (DB-LEVEL ENFORCEMENT)
-- ============================================================================

-- Function to derive seats_allowed from plan name
CREATE OR REPLACE FUNCTION public.get_seats_for_plan(p_plan TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_plan
        WHEN 'intelligence' THEN RETURN 1;
        WHEN 'command_center' THEN RETURN 5;
        ELSE RETURN 1; -- safe default
    END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_seats_for_plan IS 'Returns seat allocation for a given plan: intelligence=1, command_center=5';

-- Trigger to automatically set seats_allowed based on plan on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.enforce_plan_seat_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.seats_allowed := public.get_seats_for_plan(NEW.plan);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seats_on_subscription ON public.subscriptions;

CREATE TRIGGER enforce_seats_on_subscription
    BEFORE INSERT OR UPDATE OF plan ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_plan_seat_mapping();

COMMENT ON FUNCTION public.enforce_plan_seat_mapping IS 'Trigger: auto-sets seats_allowed based on plan (intelligence=1, command_center=5)';

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION public.get_seats_for_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seats_for_plan TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT * FROM information_schema.tables WHERE table_name = 'subscriptions';
-- SELECT * FROM information_schema.columns WHERE table_name = 'subscriptions' ORDER BY ordinal_position;
-- SELECT * FROM information_schema.table_constraints WHERE table_name = 'subscriptions';
-- SELECT * FROM pg_indexes WHERE tablename = 'subscriptions';
-- SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
-- SELECT public.get_seats_for_plan('intelligence');  -- should return 1
-- SELECT public.get_seats_for_plan('command_center'); -- should return 5
