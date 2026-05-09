-- Fix: Replace broken CHECK constraint (subqueries not allowed in CHECK) with FK constraint
-- The previous migration's DO $$ block silently failed, leaving entity_type unvalidated.

-- Drop the broken/missing CHECK constraint (no-op if it doesn't exist)
ALTER TABLE resolved_entities
  DROP CONSTRAINT IF EXISTS resolved_entities_entity_type_check;

-- Add proper FK constraint referencing entity_type_definitions.name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'resolved_entities_entity_type_fk'
      AND table_name = 'resolved_entities'
  ) THEN
    ALTER TABLE resolved_entities
      ADD CONSTRAINT resolved_entities_entity_type_fk
      FOREIGN KEY (entity_type) REFERENCES entity_type_definitions(name);
  END IF;
END $$;
