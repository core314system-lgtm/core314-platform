
CREATE TABLE public.user_churn_scores (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    churn_score NUMERIC CHECK (churn_score >= 0 AND churn_score <= 1),
    last_activity TIMESTAMP WITH TIME ZONE,
    sessions_last_7d INT DEFAULT 0,
    events_last_7d INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    prediction_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

CREATE INDEX idx_churn_scores_score ON public.user_churn_scores(churn_score DESC);
CREATE INDEX idx_churn_scores_updated ON public.user_churn_scores(updated_at DESC);

ALTER TABLE public.user_churn_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_select ON public.user_churn_scores
FOR SELECT USING ( auth.role() = 'service_role' );

CREATE POLICY admin_update ON public.user_churn_scores
FOR UPDATE USING ( auth.role() = 'service_role' );

CREATE POLICY admin_insert ON public.user_churn_scores
FOR INSERT WITH CHECK ( auth.role() = 'service_role' );

COMMENT ON TABLE public.user_churn_scores IS 'Stores churn risk predictions for beta users (admin-only access)';
COMMENT ON COLUMN public.user_churn_scores.churn_score IS 'Churn risk score from 0 (low risk) to 1 (high risk)';
COMMENT ON COLUMN public.user_churn_scores.last_activity IS 'Timestamp of user''s most recent activity';
COMMENT ON COLUMN public.user_churn_scores.sessions_last_7d IS 'Number of unique session days in last 7 days';
COMMENT ON COLUMN public.user_churn_scores.events_last_7d IS 'Total event count in last 7 days';
COMMENT ON COLUMN public.user_churn_scores.streak_days IS 'Current consecutive days of activity';
COMMENT ON COLUMN public.user_churn_scores.prediction_reason IS 'Human-readable explanation of churn prediction';
