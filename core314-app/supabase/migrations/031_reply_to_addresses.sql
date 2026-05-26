CREATE TABLE IF NOT EXISTS reply_to_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reply_to_addresses ADD CONSTRAINT unique_email_address UNIQUE (email_address);

CREATE INDEX idx_reply_to_addresses_active ON reply_to_addresses(is_active);
CREATE INDEX idx_reply_to_addresses_default ON reply_to_addresses(is_default);

ALTER TABLE reply_to_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view reply-to addresses"
  ON reply_to_addresses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can insert reply-to addresses"
  ON reply_to_addresses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can update reply-to addresses"
  ON reply_to_addresses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins can delete reply-to addresses"
  ON reply_to_addresses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

INSERT INTO reply_to_addresses (department_name, email_address, is_default, is_active)
VALUES ('Support', 'support@core314.com', true, true)
ON CONFLICT (email_address) DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_single_default_reply_to()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE reply_to_addresses
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_default_reply_to
  BEFORE INSERT OR UPDATE ON reply_to_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_reply_to();
