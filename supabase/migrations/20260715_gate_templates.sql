-- Gate Review Templates — org-level customizable gate structures
CREATE TABLE IF NOT EXISTS gate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL DEFAULT 'Default',
  gates JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org gate templates"
  ON gate_templates FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
