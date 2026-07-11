-- Prevent orphaned projects: a task order created while multi-tenancy is
-- active must belong to an organization. A brand-new user with no org could
-- previously insert a task_orders row with org_id = NULL, producing a project
-- owned by nobody and invisible to org-scoped RLS.
--
-- Enforced with a BEFORE INSERT trigger (not a NOT NULL constraint) so that
-- pre-existing rows with a NULL org_id are left untouched; only new inserts
-- are validated.

CREATE OR REPLACE FUNCTION public.enforce_task_order_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'A project must belong to an organization (org_id cannot be null).'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_order_org ON public.task_orders;

CREATE TRIGGER trg_enforce_task_order_org
  BEFORE INSERT ON public.task_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_order_org();

GRANT ALL ON FUNCTION public.enforce_task_order_org() TO anon;
GRANT ALL ON FUNCTION public.enforce_task_order_org() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_task_order_org() TO service_role;
