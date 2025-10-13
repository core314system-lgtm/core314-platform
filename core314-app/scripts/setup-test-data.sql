

UPDATE profiles
SET role = 'admin', full_name = 'Admin User'
WHERE id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f';

INSERT INTO user_integrations (user_id, integration_id, status, config)
SELECT 
  '037ef96f-a9d2-4ae5-a380-d2d3c790644f',
  id,
  'active',
  '{}'::jsonb
FROM integrations_master
WHERE is_core_integration = true
LIMIT 3
ON CONFLICT (user_id, integration_id) DO NOTHING;

INSERT INTO fusion_scores (
  user_id, integration_id, fusion_score, score_breakdown, trend_direction,
  ai_summary, ai_cached_at, calculated_at,
  weight_factor, baseline_score, learning_rate, last_adjusted, adaptive_notes
)
SELECT 
  '037ef96f-a9d2-4ae5-a380-d2d3c790644f',
  ui.integration_id,
  CASE 
    WHEN row_number() OVER () = 1 THEN 75
    WHEN row_number() OVER () = 2 THEN 82
    ELSE 68
  END as fusion_score,
  jsonb_build_object('activity', 70, 'quality', 80, 'velocity', 75),
  CASE 
    WHEN row_number() OVER () <= 2 THEN 'up'
    ELSE 'down'
  END as trend_direction,
  'Integration is performing well with good activity levels.',
  NOW(),
  NOW(),
  1.0,
  50,
  0.05,
  NOW(),
  'Initial test data'
FROM user_integrations ui
WHERE ui.user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
ON CONFLICT (user_id, integration_id) 
DO UPDATE SET
  fusion_score = EXCLUDED.fusion_score,
  score_breakdown = EXCLUDED.score_breakdown,
  trend_direction = EXCLUDED.trend_direction,
  weight_factor = EXCLUDED.weight_factor,
  baseline_score = EXCLUDED.baseline_score,
  learning_rate = EXCLUDED.learning_rate,
  last_adjusted = NOW(),
  adaptive_notes = EXCLUDED.adaptive_notes;

INSERT INTO fusion_score_history (
  user_id, integration_id, fusion_score, weight_factor, baseline_score, 
  learning_rate, recorded_at, change_reason
)
SELECT 
  '037ef96f-a9d2-4ae5-a380-d2d3c790644f',
  ui.integration_id,
  50 + (random() * 40)::numeric,
  1.0,
  50,
  0.05,
  NOW() - (i || ' days')::interval,
  'Historical test data'
FROM user_integrations ui, generate_series(0, 9) AS i
WHERE ui.user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f';

INSERT INTO fusion_metrics (
  user_id, integration_id, metric_name, raw_value, normalized_value, synced_at
)
SELECT 
  '037ef96f-a9d2-4ae5-a380-d2d3c790644f',
  ui.integration_id,
  metric_name,
  70 + (random() * 20)::numeric,
  0.7 + (random() * 0.2)::numeric,
  NOW()
FROM user_integrations ui, (VALUES ('activity_score'), ('quality_score')) AS metrics(metric_name)
WHERE ui.user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
ON CONFLICT DO NOTHING;

SELECT 'User Profile' as table_name, COUNT(*) as count FROM profiles WHERE id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
UNION ALL
SELECT 'User Integrations', COUNT(*) FROM user_integrations WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
UNION ALL
SELECT 'Fusion Scores', COUNT(*) FROM fusion_scores WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
UNION ALL
SELECT 'Fusion Score History', COUNT(*) FROM fusion_score_history WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f'
UNION ALL
SELECT 'Fusion Metrics', COUNT(*) FROM fusion_metrics WHERE user_id = '037ef96f-a9d2-4ae5-a380-d2d3c790644f';
