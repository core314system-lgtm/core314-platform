-- ============================================================
-- CORE314 – PHASE 2 STEP 2: ADAPTIVE WEIGHT TUNING & SCORE HISTORY
-- Author: ChatGPT (Schema Design)
-- Executor: Devin (Run + Integrate)
-- Date: October 13, 2025
-- Purpose:
-- 1. Extend fusion_scores table to support adaptive weighting
-- 2. Create fusion_score_history table for trend tracking
-- 3. Prepare backend schema for AI-driven insights in Phase 3
-- ============================================================

-- -----------------------------
-- 1️⃣  SAFETY CHECKS
-- -----------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fusion_scores' AND column_name = 'fusion_score'
  ) THEN
    RAISE EXCEPTION 'fusion_scores table not found or invalid structure';
  END IF;
END $$;


-- -----------------------------
-- 2️⃣  TABLE MODIFICATIONS – fusion_scores
-- -----------------------------

ALTER TABLE fusion_scores
  ADD COLUMN IF NOT EXISTS weight_factor NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS baseline_score NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS learning_rate NUMERIC DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS last_adjusted TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS adaptive_notes TEXT DEFAULT 'N/A';


-- -----------------------------
-- 3️⃣  CREATE NEW TABLE – fusion_score_history
-- -----------------------------

CREATE TABLE IF NOT EXISTS fusion_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
  fusion_score NUMERIC NOT NULL,
  weight_factor NUMERIC DEFAULT 1.0,
  baseline_score NUMERIC DEFAULT 50,
  learning_rate NUMERIC DEFAULT 0.05,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason TEXT DEFAULT 'Automated entry',
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE fusion_score_history IS
  'Stores historical snapshots of fusion scoring for trend analysis and AI calibration.';


-- -----------------------------
-- 4️⃣  INDEXING & PERFORMANCE OPTIMIZATION
-- -----------------------------

CREATE INDEX IF NOT EXISTS idx_fusion_history_user 
  ON fusion_score_history (user_id);

CREATE INDEX IF NOT EXISTS idx_fusion_history_integration 
  ON fusion_score_history (integration_id);

CREATE INDEX IF NOT EXISTS idx_fusion_history_recorded 
  ON fusion_score_history (recorded_at);


-- -----------------------------
-- 5️⃣  AUDIT LOG INSERT TRIGGER (Optional but recommended)
-- -----------------------------

CREATE OR REPLACE FUNCTION log_fusion_score_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO fusion_score_history (user_id, integration_id, fusion_score, weight_factor, baseline_score, learning_rate, change_reason)
  VALUES (NEW.user_id, NEW.integration_id, NEW.fusion_score, NEW.weight_factor, NEW.baseline_score, NEW.learning_rate, 'Auto-log via trigger');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_fusion_score_update ON fusion_scores;

CREATE TRIGGER trg_log_fusion_score_update
AFTER INSERT OR UPDATE ON fusion_scores
FOR EACH ROW
EXECUTE FUNCTION log_fusion_score_update();


-- -----------------------------
-- 6️⃣  CLEANUP & VALIDATION
-- -----------------------------

GRANT SELECT, INSERT, UPDATE ON fusion_scores TO anon, service_role;
GRANT SELECT, INSERT ON fusion_score_history TO anon, service_role;

NOTIFY pgrst, 'reload schema';
