-- ============================================================
-- Salesforce Extended Metrics
-- Adds Contact, Task, and Event metrics to Salesforce dashboard
-- ============================================================

-- Add new Salesforce metric definitions for Contacts, Tasks, and Events
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('salesforce', 'contact_count', 'Total Contacts', 'Number of contacts in Salesforce', 'contacts', 'latest', 'salesforce.crm_activity', 'contact_count', true, 2, 'stat'),
('salesforce', 'task_count', 'Total Tasks', 'Number of tasks in Salesforce', 'tasks', 'latest', 'salesforce.crm_activity', 'task_count', false, 13, 'stat'),
('salesforce', 'open_tasks', 'Open Tasks', 'Number of open/incomplete tasks', 'tasks', 'latest', 'salesforce.crm_activity', 'open_tasks', false, 14, 'stat'),
('salesforce', 'event_count', 'Total Events', 'Number of calendar events in Salesforce', 'events', 'latest', 'salesforce.crm_activity', 'event_count', false, 15, 'stat'),
('salesforce', 'other_accounts', 'Other Accounts', 'Accounts that are not Customer or Prospect type', 'accounts', 'latest', 'salesforce.crm_activity', 'other_accounts', false, 4, 'stat'),
('salesforce', 'open_opportunity_value', 'Open Pipeline Value', 'Total value of open opportunities', 'USD', 'latest', 'salesforce.crm_activity', 'open_opportunity_value', true, 9, 'stat')
ON CONFLICT (integration_type, metric_name) DO UPDATE SET
  metric_label = EXCLUDED.metric_label,
  description = EXCLUDED.description,
  source_field_path = EXCLUDED.source_field_path,
  is_primary = EXCLUDED.is_primary,
  display_order = EXCLUDED.display_order;

-- Update existing pipeline_value to use open_opportunity_value (more accurate)
UPDATE public.integration_metric_definitions 
SET source_field_path = 'open_opportunity_value',
    description = 'Total value of open opportunities in pipeline'
WHERE integration_type = 'salesforce' 
AND metric_name = 'opportunity_value';
