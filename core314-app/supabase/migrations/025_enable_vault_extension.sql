-- ============================================================
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgsodium;

CREATE EXTENSION IF NOT EXISTS vault;

GRANT ALL ON ALL TABLES IN SCHEMA vault TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO service_role;
GRANT USAGE ON SCHEMA vault TO service_role;

COMMENT ON EXTENSION vault IS 'Secure secret storage for OAuth tokens and API keys';
