-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL CHECK (tier IN ('Starter', 'Pro', 'Enterprise')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'expired', 'revoked')),
    invite_token TEXT UNIQUE,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beta_invites_email 
ON beta_invites(user_email);

CREATE INDEX IF NOT EXISTS idx_beta_invites_token 
ON beta_invites(invite_token) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_beta_invites_status 
ON beta_invites(status);

CREATE INDEX IF NOT EXISTS idx_beta_invites_expires_at 
ON beta_invites(expires_at) WHERE status = 'pending';

ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on beta_invites"
ON beta_invites
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view own beta invite"
ON beta_invites
FOR SELECT
TO authenticated
USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

GRANT ALL ON beta_invites TO service_role;
GRANT SELECT ON beta_invites TO authenticated;

CREATE OR REPLACE FUNCTION expire_old_beta_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    UPDATE beta_invites
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    RETURN v_expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_old_beta_invites() TO service_role;

CREATE OR REPLACE FUNCTION activate_beta_invite(
    p_invite_token TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
    v_user_email TEXT;
BEGIN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id;
    
    IF v_user_email IS NULL THEN
        RETURN QUERY SELECT false, 'User not found', NULL::TEXT;
        RETURN;
    END IF;
    
    SELECT * INTO v_invite
    FROM beta_invites
    WHERE invite_token = p_invite_token
    AND user_email = v_user_email
    FOR UPDATE;
    
    IF v_invite IS NULL THEN
        RETURN QUERY SELECT false, 'Invalid invite token or email mismatch', NULL::TEXT;
        RETURN;
    END IF;
    
    IF v_invite.status != 'pending' THEN
        RETURN QUERY SELECT false, 'Invite already ' || v_invite.status, NULL::TEXT;
        RETURN;
    END IF;
    
    IF v_invite.expires_at < NOW() THEN
        UPDATE beta_invites
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_invite.id;
        
        RETURN QUERY SELECT false, 'Invite has expired', NULL::TEXT;
        RETURN;
    END IF;
    
    UPDATE beta_invites
    SET status = 'activated',
        activated_at = NOW(),
        updated_at = NOW()
    WHERE id = v_invite.id;
    
    INSERT INTO user_subscriptions (
        user_id,
        plan_name,
        status,
        current_period_start,
        current_period_end,
        trial_end
    ) VALUES (
        p_user_id,
        v_invite.tier,
        'trialing',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW() + INTERVAL '14 days'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET plan_name = EXCLUDED.plan_name,
        status = EXCLUDED.status,
        trial_end = EXCLUDED.trial_end,
        updated_at = NOW();
    
    PERFORM apply_plan_limits(p_user_id, v_invite.tier);
    
    RETURN QUERY SELECT true, 'Beta invite activated successfully', v_invite.tier;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_beta_invite(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION activate_beta_invite(TEXT, UUID) TO authenticated;

COMMENT ON TABLE beta_invites IS 'Manages beta invite links with JWT tokens and expiry';
COMMENT ON FUNCTION expire_old_beta_invites() IS 'Expires beta invites that are past their expiration date';
COMMENT ON FUNCTION activate_beta_invite(TEXT, UUID) IS 'Activates a beta invite and sets up user subscription';
