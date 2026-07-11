-- ============================================================================
-- Fix cross-tenant RLS data leak on task_orders / documents / project data
--
-- Verified live against production (a brand-new authenticated user with NO
-- organization membership was able to read task_orders belonging to two other
-- organizations — 12 rows across 2 orgs — using nothing but their own JWT).
--
-- Two root causes:
--   1. task_orders and documents had blanket policies
--        USING (auth.uid() IS NOT NULL)
--      i.e. ANY logged-in user could read/write EVERY org's projects & docs.
--   2. Every "project child" and several org tables scoped themselves with a
--      broken correlated subquery:
--        org_id IN (SELECT <this_table>.org_id FROM user_profiles WHERE id = auth.uid())
--      The selected column resolves to the OUTER table's org_id (a correlated
--      reference), so the predicate is `org_id IN (org_id)` — always true for
--      any user who has a user_profiles row. It never scoped by the user's org.
--
-- Fix: scope every one of these tables to the caller's real organization
-- membership (get_user_org_ids) with a global-admin bypass (is_global_admin),
-- and — for project-owned tables — the project creator. Uses the existing
-- SECURITY DEFINER helpers so there is no RLS recursion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: can the current user access a given task order?
-- SECURITY DEFINER so the inner task_orders lookup bypasses task_orders RLS
-- (prevents recursion and double-filtering from child-table policies).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_task_order(p_task_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_global_admin()
     OR EXISTS (
       SELECT 1 FROM public.task_orders t
       WHERE t.id = p_task_order_id
         AND ( t.created_by = auth.uid()
            OR t.org_id IN (SELECT public.get_user_org_ids(auth.uid())) )
     );
$$;

-- ============================================================================
-- 1. task_orders — replace the blanket "any authenticated user" policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view task orders"   ON public.task_orders;
DROP POLICY IF EXISTS "Authenticated users can insert task orders" ON public.task_orders;
DROP POLICY IF EXISTS "Authenticated users can update task orders" ON public.task_orders;
DROP POLICY IF EXISTS "Authenticated users can delete task orders" ON public.task_orders;

CREATE POLICY "Users can view their org task orders" ON public.task_orders
  FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR created_by = auth.uid()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "Users can insert their org task orders" ON public.task_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_global_admin()
    OR (
      created_by = auth.uid()
      AND (org_id IS NULL OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
    )
  );

CREATE POLICY "Users can update their org task orders" ON public.task_orders
  FOR UPDATE TO authenticated
  USING (
    public.is_global_admin()
    OR created_by = auth.uid()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
  WITH CHECK (
    public.is_global_admin()
    OR created_by = auth.uid()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "Users can delete their org task orders" ON public.task_orders
  FOR DELETE TO authenticated
  USING (
    public.is_global_admin()
    OR created_by = auth.uid()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

-- ============================================================================
-- 2. documents — remove blanket policies; keep an org-scoped policy that also
--    honors global admin.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view documents"   ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.documents;
DROP POLICY IF EXISTS docs_org_access                            ON public.documents;

CREATE POLICY docs_org_access ON public.documents
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
  WITH CHECK (
    public.is_global_admin()
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

-- ============================================================================
-- 3. Project-child tables scoped by task_order_id (fix correlated-subquery bug
--    and the two completely-unscoped SELECT policies).
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage project key personnel"          ON public.project_key_personnel;
CREATE POLICY "Users can manage project key personnel" ON public.project_key_personnel
  TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can manage project past performance links" ON public.project_past_performance;
CREATE POLICY "Users can manage project past performance links" ON public.project_past_performance
  TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can manage their org SB plans"             ON public.sb_subcontracting_plans;
CREATE POLICY "Users can manage their org SB plans" ON public.sb_subcontracting_plans
  TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can manage their org capture gates"        ON public.capture_gates;
CREATE POLICY "Users can manage their org capture gates" ON public.capture_gates
  TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can manage their org color team reviews"   ON public.color_team_reviews;
CREATE POLICY "Users can manage their org color team reviews" ON public.color_team_reviews
  TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can view project assignments"              ON public.project_assignments;
CREATE POLICY "Users can view project assignments" ON public.project_assignments
  FOR SELECT TO authenticated
  USING (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Users can view workflow history for accessible projects" ON public.workflow_history;
CREATE POLICY "Users can view workflow history for accessible projects" ON public.workflow_history
  FOR SELECT TO authenticated
  USING (public.can_access_task_order(task_order_id));

-- ============================================================================
-- 4. Org tables scoped by org_id that used the broken correlated subquery.
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage their org cpars ratings"        ON public.cpars_ratings;
CREATE POLICY "Users can manage their org cpars ratings" ON public.cpars_ratings
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can manage their org gate templates"       ON public.gate_templates;
CREATE POLICY "Users can manage their org gate templates" ON public.gate_templates
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can manage their org key personnel"        ON public.key_personnel;
CREATE POLICY "Users can manage their org key personnel" ON public.key_personnel
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can manage their org labor categories"     ON public.labor_categories;
CREATE POLICY "Users can manage their org labor categories" ON public.labor_categories
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can manage their org past performance"     ON public.past_performance_citations;
CREATE POLICY "Users can manage their org past performance" ON public.past_performance_citations
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can manage their org contract vehicles"    ON public.contract_vehicles;
CREATE POLICY "Users can manage their org contract vehicles" ON public.contract_vehicles
  TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can view their org email domains"          ON public.org_email_domains;
CREATE POLICY "Users can view their org email domains" ON public.org_email_domains
  FOR SELECT TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage org email domains"             ON public.org_email_domains;
CREATE POLICY "Admins can manage org email domains" ON public.org_email_domains
  FOR ALL TO authenticated
  USING (
    public.is_global_admin()
    OR org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  )
  WITH CHECK (
    public.is_global_admin()
    OR org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  );
