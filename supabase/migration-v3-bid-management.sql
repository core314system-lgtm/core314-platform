-- ============================================================
-- Migration V3: Subcontractor Bid Management System
-- SOW tracking, outreach, quotes, and bid summary
-- ============================================================

-- 1. SOW Items table — each identified SOW/service category per task order
CREATE TABLE IF NOT EXISTS sow_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  sow_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  description TEXT,
  source_document TEXT,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'subs_identified', 'rfqs_sent', 'quotes_received', 'evaluating', 'awarded')),
  awarded_subcontractor_id UUID REFERENCES subcontractors(id),
  awarded_amount NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SOW-Subcontractor assignments — which subs are matched/invited for each SOW
CREATE TABLE IF NOT EXISTS sow_subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sow_item_id UUID NOT NULL REFERENCES sow_items(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0,
  outreach_status TEXT NOT NULL DEFAULT 'identified'
    CHECK (outreach_status IN ('identified', 'invited', 'reviewing', 'questions_pending', 'quote_submitted', 'declined', 'no_response', 'awarded', 'not_selected')),
  rfq_sent_date TIMESTAMPTZ,
  rfq_due_date TIMESTAMPTZ,
  response_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sow_item_id, subcontractor_id)
);

-- 3. Communication log — track every interaction with a sub for a SOW
CREATE TABLE IF NOT EXISTS sow_communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sow_subcontractor_id UUID NOT NULL REFERENCES sow_subcontractors(id) ON DELETE CASCADE,
  comm_type TEXT NOT NULL CHECK (comm_type IN ('rfq_sent', 'question', 'response', 'follow_up', 'quote_received', 'clarification', 'award_notice', 'decline_notice', 'note')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound', 'internal')),
  subject TEXT,
  body TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Subcontractor quotes — detailed quote data per SOW
CREATE TABLE IF NOT EXISTS sow_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sow_subcontractor_id UUID NOT NULL REFERENCES sow_subcontractors(id) ON DELETE CASCADE,
  sow_item_id UUID NOT NULL REFERENCES sow_items(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2),
  monthly_amount NUMERIC(12,2),
  annual_amount NUMERIC(12,2),
  labor_cost NUMERIC(12,2),
  materials_cost NUMERIC(12,2),
  equipment_cost NUMERIC(12,2),
  overhead_markup NUMERIC(5,2),
  scope_inclusions TEXT,
  scope_exclusions TEXT,
  assumptions TEXT,
  timeline TEXT,
  payment_terms TEXT,
  validity_period TEXT,
  attachment_path TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'under_review', 'clarification_needed', 'accepted', 'rejected', 'expired')),
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_quotes ENABLE ROW LEVEL SECURITY;

-- Policies — allow authenticated users full access
CREATE POLICY "sow_items_all" ON sow_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sow_subcontractors_all" ON sow_subcontractors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sow_communications_all" ON sow_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sow_quotes_all" ON sow_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sow_items_task_order ON sow_items(task_order_id);
CREATE INDEX IF NOT EXISTS idx_sow_subcontractors_sow ON sow_subcontractors(sow_item_id);
CREATE INDEX IF NOT EXISTS idx_sow_subcontractors_sub ON sow_subcontractors(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sow_communications_sow_sub ON sow_communications(sow_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sow_quotes_sow_item ON sow_quotes(sow_item_id);
CREATE INDEX IF NOT EXISTS idx_sow_quotes_sub ON sow_quotes(subcontractor_id);
