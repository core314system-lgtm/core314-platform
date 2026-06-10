-- Add state directory data sources to the check constraint
ALTER TABLE master_subcontractors DROP CONSTRAINT IF EXISTS master_subcontractors_data_source_check;
ALTER TABLE master_subcontractors ADD CONSTRAINT master_subcontractors_data_source_check
  CHECK (data_source IN ('sam_gov', 'manual', 'import', 'self_register', 'gsa_elibrary', 'texas_hub', 'texas_cmbl', 'state_dbe'));

-- Add external_id column for deduplication against source records
ALTER TABLE master_subcontractors ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_master_sub_external_id ON master_subcontractors(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_sub_data_source_ext ON master_subcontractors(data_source, external_id) WHERE external_id IS NOT NULL;
