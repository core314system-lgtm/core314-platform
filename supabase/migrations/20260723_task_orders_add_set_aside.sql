-- Add missing set_aside column to task_orders.
-- The TaskOrder type and SAM.gov opportunity import (OpportunityDiscovery.handleImport)
-- both write task_orders.set_aside, but the column was never applied to production
-- (naics_code exists, set_aside does not). Without it, the import's insert errors and
-- falls back to dropping BOTH set_aside and naics_code, so imported projects silently
-- lose their structured NAICS code and set-aside. This restores schema/code parity.
ALTER TABLE public.task_orders ADD COLUMN IF NOT EXISTS set_aside text;
