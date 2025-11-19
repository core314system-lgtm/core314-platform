-- Add 'skipped' status to automation_reliability_log
-- This allows tests to be marked as skipped (e.g., Teams test when webhook not configured)
-- instead of failed, providing more accurate reliability metrics

-- Drop existing status constraint
ALTER TABLE automation_reliability_log 
  DROP CONSTRAINT IF EXISTS automation_reliability_log_status_check;

-- Add new constraint with 'skipped' status
ALTER TABLE automation_reliability_log 
  ADD CONSTRAINT automation_reliability_log_status_check 
  CHECK (status IN ('success', 'failed', 'skipped'));

COMMENT ON COLUMN automation_reliability_log.status IS 'Test execution status: success (passed), failed (error occurred), skipped (test not run due to configuration)';
