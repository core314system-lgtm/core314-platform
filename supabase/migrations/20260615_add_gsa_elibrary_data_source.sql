-- Add 'gsa_elibrary' to the data_source check constraint
ALTER TABLE master_subcontractors DROP CONSTRAINT IF EXISTS master_subcontractors_data_source_check;
ALTER TABLE master_subcontractors ADD CONSTRAINT master_subcontractors_data_source_check
  CHECK (data_source IN ('sam_gov', 'manual', 'import', 'self_register', 'gsa_elibrary'));
