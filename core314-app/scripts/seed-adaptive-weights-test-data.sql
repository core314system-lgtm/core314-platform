-- ============================================================
-- ============================================================

DO $$
DECLARE
  test_user_id UUID := '037ef96f-a9d2-4ae5-a380-d2d3c790644f';
  slack_integration_id UUID;
  gmail_integration_id UUID;
  trello_integration_id UUID;
  metric_ids UUID[];
BEGIN
  SELECT id INTO slack_integration_id FROM integrations_master WHERE integration_name = 'Slack';
  SELECT id INTO gmail_integration_id FROM integrations_master WHERE integration_name = 'Gmail';
  SELECT id INTO trello_integration_id FROM integrations_master WHERE integration_name = 'Trello';

  INSERT INTO fusion_metrics (user_id, integration_id, metric_name, metric_type, raw_value, normalized_value, weight, synced_at)
  VALUES
    (test_user_id, slack_integration_id, 'message_count', 'count', 85, 0.85, 1.0, NOW()),
    (test_user_id, slack_integration_id, 'response_time', 'average', 72, 0.72, 1.0, NOW()),
    (test_user_id, slack_integration_id, 'active_users', 'count', 92, 0.92, 1.0, NOW()),
    (test_user_id, gmail_integration_id, 'email_volume', 'count', 78, 0.78, 1.0, NOW()),
    (test_user_id, gmail_integration_id, 'inbox_zero_rate', 'percentage', 65, 0.65, 1.0, NOW()),
    (test_user_id, gmail_integration_id, 'response_latency', 'average', 88, 0.88, 1.0, NOW()),
    (test_user_id, trello_integration_id, 'cards_completed', 'count', 70, 0.70, 1.0, NOW()),
    (test_user_id, trello_integration_id, 'board_activity', 'trend', 82, 0.82, 1.0, NOW()),
    (test_user_id, trello_integration_id, 'team_collaboration', 'percentage', 76, 0.76, 1.0, NOW()),
    (test_user_id, trello_integration_id, 'completion_velocity', 'trend', 90, 0.90, 1.0, NOW())
  ON CONFLICT (user_id, integration_id, metric_name) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, normalized_value = EXCLUDED.normalized_value;

  SELECT ARRAY_AGG(id) INTO metric_ids FROM fusion_metrics WHERE user_id = test_user_id;

  INSERT INTO fusion_weightings (user_id, integration_id, metric_id, weight, ai_confidence, adjustment_reason, adaptive)
  SELECT 
    test_user_id,
    fm.integration_id,
    fm.id,
    CASE 
      WHEN ROW_NUMBER() OVER () <= 3 THEN 0.35
      WHEN ROW_NUMBER() OVER () <= 6 THEN 0.25
      ELSE 0.15
    END as weight,
    CASE 
      WHEN ROW_NUMBER() OVER () <= 4 THEN 0.85 + (RANDOM() * 0.10)
      WHEN ROW_NUMBER() OVER () <= 7 THEN 0.70 + (RANDOM() * 0.15)
      ELSE 0.60 + (RANDOM() * 0.10)
    END as ai_confidence,
    'Test data initialization',
    true
  FROM fusion_metrics fm
  WHERE fm.user_id = test_user_id
  ON CONFLICT (user_id, integration_id, metric_id) DO UPDATE
  SET weight = EXCLUDED.weight, ai_confidence = EXCLUDED.ai_confidence;

END $$;

SELECT 
  'Fusion Metrics' as table_name, 
  COUNT(*) as count 
FROM fusion_metrics 
WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
UNION ALL
SELECT 
  'Fusion Weightings', 
  COUNT(*) 
FROM fusion_weightings 
WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f';
