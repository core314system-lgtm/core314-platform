-- ============================================================
-- Admin User Deletion Support
-- Adds soft delete capability and account status tracking
-- ============================================================

-- Add deleted_at column for soft delete tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Add account_status column for explicit account state management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active' 
CHECK (account_status IN ('active', 'inactive', 'suspended'));

-- Create index on deleted_at for efficient filtering of active users
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- Create index on account_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- Create admin_audit_logs table for tracking admin actions
-- This is separate from fusion_audit_log which tracks system events
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID,
  action TEXT NOT NULL CHECK (action IN (
    'user_soft_deleted',
    'user_hard_deleted',
    'user_restored',
    'user_suspended',
    'user_updated'
  )),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for admin audit logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- Enable RLS on admin audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view admin audit logs
CREATE POLICY "Platform admins can view admin audit logs"
ON public.admin_audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_platform_admin = true
  )
);

-- Service role can insert audit logs
CREATE POLICY "Service role can insert admin audit logs"
ON public.admin_audit_logs FOR INSERT
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.admin_audit_logs TO service_role;
GRANT SELECT ON public.admin_audit_logs TO authenticated;

-- Comment on new columns and table
COMMENT ON COLUMN public.profiles.deleted_at IS 'Timestamp when user was soft-deleted, NULL if active';
COMMENT ON COLUMN public.profiles.account_status IS 'Account status: active, inactive (soft-deleted), or suspended';
COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail for admin actions on user accounts';
