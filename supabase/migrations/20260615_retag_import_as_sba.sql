-- Record 'sba' as a first-class data_source and re-tag the bulk public
-- SBA small-business records that were previously loaded under the generic
-- 'import' label. This makes the subcontractor DB provenance self-documenting
-- for diligence: every record now carries the public government source it came
-- from (sba, sam_gov, gsa_elibrary, texas_hub, ...).

ALTER TABLE public.master_subcontractors
  DROP CONSTRAINT IF EXISTS master_subcontractors_data_source_check;

ALTER TABLE public.master_subcontractors
  ADD CONSTRAINT master_subcontractors_data_source_check CHECK (
    data_source = ANY (ARRAY[
      'sam_gov'::text,
      'manual'::text,
      'import'::text,
      'self_register'::text,
      'gsa_elibrary'::text,
      'texas_hub'::text,
      'texas_cmbl'::text,
      'state_dbe'::text,
      'sba'::text
    ])
  );

UPDATE public.master_subcontractors
  SET data_source = 'sba'
  WHERE data_source = 'import';
