-- NPS (Net Promoter Score) responses table
-- Stores user feedback collected via in-app survey
CREATE TABLE IF NOT EXISTS nps_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback text,
  created_at timestamptz DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_nps_responses_user_id ON nps_responses(user_id);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_nps_responses_score ON nps_responses(score);

-- RLS policies
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

-- Users can insert their own NPS responses
CREATE POLICY "Users can insert own NPS responses"
  ON nps_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own NPS responses
CREATE POLICY "Users can read own NPS responses"
  ON nps_responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read all (for admin analytics)
CREATE POLICY "Service role can read all NPS responses"
  ON nps_responses FOR SELECT
  TO service_role
  USING (true);
