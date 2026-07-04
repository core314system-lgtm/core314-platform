-- GovCon Expert Evaluation: New features migration
-- Past Performance Citations, Capture Gates, Contract Vehicles,
-- Color Team Reviews, Labor Categories, SB Subcontracting Plans

-- ============================================================
-- 1. PAST PERFORMANCE CITATION LIBRARY
-- ============================================================
CREATE TABLE IF NOT EXISTS past_performance_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_title TEXT NOT NULL,
  contract_number TEXT,
  agency TEXT,
  client_name TEXT,
  contract_type TEXT, -- FFP, T&M, CPFF, CPAF, CPIF, IDIQ, BPA
  naics_code TEXT,
  set_aside TEXT,
  contract_value NUMERIC,
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  relevance_tags TEXT[] DEFAULT '{}',
  service_categories TEXT[] DEFAULT '{}',
  description TEXT,
  our_role TEXT, -- prime, subcontractor, jv_partner, mentor, protege
  key_personnel TEXT[] DEFAULT '{}',
  cpars_rating TEXT, -- exceptional, very_good, satisfactory, marginal, unsatisfactory
  past_performance_narrative TEXT,
  lessons_learned TEXT,
  reusable_content JSONB DEFAULT '{}', -- sections that can be copy-pasted into proposals
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE past_performance_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org past performance"
  ON past_performance_citations FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- Link past performance to projects
CREATE TABLE IF NOT EXISTS project_past_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  citation_id UUID NOT NULL REFERENCES past_performance_citations(id) ON DELETE CASCADE,
  relevance_score INTEGER DEFAULT 0, -- 0-100 match score
  relevance_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, citation_id)
);

ALTER TABLE project_past_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage project past performance links"
  ON project_past_performance FOR ALL
  TO authenticated
  USING (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
  WITH CHECK (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));

-- ============================================================
-- 2. CAPTURE GATE REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS capture_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  gate_number INTEGER NOT NULL, -- 0-4
  gate_name TEXT NOT NULL, -- e.g. 'Qualify', 'Capture Strategy', 'Win Strategy', 'Proposal Ready', 'Submit/No-Submit'
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, passed, failed, skipped
  scheduled_date DATE,
  completed_date DATE,
  decision TEXT, -- go, no_go, conditional_go
  decision_rationale TEXT,
  checklist JSONB DEFAULT '[]', -- [{item: string, checked: boolean, notes: string}]
  reviewers TEXT[] DEFAULT '{}',
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, gate_number)
);

ALTER TABLE capture_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org capture gates"
  ON capture_gates FOR ALL
  TO authenticated
  USING (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
  WITH CHECK (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));

-- ============================================================
-- 3. CONTRACT VEHICLE REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_name TEXT NOT NULL, -- e.g. 'GSA MAS', 'OASIS', 'SEWP V', 'CIO-SP3'
  vehicle_type TEXT NOT NULL, -- gsa_schedule, gwac, bpa, idiq, agency_idiq, other
  contract_number TEXT,
  ordering_period_start DATE,
  ordering_period_end DATE,
  ceiling_value NUMERIC,
  naics_codes TEXT[] DEFAULT '{}',
  sin_numbers TEXT[] DEFAULT '{}', -- GSA Special Item Numbers
  scope_description TEXT,
  contracting_agency TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, pending, expired, under_renewal
  renewal_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org contract vehicles"
  ON contract_vehicles FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- ============================================================
-- 4. COLOR TEAM REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS color_team_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL, -- pink_team, red_team, gold_team, blue_team, black_hat
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  scheduled_date DATE,
  completed_date DATE,
  lead_reviewer TEXT,
  reviewers TEXT[] DEFAULT '{}',
  overall_rating TEXT, -- red, yellow, green
  findings JSONB DEFAULT '[]', -- [{section: string, finding: string, severity: string, recommendation: string, status: string}]
  action_items JSONB DEFAULT '[]', -- [{item: string, assignee: string, due_date: string, status: string}]
  summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE color_team_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org color team reviews"
  ON color_team_reviews FOR ALL
  TO authenticated
  USING (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
  WITH CHECK (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));

-- ============================================================
-- 5. LABOR CATEGORIES / KEY PERSONNEL DATABASE
-- ============================================================
CREATE TABLE IF NOT EXISTS labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL, -- e.g. 'Program Manager', 'Senior Systems Engineer', 'Help Desk Specialist'
  labor_category_code TEXT, -- e.g. SCA code or internal code
  description TEXT,
  min_years_experience INTEGER,
  education_requirement TEXT, -- bachelors, masters, phd, none, equivalent
  certifications TEXT[] DEFAULT '{}',
  clearance_required TEXT, -- none, public_trust, secret, top_secret, ts_sci
  hourly_rate_min NUMERIC,
  hourly_rate_max NUMERIC,
  annual_salary_min NUMERIC,
  annual_salary_max NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE labor_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org labor categories"
  ON labor_categories FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS key_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  labor_category_id UUID REFERENCES labor_categories(id),
  title TEXT,
  years_experience INTEGER,
  education TEXT,
  certifications TEXT[] DEFAULT '{}',
  clearance_level TEXT, -- none, public_trust, secret, top_secret, ts_sci
  clearance_expiry DATE,
  availability TEXT DEFAULT 'available', -- available, assigned, on_leave, departed
  resume_path TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE key_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org key personnel"
  ON key_personnel FOR ALL
  TO authenticated
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- Link key personnel to projects
CREATE TABLE IF NOT EXISTS project_key_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES key_personnel(id) ON DELETE CASCADE,
  proposed_role TEXT,
  labor_category_id UUID REFERENCES labor_categories(id),
  allocation_percent INTEGER DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, personnel_id)
);

ALTER TABLE project_key_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage project key personnel"
  ON project_key_personnel FOR ALL
  TO authenticated
  USING (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
  WITH CHECK (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));

-- ============================================================
-- 6. SMALL BUSINESS SUBCONTRACTING PLAN DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS sb_subcontracting_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  total_subcontracting_dollars NUMERIC,
  sb_goal_percent NUMERIC DEFAULT 23,
  sb_goal_dollars NUMERIC,
  sdb_goal_percent NUMERIC DEFAULT 5,
  sdb_goal_dollars NUMERIC,
  wosb_goal_percent NUMERIC DEFAULT 5,
  wosb_goal_dollars NUMERIC,
  hubzone_goal_percent NUMERIC DEFAULT 3,
  hubzone_goal_dollars NUMERIC,
  sdvosb_goal_percent NUMERIC DEFAULT 3,
  sdvosb_goal_dollars NUMERIC,
  planned_subcontractors JSONB DEFAULT '[]', -- [{sub_id, company_name, sb_type, planned_dollars, trade}]
  plan_narrative TEXT,
  good_faith_efforts TEXT,
  administrator_name TEXT,
  administrator_title TEXT,
  administrator_email TEXT,
  status TEXT DEFAULT 'draft', -- draft, reviewed, submitted, approved
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id)
);

ALTER TABLE sb_subcontracting_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org SB plans"
  ON sb_subcontracting_plans FOR ALL
  TO authenticated
  USING (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
  WITH CHECK (task_order_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));
