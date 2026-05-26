
UPDATE public.profiles 
SET 
    is_platform_admin = TRUE,
    role = 'admin',
    subscription_tier = 'none',
    subscription_status = 'inactive',
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL
WHERE email = 'core314system@gmail.com';

UPDATE public.profiles 
SET 
    is_platform_admin = TRUE,
    role = 'admin',
    subscription_tier = 'none',
    subscription_status = 'inactive',
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL
WHERE email = 'support@govmatchai.com';

COMMENT ON COLUMN public.profiles.is_platform_admin IS 'Primary governance flag for platform administrator access - when TRUE, user has full platform access regardless of role or subscription';
