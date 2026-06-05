-- Add unsubscribe tracking columns to master_subcontractors
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false;
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Index for filtering out unsubscribed records during outreach
CREATE INDEX IF NOT EXISTS idx_master_subs_unsubscribed ON master_subcontractors(unsubscribed) WHERE unsubscribed = true;
