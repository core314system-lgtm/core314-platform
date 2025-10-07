INSERT INTO public.ai_agents (name, agent_type, status, config) VALUES
    ('Orchestrator Agent', 'orchestrator', 'inactive', '{"priority": 1, "auto_start": false}'),
    ('Task Executor Agent', 'task_executor', 'inactive', '{"max_concurrent_tasks": 5}'),
    ('Monitor Agent', 'monitor', 'inactive', '{"check_interval_seconds": 60}'),
    ('Data Analyzer Agent', 'analyzer', 'inactive', '{"analysis_depth": "standard"}')
ON CONFLICT DO NOTHING;

INSERT INTO public.system_health (service_name, status, last_check_at) VALUES
    ('Supabase Database', 'healthy', NOW()),
    ('Frontend Application', 'healthy', NOW()),
    ('Integration Services', 'healthy', NOW()),
    ('AI Agents', 'healthy', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_metrics (metric_date) VALUES (CURRENT_DATE)
ON CONFLICT (metric_date) DO NOTHING;
