-- Add opportunity search preferences column to company_profile
ALTER TABLE public.company_profile
ADD COLUMN IF NOT EXISTS opportunity_preferences JSONB DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN public.company_profile.opportunity_preferences IS 'Stores saved opportunity search preferences (NAICS codes, keywords, set-asides, agencies, states, etc.)';
