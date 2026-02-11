-- ============================================================
-- Slack Signal Mappings
-- Defines how Slack events map to canonical signals
-- Part of Integration Architecture v2.0
-- ============================================================

-- Slack signal mappings for event-driven ingestion
INSERT INTO public.integration_signal_mappings 
  (integration_type, source_event_type, source_field_path, target_signal_group, target_signal_name, transformation, default_value, is_enabled)
VALUES
  -- Message events -> activity_volume
  ('slack', 'message', 'metadata.text', 'activity_volume', 'messages', 'increment', 1, true),
  ('slack', 'message.channels', 'metadata.text', 'activity_volume', 'messages', 'increment', 1, true),
  ('slack', 'message.groups', 'metadata.text', 'activity_volume', 'messages', 'increment', 1, true),
  
  -- Reaction events -> user_engagement
  ('slack', 'reaction_added', 'metadata.reaction', 'user_engagement', 'reactions', 'increment', 1, true),
  ('slack', 'reaction_removed', 'metadata.reaction', 'user_engagement', 'reactions_removed', 'increment', 1, true),
  
  -- Channel events -> activity_volume
  ('slack', 'channel_created', 'metadata.channel.id', 'activity_volume', 'channels_created', 'increment', 1, true),
  ('slack', 'member_joined_channel', 'metadata.user', 'user_engagement', 'channel_joins', 'increment', 1, true),
  ('slack', 'member_left_channel', 'metadata.user', 'user_engagement', 'channel_leaves', 'increment', 1, true),
  
  -- File events -> activity_volume
  ('slack', 'file_shared', 'metadata.file_id', 'activity_volume', 'files_shared', 'increment', 1, true),
  
  -- App mention -> user_engagement
  ('slack', 'app_mention', 'metadata.text', 'user_engagement', 'mentions', 'increment', 1, true),
  
  -- Workspace activity (from poll/backfill) -> activity_volume
  ('slack', 'slack.workspace_activity', 'message_count', 'activity_volume', 'total_messages', 'direct', 0, true),
  ('slack', 'slack.workspace_activity', 'active_channels', 'activity_volume', 'active_channels', 'direct', 0, true),
  ('slack', 'slack.workspace_activity', 'total_channels', 'activity_volume', 'total_channels', 'direct', 0, true)
ON CONFLICT (integration_type, source_event_type, target_signal_name) DO UPDATE SET
  source_field_path = EXCLUDED.source_field_path,
  target_signal_group = EXCLUDED.target_signal_group,
  transformation = EXCLUDED.transformation,
  default_value = EXCLUDED.default_value,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- Update Slack metric definitions to include event-driven sources
-- These definitions tell the dashboard which metrics to display
INSERT INTO public.integration_metric_definitions 
  (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type)
VALUES
  -- Real-time event-driven metrics
  ('slack', 'messages_today', 'Messages Today', 'Messages sent today (real-time)', 'messages', 'count', 'message', NULL, true, 0, 'stat'),
  ('slack', 'reactions_today', 'Reactions Today', 'Reactions added today (real-time)', 'reactions', 'count', 'reaction_added', NULL, false, 7, 'stat')
ON CONFLICT (integration_type, metric_name) DO UPDATE SET
  metric_label = EXCLUDED.metric_label,
  description = EXCLUDED.description,
  source_event_type = EXCLUDED.source_event_type,
  is_primary = EXCLUDED.is_primary,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Comments
COMMENT ON TABLE public.integration_signal_mappings IS 'Maps raw integration events to canonical signal groups for the Unified Integration Contract';
