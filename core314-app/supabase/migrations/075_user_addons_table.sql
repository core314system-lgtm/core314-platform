
CREATE TABLE IF NOT EXISTS user_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addon_name text NOT NULL,
  addon_category text NOT NULL CHECK (addon_category IN ('integration', 'analytics', 'ai_module', 'custom')),
  stripe_price_id text NOT NULL,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'pending')),
  activated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_status ON user_addons(status);
CREATE INDEX IF NOT EXISTS idx_user_addons_stripe_subscription ON user_addons(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_category ON user_addons(addon_category);

ALTER TABLE user_addons ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_addons' 
    AND policyname = 'Users can view their own add-ons'
  ) THEN
    CREATE POLICY "Users can view their own add-ons"
      ON user_addons FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_addons' 
    AND policyname = 'Service role can manage all add-ons'
  ) THEN
    CREATE POLICY "Service role can manage all add-ons"
      ON user_addons FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_user_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'user_addons_updated_at'
  ) THEN
    CREATE TRIGGER user_addons_updated_at
      BEFORE UPDATE ON user_addons
      FOR EACH ROW
      EXECUTE FUNCTION update_user_addons_updated_at();
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON user_addons TO authenticated;
GRANT ALL ON user_addons TO service_role;

CREATE OR REPLACE FUNCTION get_user_active_addons(p_user_id uuid)
RETURNS TABLE (
  addon_name text,
  addon_category text,
  activated_at timestamptz,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.addon_name,
    ua.addon_category,
    ua.activated_at,
    ua.metadata
  FROM user_addons ua
  WHERE ua.user_id = p_user_id
    AND ua.status = 'active'
    AND (ua.expires_at IS NULL OR ua.expires_at > now())
  ORDER BY ua.activated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_addon(p_user_id uuid, p_addon_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_addons
    WHERE user_id = p_user_id
      AND addon_name = p_addon_name
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE user_addons IS 'Tracks purchased add-ons for users with Stripe integration';
COMMENT ON FUNCTION get_user_active_addons IS 'Returns all active add-ons for a user';
COMMENT ON FUNCTION user_has_addon IS 'Checks if user has a specific active add-on';
