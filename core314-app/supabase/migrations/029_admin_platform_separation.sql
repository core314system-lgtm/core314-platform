-- ============================================================
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin ON public.profiles(is_platform_admin);

UPDATE public.profiles SET is_platform_admin = TRUE WHERE role = 'admin';

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
ON public.notifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can update all notifications" ON public.notifications;
CREATE POLICY "Admins can update all notifications"
ON public.notifications FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

UPDATE public.profiles 
SET 
    subscription_tier = 'none',
    subscription_status = 'inactive',
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL
WHERE role = 'admin' AND is_platform_admin = TRUE;

COMMENT ON COLUMN public.profiles.is_platform_admin IS 'Flag indicating if user is a platform administrator with full access regardless of subscription';
