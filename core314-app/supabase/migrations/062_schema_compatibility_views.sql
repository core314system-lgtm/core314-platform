
CREATE OR REPLACE VIEW public.audit_log AS 
SELECT * FROM public.audit_logs;

CREATE OR REPLACE VIEW public.optimization_events AS 
SELECT * FROM public.fusion_optimization_events;

GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT ON public.optimization_events TO authenticated;

COMMENT ON VIEW public.audit_log IS 'Compatibility view for audit_logs table (legacy singular name)';
COMMENT ON VIEW public.optimization_events IS 'Compatibility view for fusion_optimization_events table (legacy short name)';
