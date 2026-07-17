-- ============================================================================
-- Fix cross-tenant RLS leaks on SOW, subcontractor, questions and org tables
--
-- Verified live against production with two controlled orgs (A and B). Signed
-- in as org B (its own JWT), org B could READ / UPDATE / DELETE org A's rows on
-- every table below — a critical multi-tenant isolation failure. Root causes,
-- all the same families already fixed for task_orders/documents in
-- 20260719_fix_task_orders_cross_tenant_rls.sql, but these tables were missed:
--
--   1. Blanket `USING (true)` / `WITH CHECK (true)` policies for the
--      `authenticated` role  (sow_items, sow_subcontractors, sow_quotes,
--      sow_communications, project_subcontractors, ai_audit_log SELECT).
--   2. Blanket `auth.uid() IS NOT NULL` policies for `public`/`authenticated`
--      (subcontractors, question_submissions, question_answer_history,
--      subcontractor_questions, opportunity_questions, contracts writes,
--      project_assignments writes).
--   3. The broken correlated-subquery pattern
--        org_id IN (SELECT <this_table>.org_id FROM user_profiles WHERE id = auth.uid())
--      which resolves to `org_id IN (org_id)` and is therefore always true
--      (contacts, organization_settings, project_comments, project_tasks).
--   4. A world-readable public `USING (true)` SELECT policy on sub_connections.
--
-- Fix: scope every table to the caller's real organization / task order using
-- the existing SECURITY DEFINER helpers (is_global_admin, get_user_org_ids,
-- can_access_task_order) plus two new SECURITY DEFINER helpers for SOW-child
-- tables (can_access_sow_item, can_access_sow_subcontractor). Server-side
-- Netlify functions use the service role and BYPASS RLS, so the public
-- subcontractor portal (which posts through /api/portal-api) is unaffected.
--
-- Data backfill: 36 legacy `subcontractors` rows had a NULL org_id but are
-- referenced by exactly one org's sow/project rows; their org_id is backfilled
-- so those orgs keep visibility. The remaining orphan rows (referenced by no
-- org) stay NULL and become admin-only, which is correct.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers for SOW-child tables (bypass child-table RLS to
-- avoid recursion / double-filtering).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_sow_item(p_sow_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_global_admin()
     OR EXISTS (
       SELECT 1 FROM public.sow_items si
       WHERE si.id = p_sow_item_id
         AND public.can_access_task_order(si.task_order_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.can_access_sow_subcontractor(p_sow_subcontractor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_global_admin()
     OR EXISTS (
       SELECT 1 FROM public.sow_subcontractors ss
       WHERE ss.id = p_sow_subcontractor_id
         AND public.can_access_sow_item(ss.sow_item_id)
     );
$$;

-- ============================================================================
-- 1. contacts — fix correlated-subquery bug (org_id scope)
-- ============================================================================
DROP POLICY IF EXISTS contacts_org_policy ON public.contacts;
CREATE POLICY contacts_org_policy ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ============================================================================
-- 2. subcontractors — backfill legacy NULL org_id, then org-scope
-- ============================================================================
WITH refs AS (
  SELECT ss.subcontractor_id AS sid, ss.org_id AS oid
    FROM public.sow_subcontractors ss WHERE ss.org_id IS NOT NULL
  UNION
  SELECT ps.subcontractor_id, t.org_id
    FROM public.project_subcontractors ps
    JOIN public.task_orders t ON t.id = ps.task_order_id
   WHERE t.org_id IS NOT NULL
),
single AS (
  SELECT sid, (array_agg(DISTINCT oid))[1] AS oid
    FROM refs
   GROUP BY sid
  HAVING COUNT(DISTINCT oid) = 1
)
UPDATE public.subcontractors s
   SET org_id = single.oid
  FROM single
 WHERE s.id = single.sid
   AND s.org_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can view subcontractors"   ON public.subcontractors;
DROP POLICY IF EXISTS "Authenticated users can insert subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Authenticated users can update subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Authenticated users can delete subcontractors" ON public.subcontractors;

CREATE POLICY "Users can view their org subcontractors" ON public.subcontractors
  FOR SELECT TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can insert their org subcontractors" ON public.subcontractors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can update their org subcontractors" ON public.subcontractors
  FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Users can delete their org subcontractors" ON public.subcontractors
  FOR DELETE TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ============================================================================
-- 3. SOW tables — scope through the owning task order
-- ============================================================================
DROP POLICY IF EXISTS sow_items_all ON public.sow_items;
CREATE POLICY sow_items_org_access ON public.sow_items
  FOR ALL TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS sow_subcontractors_all ON public.sow_subcontractors;
DROP POLICY IF EXISTS sow_subs_org_access    ON public.sow_subcontractors;
CREATE POLICY sow_subcontractors_org_access ON public.sow_subcontractors
  FOR ALL TO authenticated
  USING (public.can_access_sow_item(sow_item_id))
  WITH CHECK (public.can_access_sow_item(sow_item_id));

DROP POLICY IF EXISTS sow_quotes_all ON public.sow_quotes;
CREATE POLICY sow_quotes_org_access ON public.sow_quotes
  FOR ALL TO authenticated
  USING (public.can_access_sow_item(sow_item_id))
  WITH CHECK (public.can_access_sow_item(sow_item_id));

DROP POLICY IF EXISTS sow_communications_all ON public.sow_communications;
CREATE POLICY sow_communications_org_access ON public.sow_communications
  FOR ALL TO authenticated
  USING (public.can_access_sow_subcontractor(sow_subcontractor_id))
  WITH CHECK (public.can_access_sow_subcontractor(sow_subcontractor_id));

-- ============================================================================
-- 4. project_subcontractors — scope through the owning task order
-- ============================================================================
DROP POLICY IF EXISTS project_subs_select     ON public.project_subcontractors;
DROP POLICY IF EXISTS project_subs_insert     ON public.project_subcontractors;
DROP POLICY IF EXISTS project_subs_update     ON public.project_subcontractors;
DROP POLICY IF EXISTS project_subs_delete     ON public.project_subcontractors;
DROP POLICY IF EXISTS project_subs_org_access ON public.project_subcontractors;
CREATE POLICY project_subs_org_access ON public.project_subcontractors
  FOR ALL TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

-- ============================================================================
-- 5. ai_audit_log — scope reads to caller's org / own rows; scope inserts
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can read audit log"   ON public.ai_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.ai_audit_log;

CREATE POLICY "Users can read their org audit log" ON public.ai_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_global_admin()
    OR user_id = auth.uid()::text
    OR (org_id IS NOT NULL AND org_id IN (SELECT public.get_user_org_ids(auth.uid())::text))
  );

CREATE POLICY "Users can insert their own audit log" ON public.ai_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_global_admin()
    OR user_id = auth.uid()::text
  );

-- ============================================================================
-- 6. Org tables with the broken correlated subquery (org_id scope)
-- ============================================================================
DROP POLICY IF EXISTS org_settings_policy ON public.organization_settings;
CREATE POLICY org_settings_policy ON public.organization_settings
  FOR ALL TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS project_comments_org_policy ON public.project_comments;
CREATE POLICY project_comments_org_policy ON public.project_comments
  FOR ALL TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS project_tasks_org_policy ON public.project_tasks;
CREATE POLICY project_tasks_org_policy ON public.project_tasks
  FOR ALL TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ============================================================================
-- 7. Question tables — scope through the owning task order
-- ============================================================================
DROP POLICY IF EXISTS "Auth users can manage question submissions" ON public.question_submissions;
CREATE POLICY "Users can manage their org question submissions" ON public.question_submissions
  FOR ALL TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));

DROP POLICY IF EXISTS "Auth users can manage question history" ON public.question_answer_history;
CREATE POLICY "Users can manage their org question history" ON public.question_answer_history
  FOR ALL TO authenticated
  USING (public.is_global_admin() OR (task_order_id IS NOT NULL AND public.can_access_task_order(task_order_id)))
  WITH CHECK (public.is_global_admin() OR (task_order_id IS NOT NULL AND public.can_access_task_order(task_order_id)));

-- subcontractor_questions: keep public/portal INSERT and shared-question reads;
-- replace the blanket "manage" (any-authenticated) policy with scoped access.
DROP POLICY IF EXISTS "Auth users can manage questions" ON public.subcontractor_questions;
CREATE POLICY "Users can read their org subcontractor questions" ON public.subcontractor_questions
  FOR SELECT TO authenticated
  USING (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can update their org subcontractor questions" ON public.subcontractor_questions
  FOR UPDATE TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can delete their org subcontractor questions" ON public.subcontractor_questions
  FOR DELETE TO authenticated
  USING (public.can_access_task_order(task_order_id));

-- opportunity_questions: keep portal INSERT; drop world-readable SELECT and the
-- blanket "manage" policy; add scoped access.
DROP POLICY IF EXISTS "Auth users can manage opportunity questions" ON public.opportunity_questions;
DROP POLICY IF EXISTS "Portal users can read own questions"          ON public.opportunity_questions;
CREATE POLICY "Users can read their org opportunity questions" ON public.opportunity_questions
  FOR SELECT TO authenticated
  USING (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can update their org opportunity questions" ON public.opportunity_questions
  FOR UPDATE TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can delete their org opportunity questions" ON public.opportunity_questions
  FOR DELETE TO authenticated
  USING (public.can_access_task_order(task_order_id));

-- ============================================================================
-- 8. contracts — SELECT already org-scoped; scope the write policies too
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can delete contracts" ON public.contracts;

CREATE POLICY "Users can create their org contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Users can update their org contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())))
  WITH CHECK (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Users can delete their org contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (public.is_global_admin() OR org_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ============================================================================
-- 9. project_assignments — SELECT already scoped; scope the write policies too
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can manage project assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Authenticated users can update project assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete project assignments" ON public.project_assignments;

CREATE POLICY "Users can insert their org project assignments" ON public.project_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can update their org project assignments" ON public.project_assignments
  FOR UPDATE TO authenticated
  USING (public.can_access_task_order(task_order_id))
  WITH CHECK (public.can_access_task_order(task_order_id));
CREATE POLICY "Users can delete their org project assignments" ON public.project_assignments
  FOR DELETE TO authenticated
  USING (public.can_access_task_order(task_order_id));

-- ============================================================================
-- 10. sub_connections — remove the world-readable public SELECT policy
--     (the org-scoped "Users can read their org connections" policy remains)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their org connections" ON public.sub_connections;
