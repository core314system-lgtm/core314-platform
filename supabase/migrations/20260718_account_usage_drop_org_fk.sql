-- ============================================================================
-- Drop the account_usage -> organizations foreign key
--
-- Root cause of the rate limiter never enforcing in production: every usage
-- INSERT was rejected with
--   "insert or update on table account_usage violates foreign key constraint
--    account_usage_org_id_fkey"
-- because the limiter's key is not always a row in organizations:
--   * ai-proxy falls back to the user id when the user has no current_org_id
--   * per-user / synthetic keys are legitimate limiter buckets
-- The failed insert is swallowed as fail-open, so the counter never grows and
-- no 429 is ever returned.
--
-- account_usage is an append-only metering log; it does not need referential
-- integrity to organizations (stale rows are harmless and pruned after 90 days
-- by the database-hygiene cron). Dropping the constraint lets the limiter record
-- usage for any bucket key and actually enforce limits.
-- ============================================================================

ALTER TABLE account_usage DROP CONSTRAINT IF EXISTS account_usage_org_id_fkey;
