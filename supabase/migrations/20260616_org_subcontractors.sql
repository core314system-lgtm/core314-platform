-- ============================================================
-- Organization-Owned Subcontractor Database
-- Completely isolated from Master Sub Database
-- User data is NEVER shared or ingested into the Procuvex network
-- ============================================================

-- Organization's private subcontractor records
CREATE TABLE IF NOT EXISTS public.org_subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Company info
  company_name TEXT NOT NULL,
  dba_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Categorization
  trade_categories TEXT[] DEFAULT '{}',
  naics_codes TEXT[] DEFAULT '{}',
  service_categories TEXT[] DEFAULT '{}',
  
  -- Certifications / small business
  small_business BOOLEAN DEFAULT FALSE,
  small_business_types TEXT[] DEFAULT '{}',
  
  -- Government IDs (optional)
  sam_uei TEXT,
  cage_code TEXT,
  
  -- Custom fields the user wants to track
  notes TEXT,
  internal_rating INTEGER CHECK (internal_rating >= 1 AND internal_rating <= 5),
  tags TEXT[] DEFAULT '{}',
  
  -- Import metadata
  data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'csv_import', 'excel_import')),
  import_batch_id TEXT,
  
  -- Tracking
  outreach_count INTEGER DEFAULT 0,
  last_outreach_at TIMESTAMPTZ,
  project_count INTEGER DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_subs_org ON public.org_subcontractors(org_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_company_name ON public.org_subcontractors USING GIN(to_tsvector('english', company_name));
CREATE INDEX IF NOT EXISTS idx_org_subs_state ON public.org_subcontractors(state);
CREATE INDEX IF NOT EXISTS idx_org_subs_trade ON public.org_subcontractors USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_org_subs_tags ON public.org_subcontractors USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_org_subs_email ON public.org_subcontractors(contact_email);
CREATE INDEX IF NOT EXISTS idx_org_subs_created ON public.org_subcontractors(created_at DESC);

-- Junction table: links subcontractors (from either source) to projects
CREATE TABLE IF NOT EXISTS public.project_subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.task_orders(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Polymorphic reference: exactly one must be set
  source TEXT NOT NULL CHECK (source IN ('org', 'master')),
  org_sub_id UUID REFERENCES public.org_subcontractors(id) ON DELETE CASCADE,
  master_sub_id UUID REFERENCES public.master_subcontractors(id) ON DELETE SET NULL,
  
  -- Assignment metadata
  sow_item_id UUID REFERENCES public.sow_items(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'contacted', 'quoted', 'accepted', 'declined', 'removed')),
  notes TEXT,
  
  -- Tracking
  contacted_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  quote_amount DECIMAL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure exactly one source reference is set
  CONSTRAINT chk_source_ref CHECK (
    (source = 'org' AND org_sub_id IS NOT NULL AND master_sub_id IS NULL) OR
    (source = 'master' AND master_sub_id IS NOT NULL AND org_sub_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_proj_subs_project ON public.project_subcontractors(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_subs_org ON public.project_subcontractors(org_id);
CREATE INDEX IF NOT EXISTS idx_proj_subs_org_sub ON public.project_subcontractors(org_sub_id);
CREATE INDEX IF NOT EXISTS idx_proj_subs_master_sub ON public.project_subcontractors(master_sub_id);
CREATE INDEX IF NOT EXISTS idx_proj_subs_sow ON public.project_subcontractors(sow_item_id);
CREATE INDEX IF NOT EXISTS idx_proj_subs_status ON public.project_subcontractors(status);

-- Activity log for org subcontractors (separate from master sub contact log)
CREATE TABLE IF NOT EXISTS public.org_sub_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_sub_id UUID NOT NULL REFERENCES public.org_subcontractors(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'updated', 'imported',
    'assigned_to_project', 'removed_from_project',
    'outreach_sent', 'outreach_opened', 'outreach_clicked',
    'quote_requested', 'quote_received',
    'status_changed', 'note_added'
  )),
  
  -- Context
  project_id UUID REFERENCES public.task_orders(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  performed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_sub_activity_org ON public.org_sub_activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_org_sub_activity_sub ON public.org_sub_activity_log(org_sub_id);
CREATE INDEX IF NOT EXISTS idx_org_sub_activity_type ON public.org_sub_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_org_sub_activity_created ON public.org_sub_activity_log(created_at DESC);

-- RLS Policies: Org A can NEVER see Org B's data
ALTER TABLE public.org_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_sub_activity_log ENABLE ROW LEVEL SECURITY;

-- org_subcontractors: users can only see/manage their own org's subs
CREATE POLICY "org_subs_select" ON public.org_subcontractors FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_subs_insert" ON public.org_subcontractors FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_subs_update" ON public.org_subcontractors FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_subs_delete" ON public.org_subcontractors FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- project_subcontractors: scoped to org
CREATE POLICY "proj_subs_select" ON public.project_subcontractors FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "proj_subs_insert" ON public.project_subcontractors FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "proj_subs_update" ON public.project_subcontractors FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "proj_subs_delete" ON public.project_subcontractors FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- org_sub_activity_log: scoped to org
CREATE POLICY "org_sub_activity_select" ON public.org_sub_activity_log FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_sub_activity_insert" ON public.org_sub_activity_log FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- Service role bypass for all tables (for Netlify functions)
CREATE POLICY "service_role_org_subs" ON public.org_subcontractors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_proj_subs" ON public.project_subcontractors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_org_sub_activity" ON public.org_sub_activity_log FOR ALL
  USING (auth.role() = 'service_role');
