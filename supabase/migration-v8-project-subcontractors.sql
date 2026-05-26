-- ============================================================
-- Migration V8: Project-Specific Subcontractor Matrix
-- Links subcontractors to individual projects with per-project
-- status tracking, separate from the master subcontractor database
-- ============================================================

-- 1. Project Subcontractors junction table
CREATE TABLE IF NOT EXISTS project_subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  relevance_reason TEXT,
  matched_requirements TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'matched' CHECK (status IN ('matched', 'shortlisted', 'invited', 'quoted', 'awarded', 'rejected', 'removed')),
  source TEXT DEFAULT 'ai_match' CHECK (source IN ('ai_match', 'auto_discover', 'manual', 'sow_tracker')),
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, subcontractor_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_project_subs_task_order ON project_subcontractors(task_order_id);
CREATE INDEX IF NOT EXISTS idx_project_subs_subcontractor ON project_subcontractors(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_project_subs_status ON project_subcontractors(status);

-- 3. Enable RLS
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "project_subs_select" ON project_subcontractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_subs_insert" ON project_subcontractors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "project_subs_update" ON project_subcontractors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "project_subs_delete" ON project_subcontractors FOR DELETE TO authenticated USING (true);
CREATE POLICY "project_subs_service_role" ON project_subcontractors FOR ALL TO service_role USING (true);
