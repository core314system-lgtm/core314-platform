-- ============================================================
-- ============================================================

BEGIN;

-- ============================================================
-- ============================================================

DROP POLICY IF EXISTS "Users can view own fusion feedback" ON public.fusion_feedback;
DROP POLICY IF EXISTS "Service role can manage fusion feedback" ON public.fusion_feedback;


DROP POLICY IF EXISTS fusion_feedback_select_policy ON public.fusion_feedback;
CREATE POLICY fusion_feedback_select_policy
  ON public.fusion_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fusion_feedback_insert_policy ON public.fusion_feedback;
CREATE POLICY fusion_feedback_insert_policy
  ON public.fusion_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fusion_feedback_update_policy ON public.fusion_feedback;
CREATE POLICY fusion_feedback_update_policy
  ON public.fusion_feedback
  FOR UPDATE
  TO public
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS fusion_feedback_delete_policy ON public.fusion_feedback;
CREATE POLICY fusion_feedback_delete_policy
  ON public.fusion_feedback
  FOR DELETE
  TO public
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================
-- ============================================================

ALTER TABLE public.system_integrity_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_integrity_reports_all_policy ON public.system_integrity_reports;
CREATE POLICY system_integrity_reports_all_policy
  ON public.system_integrity_reports
  FOR ALL
  TO public
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS system_integrity_reports_select_policy ON public.system_integrity_reports;
CREATE POLICY system_integrity_reports_select_policy
  ON public.system_integrity_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================================
-- ============================================================
