-- =============================================================================
-- USER ACTIVATION STATE
-- Server-side source of truth for onboarding activation milestones.
-- Drives both in-app onboarding UI and automated nudge emails.
-- Supports dual-track cadences: beta testers vs trial users.
-- =============================================================================

-- 1. Create the activation state table
CREATE TABLE IF NOT EXISTS public.user_activation_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User type determines email cadence and copy
  user_type TEXT NOT NULL DEFAULT 'trial_user' CHECK (user_type IN (
    'beta_tester',    -- 45-day free beta period (gentler, fewer emails)
    'trial_user',     -- 14-day trial after public launch (more assertive)
    'paid'            -- Converted paid user (no onboarding nudges)
  )),

  -- Milestone timestamps (NULL = not yet achieved)
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_integration_at TIMESTAMPTZ,
  second_integration_at TIMESTAMPTZ,
  third_integration_at TIMESTAMPTZ,
  first_brief_at TIMESTAMPTZ,
  first_signal_review_at TIMESTAMPTZ,

  -- Computed activation status
  activation_status TEXT NOT NULL DEFAULT 'signed_up' CHECK (activation_status IN (
    'signed_up',        -- Account created, nothing connected
    'integrating',      -- 1+ integration connected, no brief yet
    'activated',        -- First brief generated (the "aha moment")
    'fully_onboarded'   -- Brief + signals reviewed
  )),

  -- Denormalized integration count for quick queries
  integration_count INTEGER NOT NULL DEFAULT 0,

  -- Email nudge tracking (which nudges have been sent)
  -- Beta testers: only nudge_1 (48h) and nudge_2 (day 5) are used
  -- Trial users: all 5 nudges are used
  nudge_1_sent_at TIMESTAMPTZ,  -- "Connect your first integration"
  nudge_2_sent_at TIMESTAMPTZ,  -- "Generate your first brief" (trial) / "Day 5 check-in" (beta)
  nudge_3_sent_at TIMESTAMPTZ,  -- "Your data is waiting" (72h re-engage, trial only)
  nudge_4_sent_at TIMESTAMPTZ,  -- "Mid-trial urgency" (day 5-7, trial only)
  nudge_5_sent_at TIMESTAMPTZ,  -- "Trial ending soon" (day 11-12, trial only)

  -- Suppression
  email_suppressed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Activity tracking
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for cron job queries
CREATE INDEX IF NOT EXISTS idx_activation_state_status
  ON user_activation_state(activation_status);

CREATE INDEX IF NOT EXISTS idx_activation_state_user_type
  ON user_activation_state(user_type);

CREATE INDEX IF NOT EXISTS idx_activation_state_signed_up
  ON user_activation_state(signed_up_at)
  WHERE activation_status = 'signed_up';

CREATE INDEX IF NOT EXISTS idx_activation_state_integrating
  ON user_activation_state(first_integration_at)
  WHERE activation_status = 'integrating';

CREATE INDEX IF NOT EXISTS idx_activation_state_needs_nudge
  ON user_activation_state(activation_status, user_type, email_suppressed)
  WHERE email_suppressed = FALSE AND activation_status IN ('signed_up', 'integrating');

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_activation_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activation_state_updated_at ON user_activation_state;
CREATE TRIGGER trg_activation_state_updated_at
  BEFORE UPDATE ON user_activation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_activation_state_updated_at();

-- 4. Trigger: Auto-create activation state on new user signup
-- Detects beta testers by checking beta_tester_lifecycle table
CREATE OR REPLACE FUNCTION auto_create_activation_state()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  -- Check if this user has a beta lifecycle record
  IF EXISTS (SELECT 1 FROM beta_tester_lifecycle WHERE user_id = NEW.id) THEN
    v_user_type := 'beta_tester';
  ELSE
    v_user_type := 'trial_user';
  END IF;

  INSERT INTO user_activation_state (user_id, user_type, signed_up_at)
  VALUES (NEW.id, v_user_type, COALESCE(NEW.created_at, now()))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire when a profile is created (profiles are created on signup)
DROP TRIGGER IF EXISTS trg_auto_create_activation_state ON profiles;
CREATE TRIGGER trg_auto_create_activation_state
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_activation_state();

-- 5. Trigger: Update activation state when integration is connected
CREATE OR REPLACE FUNCTION update_activation_on_integration()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
  v_state user_activation_state%ROWTYPE;
BEGIN
  -- Only care about user-added active integrations
  IF NEW.status != 'active' OR NEW.added_by_user != TRUE THEN
    RETURN NEW;
  END IF;

  -- Count active user-added integrations
  SELECT COUNT(*) INTO v_count
  FROM user_integrations
  WHERE user_id = NEW.user_id
    AND status = 'active'
    AND added_by_user = TRUE;

  -- Get current activation state
  SELECT * INTO v_state
  FROM user_activation_state
  WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    -- Create state if missing (shouldn't happen, but defensive)
    INSERT INTO user_activation_state (user_id, integration_count, first_integration_at, activation_status)
    VALUES (NEW.user_id, v_count, now(), 'integrating')
    ON CONFLICT (user_id) DO UPDATE SET
      integration_count = v_count,
      first_integration_at = COALESCE(user_activation_state.first_integration_at, now()),
      activation_status = CASE
        WHEN user_activation_state.first_brief_at IS NOT NULL THEN user_activation_state.activation_status
        ELSE 'integrating'
      END;
    RETURN NEW;
  END IF;

  -- Update integration milestones
  UPDATE user_activation_state
  SET integration_count = v_count,
      first_integration_at = COALESCE(first_integration_at, now()),
      second_integration_at = CASE WHEN v_count >= 2 THEN COALESCE(second_integration_at, now()) ELSE second_integration_at END,
      third_integration_at = CASE WHEN v_count >= 3 THEN COALESCE(third_integration_at, now()) ELSE third_integration_at END,
      activation_status = CASE
        WHEN v_state.first_brief_at IS NOT NULL AND v_state.first_signal_review_at IS NOT NULL THEN 'fully_onboarded'
        WHEN v_state.first_brief_at IS NOT NULL THEN 'activated'
        ELSE 'integrating'
      END,
      last_active_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activation_on_integration ON user_integrations;
CREATE TRIGGER trg_activation_on_integration
  AFTER INSERT OR UPDATE ON user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_activation_on_integration();

-- 6. Trigger: Update activation state when brief is generated
CREATE OR REPLACE FUNCTION update_activation_on_brief()
RETURNS TRIGGER AS $$
DECLARE
  v_state user_activation_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state
  FROM user_activation_state
  WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    INSERT INTO user_activation_state (user_id, first_brief_at, activation_status)
    VALUES (NEW.user_id, now(), 'activated')
    ON CONFLICT (user_id) DO UPDATE SET
      first_brief_at = COALESCE(user_activation_state.first_brief_at, now()),
      activation_status = 'activated';
    RETURN NEW;
  END IF;

  IF v_state.first_brief_at IS NULL THEN
    UPDATE user_activation_state
    SET first_brief_at = now(),
        activation_status = CASE
          WHEN v_state.first_signal_review_at IS NOT NULL THEN 'fully_onboarded'
          ELSE 'activated'
        END,
        last_active_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activation_on_brief ON operational_briefs;
CREATE TRIGGER trg_activation_on_brief
  AFTER INSERT ON operational_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_activation_on_brief();

-- 7. Function: Mark signals as reviewed (called from frontend)
CREATE OR REPLACE FUNCTION mark_signals_reviewed(p_user_id UUID)
RETURNS jsonb AS $$
BEGIN
  UPDATE user_activation_state
  SET first_signal_review_at = COALESCE(first_signal_review_at, now()),
      activation_status = CASE
        WHEN first_brief_at IS NOT NULL THEN 'fully_onboarded'
        ELSE activation_status
      END,
      last_active_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No activation state found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function: Get activation state for frontend
CREATE OR REPLACE FUNCTION get_activation_state(p_user_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_state user_activation_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state
  FROM user_activation_state
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'user_type', v_state.user_type,
    'activation_status', v_state.activation_status,
    'signed_up_at', v_state.signed_up_at,
    'first_integration_at', v_state.first_integration_at,
    'second_integration_at', v_state.second_integration_at,
    'third_integration_at', v_state.third_integration_at,
    'first_brief_at', v_state.first_brief_at,
    'first_signal_review_at', v_state.first_signal_review_at,
    'integration_count', v_state.integration_count,
    'email_suppressed', v_state.email_suppressed,
    'last_active_at', v_state.last_active_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function: Suppress/unsuppress nudge emails (user preference)
CREATE OR REPLACE FUNCTION toggle_nudge_emails(p_user_id UUID, p_suppressed BOOLEAN)
RETURNS jsonb AS $$
BEGIN
  UPDATE user_activation_state
  SET email_suppressed = p_suppressed
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No activation state found');
  END IF;

  RETURN jsonb_build_object('success', true, 'email_suppressed', p_suppressed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Admin view: Get all users' activation states
CREATE OR REPLACE FUNCTION get_all_activation_states()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  user_type TEXT,
  activation_status TEXT,
  signed_up_at TIMESTAMPTZ,
  first_integration_at TIMESTAMPTZ,
  first_brief_at TIMESTAMPTZ,
  integration_count INTEGER,
  last_active_at TIMESTAMPTZ,
  email_suppressed BOOLEAN,
  nudge_1_sent_at TIMESTAMPTZ,
  nudge_2_sent_at TIMESTAMPTZ,
  nudge_3_sent_at TIMESTAMPTZ,
  nudge_4_sent_at TIMESTAMPTZ,
  nudge_5_sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uas.user_id,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    COALESCE(p.email, 'Unknown') AS email,
    uas.user_type,
    uas.activation_status,
    uas.signed_up_at,
    uas.first_integration_at,
    uas.first_brief_at,
    uas.integration_count,
    uas.last_active_at,
    uas.email_suppressed,
    uas.nudge_1_sent_at,
    uas.nudge_2_sent_at,
    uas.nudge_3_sent_at,
    uas.nudge_4_sent_at,
    uas.nudge_5_sent_at
  FROM user_activation_state uas
  JOIN profiles p ON p.id = uas.user_id
  ORDER BY uas.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Backfill: Create activation state for existing users
-- This runs once to catch users who already exist
DO $$
DECLARE
  v_profile RECORD;
  v_user_type TEXT;
  v_integration_count INTEGER;
  v_first_integration TIMESTAMPTZ;
  v_first_brief TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  FOR v_profile IN
    SELECT p.id, p.created_at
    FROM profiles p
    WHERE NOT EXISTS (SELECT 1 FROM user_activation_state WHERE user_id = p.id)
  LOOP
    -- Determine user type
    IF EXISTS (SELECT 1 FROM beta_tester_lifecycle WHERE user_id = v_profile.id) THEN
      v_user_type := 'beta_tester';
    ELSE
      v_user_type := 'trial_user';
    END IF;

    -- Count integrations
    SELECT COUNT(*), MIN(created_at) INTO v_integration_count, v_first_integration
    FROM user_integrations
    WHERE user_id = v_profile.id
      AND status = 'active'
      AND added_by_user = TRUE;

    -- Check for briefs
    SELECT MIN(created_at) INTO v_first_brief
    FROM operational_briefs
    WHERE user_id = v_profile.id;

    -- Determine status
    IF v_first_brief IS NOT NULL THEN
      v_status := 'activated';
    ELSIF v_integration_count > 0 THEN
      v_status := 'integrating';
    ELSE
      v_status := 'signed_up';
    END IF;

    INSERT INTO user_activation_state (
      user_id, user_type, signed_up_at,
      first_integration_at, integration_count,
      first_brief_at, activation_status
    ) VALUES (
      v_profile.id, v_user_type, COALESCE(v_profile.created_at, now()),
      v_first_integration, COALESCE(v_integration_count, 0),
      v_first_brief, v_status
    ) ON CONFLICT (user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Backfill complete for user_activation_state';
END;
$$;

-- 12. RLS Policies
ALTER TABLE user_activation_state ENABLE ROW LEVEL SECURITY;

-- Users can view their own activation state
CREATE POLICY "Users can view own activation state"
  ON user_activation_state FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all activation states
CREATE POLICY "Admins can view all activation states"
  ON user_activation_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage all activation states
CREATE POLICY "Admins can manage activation states"
  ON user_activation_state FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role full access (for edge functions)
GRANT ALL ON user_activation_state TO service_role;
GRANT SELECT ON user_activation_state TO authenticated;
