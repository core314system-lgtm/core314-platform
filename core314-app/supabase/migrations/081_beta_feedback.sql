-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    category TEXT CHECK (category IN ('bug', 'feature', 'usability', 'performance', 'other')),
    page_path TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'wont_fix')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id 
ON beta_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_rating 
ON beta_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_status 
ON beta_feedback(status);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_category 
ON beta_feedback(category);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at 
ON beta_feedback(created_at DESC);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on beta_feedback"
ON beta_feedback
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can insert own feedback"
ON beta_feedback
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own feedback"
ON beta_feedback
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT ALL ON beta_feedback TO service_role;
GRANT INSERT, SELECT ON beta_feedback TO authenticated;

CREATE OR REPLACE FUNCTION get_feedback_analytics()
RETURNS TABLE (
    total_feedback INTEGER,
    avg_rating NUMERIC,
    rating_distribution JSONB,
    category_distribution JSONB,
    status_distribution JSONB,
    recent_feedback_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total INTEGER;
    v_avg_rating NUMERIC;
    v_rating_dist JSONB;
    v_category_dist JSONB;
    v_status_dist JSONB;
    v_recent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM beta_feedback;
    
    SELECT AVG(rating)::NUMERIC(3,2) INTO v_avg_rating
    FROM beta_feedback;
    
    SELECT jsonb_object_agg(rating::TEXT, count)
    INTO v_rating_dist
    FROM (
        SELECT rating, COUNT(*)::INTEGER as count
        FROM beta_feedback
        GROUP BY rating
        ORDER BY rating
    ) r;
    
    SELECT jsonb_object_agg(COALESCE(category, 'uncategorized'), count)
    INTO v_category_dist
    FROM (
        SELECT COALESCE(category, 'uncategorized') as category, COUNT(*)::INTEGER as count
        FROM beta_feedback
        GROUP BY category
    ) c;
    
    SELECT jsonb_object_agg(status, count)
    INTO v_status_dist
    FROM (
        SELECT status, COUNT(*)::INTEGER as count
        FROM beta_feedback
        GROUP BY status
    ) s;
    
    SELECT COUNT(*) INTO v_recent_count
    FROM beta_feedback
    WHERE created_at > NOW() - INTERVAL '7 days';
    
    RETURN QUERY SELECT 
        v_total,
        v_avg_rating,
        COALESCE(v_rating_dist, '{}'::jsonb),
        COALESCE(v_category_dist, '{}'::jsonb),
        COALESCE(v_status_dist, '{}'::jsonb),
        v_recent_count;
END;
$$;

CREATE OR REPLACE FUNCTION update_feedback_status(
    p_feedback_id UUID,
    p_status TEXT,
    p_admin_notes TEXT,
    p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE beta_feedback
    SET status = p_status,
        admin_notes = p_admin_notes,
        reviewed_by = p_admin_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_feedback_id;
    
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feedback_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION update_feedback_status(UUID, TEXT, TEXT, UUID) TO service_role;

COMMENT ON TABLE beta_feedback IS 'Captures user feedback with ratings and comments during beta';
COMMENT ON FUNCTION get_feedback_analytics() IS 'Returns comprehensive feedback analytics including distributions and averages';
COMMENT ON FUNCTION update_feedback_status(UUID, TEXT, TEXT, UUID) IS 'Updates feedback status and admin notes';
