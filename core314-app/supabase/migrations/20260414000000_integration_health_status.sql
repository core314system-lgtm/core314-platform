-- Add health status column to integration_ingestion_state
-- Values: ACTIVE (poll succeeded, records written), NO_DATA (poll succeeded, 0 records),
--         AUTH_FAILED (401/403 error), ERROR (other errors)
ALTER TABLE integration_ingestion_state
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'NO_DATA', 'AUTH_FAILED', 'ERROR'));

-- Backfill existing rows
UPDATE integration_ingestion_state SET status = 'ACTIVE' WHERE status IS NULL;
