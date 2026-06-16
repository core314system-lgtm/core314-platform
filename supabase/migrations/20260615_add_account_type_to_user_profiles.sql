-- Add account_type column to distinguish platform users from subcontractor accounts
-- Platform users get full app access; subcontractor accounts can only access their profile and RFQ portal

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'platform';

-- Mark existing users who have claimed subcontractor profiles as subcontractor accounts
UPDATE user_profiles
SET account_type = 'subcontractor'
WHERE id IN (
  SELECT DISTINCT claimed_by_user_id
  FROM master_subcontractors
  WHERE claimed_by_user_id IS NOT NULL
)
AND is_global_admin IS NOT TRUE;

-- Add index for filtering by account_type
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type ON user_profiles(account_type);
