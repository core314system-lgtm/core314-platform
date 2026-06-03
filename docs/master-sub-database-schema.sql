-- ============================================================
-- Master Subcontractor Database Schema
-- Phase 1: SAM.gov Seed + Profile Infrastructure
-- ============================================================

-- Main master subcontractors table
CREATE TABLE IF NOT EXISTS public.master_subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  dba_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  description TEXT,
  
  -- SAM.gov fields
  sam_uei TEXT UNIQUE,  -- Unique Entity ID (replaces DUNS)
  cage_code TEXT,
  naics_codes TEXT[] DEFAULT '{}',
  psc_codes TEXT[] DEFAULT '{}',
  sam_registration_status TEXT,  -- 'Active', 'Inactive', 'Expired'
  sam_registration_date DATE,
  sam_expiration_date DATE,
  entity_type TEXT,  -- 'Business', 'Individual', etc.
  
  -- Categorization
  service_categories TEXT[] DEFAULT '{}',
  trade_categories TEXT[] DEFAULT '{}',
  geographic_coverage TEXT[] DEFAULT '{}',
  service_radius_miles INTEGER,
  
  -- Small business certifications
  small_business BOOLEAN DEFAULT FALSE,
  small_business_types TEXT[] DEFAULT '{}',  -- '8(a)', 'SDVOSB', 'HUBZone', 'WOSB', 'EDWOSB'
  
  -- Verification & claiming
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'claimed', 'pending_verification', 'verified', 'expired')),
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  claim_token TEXT UNIQUE,
  verified_at TIMESTAMPTZ,
  verification_expires_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  
  -- Profile
  profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
  logo_url TEXT,
  capability_statement_path TEXT,
  
  -- Tracking
  data_source TEXT DEFAULT 'sam_gov' CHECK (data_source IN ('sam_gov', 'manual', 'import', 'self_register')),
  source_id TEXT,  -- External ID for dedup (e.g., SAM.gov entity ID)
  match_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_master_subs_slug ON public.master_subcontractors(slug);
CREATE INDEX IF NOT EXISTS idx_master_subs_email ON public.master_subcontractors(contact_email);
CREATE INDEX IF NOT EXISTS idx_master_subs_sam_uei ON public.master_subcontractors(sam_uei);
CREATE INDEX IF NOT EXISTS idx_master_subs_state ON public.master_subcontractors(state);
CREATE INDEX IF NOT EXISTS idx_master_subs_verification ON public.master_subcontractors(verification_status);
CREATE INDEX IF NOT EXISTS idx_master_subs_service_cats ON public.master_subcontractors USING GIN(service_categories);
CREATE INDEX IF NOT EXISTS idx_master_subs_trade_cats ON public.master_subcontractors USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_master_subs_naics ON public.master_subcontractors USING GIN(naics_codes);
CREATE INDEX IF NOT EXISTS idx_master_subs_small_biz ON public.master_subcontractors USING GIN(small_business_types);
CREATE INDEX IF NOT EXISTS idx_master_subs_claim_token ON public.master_subcontractors(claim_token);
CREATE INDEX IF NOT EXISTS idx_master_subs_created ON public.master_subcontractors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_subs_company_name ON public.master_subcontractors USING GIN(to_tsvector('english', company_name));

-- Certifications/documents table for verified subs
CREATE TABLE IF NOT EXISTS public.master_sub_certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  master_sub_id UUID NOT NULL REFERENCES public.master_subcontractors(id) ON DELETE CASCADE,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('license', 'insurance', 'certification', 'w9', 'capability_statement', 'bond', 'other')),
  cert_name TEXT NOT NULL,
  issuing_authority TEXT,
  cert_number TEXT,
  effective_date DATE,
  expiration_date DATE,
  coverage_amount DECIMAL,
  document_path TEXT,
  ai_verified BOOLEAN DEFAULT FALSE,
  ai_verification_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_sub_certs_sub ON public.master_sub_certifications(master_sub_id);
CREATE INDEX IF NOT EXISTS idx_master_sub_certs_expiry ON public.master_sub_certifications(expiration_date);

-- Contact/outreach log
CREATE TABLE IF NOT EXISTS public.master_sub_contact_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  master_sub_id UUID NOT NULL REFERENCES public.master_subcontractors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'claim_email_sent', 'claim_email_opened', 'claim_email_clicked',
    'profile_claimed', 'profile_viewed', 'profile_updated',
    'verification_started', 'verification_completed', 'verification_expired',
    'matched_to_project', 'rfq_received', 'rfq_responded'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_sub_log_sub ON public.master_sub_contact_log(master_sub_id);
CREATE INDEX IF NOT EXISTS idx_master_sub_log_type ON public.master_sub_contact_log(event_type);

-- RLS policies
ALTER TABLE public.master_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_sub_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_sub_contact_log ENABLE ROW LEVEL SECURITY;

-- Public read access for master_subcontractors (public profiles)
CREATE POLICY "Public read master subs" ON public.master_subcontractors 
  FOR SELECT USING (true);

-- Authenticated users can insert (for imports)
CREATE POLICY "Auth insert master subs" ON public.master_subcontractors 
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "Auth update master subs" ON public.master_subcontractors 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role master subs" ON public.master_subcontractors 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Certs: authenticated read/write
CREATE POLICY "Auth read certs" ON public.master_sub_certifications 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert certs" ON public.master_sub_certifications 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role certs" ON public.master_sub_certifications 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contact log: authenticated read/write
CREATE POLICY "Auth read contact log" ON public.master_sub_contact_log 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert contact log" ON public.master_sub_contact_log 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role contact log" ON public.master_sub_contact_log 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon read access for public profiles
CREATE POLICY "Anon read master subs" ON public.master_subcontractors 
  FOR SELECT TO anon USING (true);
