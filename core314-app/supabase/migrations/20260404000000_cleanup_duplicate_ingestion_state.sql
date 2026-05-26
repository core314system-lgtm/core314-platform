-- ============================================================
-- Cleanup duplicate integration_ingestion_state rows
-- 
-- Root cause: poll functions upsert on (user_id, user_integration_id, service_name)
-- but when user_integration_id is NULL, PostgreSQL treats each NULL as unique,
-- so every poll creates a NEW row instead of updating the existing one.
-- This caused 1696+ duplicate microsoft_teams rows, pushing the PostgREST
-- default 1000-row limit and hiding Google integration records from the UI.
--
-- Fix:
-- 1. Delete all duplicate rows, keeping only the most recent per (user_id, service_name)
-- 2. Add a partial unique index for NULL user_integration_id cases
-- ============================================================

-- Step 1: Delete duplicate rows, keeping only the one with the latest last_polled_at
-- For each (user_id, service_name) combination, keep the row with the max last_polled_at
DELETE FROM integration_ingestion_state
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, service_name) id
  FROM integration_ingestion_state
  ORDER BY user_id, service_name, last_polled_at DESC NULLS LAST
);

-- Step 2: Add a partial unique index to prevent future duplicates when user_integration_id is NULL
-- The existing UNIQUE(user_id, user_integration_id, service_name) doesn't catch NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingestion_state_unique_null_ui
ON integration_ingestion_state (user_id, service_name)
WHERE user_integration_id IS NULL;
