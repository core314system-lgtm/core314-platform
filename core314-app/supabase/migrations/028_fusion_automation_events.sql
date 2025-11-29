
CREATE TABLE IF NOT EXISTS fusion_automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_events_user ON fusion_automation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_events_created ON fusion_automation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_events_type ON fusion_automation_events(event_type);

ALTER TABLE fusion_automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_select_fusion_events"
ON fusion_automation_events FOR SELECT
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "admin_can_insert_fusion_events"
ON fusion_automation_events FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "anon_can_select_fusion_events"
ON fusion_automation_events FOR SELECT
TO anon
USING (true);

CREATE POLICY "authenticated_can_select_fusion_events"
ON fusion_automation_events FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON fusion_automation_events TO anon;
GRANT SELECT ON fusion_automation_events TO authenticated;
GRANT ALL ON fusion_automation_events TO service_role;
