-- Add columns to track bot-filtered (human) engagement metrics
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS human_open_count integer DEFAULT 0;
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS human_click_count integer DEFAULT 0;
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS claim_page_visits integer DEFAULT 0;
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS last_claim_page_visit_at timestamptz;
