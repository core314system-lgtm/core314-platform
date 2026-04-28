-- Pre-launch preparation for Cross-System Identity Resolution
-- Adds a nullable resolved_entity_ids column to operational_signals
-- so the schema is in place before beta testers start generating data.
--
-- This column will be populated by the future entity-resolver edge function.
-- No code changes required — purely a schema addition.

ALTER TABLE operational_signals
  ADD COLUMN IF NOT EXISTS resolved_entity_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_operational_signals_resolved_entities
  ON operational_signals USING GIN (resolved_entity_ids);

COMMENT ON COLUMN operational_signals.resolved_entity_ids IS
  'Canonical resolved entity IDs linked to this signal. Populated by entity-resolver (future). Empty until identity resolution is enabled.';
