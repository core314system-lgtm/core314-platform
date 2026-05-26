-- Procuvex Subscription & Hardening Migration
-- Run this in Supabase SQL Editor

-- 1. Add subscription columns to organizations table
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'no_subscription',
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz DEFAULT NULL;

-- 2. Create support_tickets table for chatbot escalation
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text DEFAULT '',
  user_name text DEFAULT '',
  org_id uuid REFERENCES organizations(id),
  message text NOT NULL,
  conversation_context text DEFAULT '',
  preferred_contact text DEFAULT 'email',
  status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  response text DEFAULT NULL,
  responded_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_org_access ON support_tickets FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

-- 3. Create account_usage table for rate limiting
CREATE TABLE IF NOT EXISTS account_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  action_type text NOT NULL, -- 'ai_call', 'email_sent'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE account_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_usage_org_access ON account_usage FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

-- Index for fast rate limit queries
CREATE INDEX IF NOT EXISTS idx_account_usage_org_action_time 
  ON account_usage(org_id, action_type, created_at DESC);

-- 4. Add org_id to tables that are missing it (hardening)
-- project_subcontractors
ALTER TABLE project_subcontractors 
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- Backfill org_id from task_orders
UPDATE project_subcontractors ps
SET org_id = t.org_id
FROM task_orders t
WHERE ps.task_order_id = t.id AND ps.org_id IS NULL;

ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_subs_org_access ON project_subcontractors;
CREATE POLICY project_subs_org_access ON project_subcontractors FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

-- sow_subcontractors
ALTER TABLE sow_subcontractors 
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

UPDATE sow_subcontractors ss
SET org_id = t.org_id
FROM task_orders t
WHERE ss.task_order_id = t.id AND ss.org_id IS NULL;

ALTER TABLE sow_subcontractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sow_subs_org_access ON sow_subcontractors;
CREATE POLICY sow_subs_org_access ON sow_subcontractors FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

-- documents (check if org_id exists)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

UPDATE documents d
SET org_id = t.org_id
FROM task_orders t
WHERE d.task_order_id = t.id AND d.org_id IS NULL;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS docs_org_access ON documents;
CREATE POLICY docs_org_access ON documents FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

-- 5. Set initial trial for existing org (7-day trial starting now)
UPDATE organizations 
SET subscription_status = 'trialing',
    trial_ends_at = now() + interval '7 days'
WHERE subscription_status = 'no_subscription' OR subscription_status IS NULL;
