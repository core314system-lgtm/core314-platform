
ALTER TABLE user_onboarding_progress ADD COLUMN IF NOT EXISTS step_5_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE user_onboarding_progress ALTER COLUMN total_steps SET DEFAULT 5;

UPDATE user_onboarding_progress SET total_steps = 5 WHERE total_steps = 4;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_status ON profiles(onboarding_status);

COMMENT ON COLUMN user_onboarding_progress.step_5_completed IS 'Phase 16: Final setup completion step';
