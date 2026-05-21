-- ============================================================
-- Migration V7: Workflow Engine
-- Audit trail for stage changes + project assignments
-- ============================================================

-- 1. Workflow History (audit trail)
CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_by_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflow_history_task_order ON workflow_history(task_order_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_created ON workflow_history(created_at DESC);

-- 2. Project Assignments (team members assigned to projects)
CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('lead', 'contributor', 'reviewer', 'observer')),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, user_id)
);

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_assignments_task_order ON project_assignments(task_order_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);

-- 3. RLS Policies for workflow_history
-- Anyone in the org can view audit trail
CREATE POLICY "Users can view workflow history for accessible projects"
  ON workflow_history FOR SELECT
  USING (
    task_order_id IN (SELECT id FROM task_orders)
  );

-- Any authenticated user can insert history (stage changes)
CREATE POLICY "Authenticated users can add workflow history"
  ON workflow_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. RLS Policies for project_assignments
CREATE POLICY "Users can view project assignments"
  ON project_assignments FOR SELECT
  USING (
    task_order_id IN (SELECT id FROM task_orders)
  );

CREATE POLICY "Authenticated users can manage project assignments"
  ON project_assignments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project assignments"
  ON project_assignments FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project assignments"
  ON project_assignments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 5. Seed initial workflow_history for existing projects
-- Records the current stage as the initial state
INSERT INTO workflow_history (task_order_id, from_stage, to_stage, changed_by, changed_by_name, note)
SELECT
  t.id,
  NULL,
  t.status,
  t.created_by,
  (SELECT full_name FROM user_profiles WHERE id = t.created_by),
  'Initial project creation'
FROM task_orders t
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_history wh WHERE wh.task_order_id = t.id
);
