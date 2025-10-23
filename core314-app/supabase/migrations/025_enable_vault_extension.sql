-- ============================================================
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgsodium;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO service_role;
GRANT USAGE ON SCHEMA pgsodium TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE name = 'oauth_encryption_key') THEN
    INSERT INTO pgsodium.key (name, key_type) 
    VALUES ('oauth_encryption_key', 'aead-det');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.encrypt_secret(secret TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgsodium.crypto_aead_det_encrypt(
    secret::BYTEA,
    NULL,
    (SELECT decrypted_secret FROM pgsodium.decrypted_key WHERE name = 'oauth_encryption_key' LIMIT 1)::BYTEA
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted_secret BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_secret,
      NULL,
      (SELECT decrypted_secret FROM pgsodium.decrypted_key WHERE name = 'oauth_encryption_key' LIMIT 1)::BYTEA
    ),
    'UTF8'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_secret(BYTEA) TO service_role;

COMMENT ON FUNCTION public.encrypt_secret IS 'Encrypt OAuth tokens and API keys using pgsodium AEAD';
COMMENT ON FUNCTION public.decrypt_secret IS 'Decrypt OAuth tokens and API keys using pgsodium AEAD';
