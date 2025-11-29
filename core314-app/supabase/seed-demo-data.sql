-- ============================================
-- ============================================


-- ============================================
-- ============================================


DO $$
DECLARE
  demo_user_ids UUID[] := ARRAY[
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid()
  ];
  base_timestamp TIMESTAMP := NOW() - INTERVAL '30 days';
  i INTEGER;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      email_verified,
      created_at,
      updated_at
    ) VALUES (
      demo_user_ids[i],
      'demo_user_' || i || '@example.com',
      'Demo User ' || i,
      'beta',
      CASE WHEN i <= 8 THEN TRUE ELSE FALSE END, -- 8 verified, 2 unverified
      base_timestamp + (i * INTERVAL '2 days') + (random() * INTERVAL '12 hours'),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  CREATE TEMP TABLE IF NOT EXISTS temp_demo_users (
    user_id UUID,
    user_number INTEGER
  );

  FOR i IN 1..10 LOOP
    INSERT INTO temp_demo_users (user_id, user_number)
    VALUES (demo_user_ids[i], i);
  END LOOP;

  RAISE NOTICE 'Created 10 demo users in profiles table';
END $$;

-- ============================================
-- ============================================

INSERT INTO beta_users (
  user_id,
  access_code,
  onboarding_started_at,
  onboarding_completed_at,
  onboarding_completed,
  beta_score,
  last_activity_at,
  created_at
)
SELECT
  tdu.user_id,
  'DEMOACCESS-' || tdu.user_number,
  p.created_at + INTERVAL '2 hours',
  CASE 
    WHEN tdu.user_number <= 7 THEN p.created_at + INTERVAL '1 day' + (random() * INTERVAL '6 hours')
    ELSE NULL -- 3 users haven't completed onboarding
  END,
  CASE WHEN tdu.user_number <= 7 THEN TRUE ELSE FALSE END,
  62 + (random() * 33)::INTEGER, -- Random score between 62-95
  NOW() - (random() * INTERVAL '7 days'),
  p.created_at
FROM temp_demo_users tdu
JOIN profiles p ON p.id = tdu.user_id
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- ============================================

INSERT INTO fusion_automation_events (
  user_id,
  event_type,
  event_name,
  metadata,
  created_at
)
SELECT
  tdu.user_id,
  'automation_created',
  'automation_created',
  jsonb_build_object(
    'automation_name', 'Demo Workflow ' || tdu.user_number,
    'automation_type', CASE (tdu.user_number % 3)
      WHEN 0 THEN 'scheduled'
      WHEN 1 THEN 'triggered'
      ELSE 'manual'
    END,
    'steps_count', 3 + (random() * 5)::INTEGER
  ),
  p.created_at + INTERVAL '3 days' + (random() * INTERVAL '10 days')
FROM temp_demo_users tdu
JOIN profiles p ON p.id = tdu.user_id
WHERE tdu.user_number <= 7 -- Only 7 users created automations
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================

INSERT INTO integration_events (
  user_id,
  event_type,
  event_name,
  provider,
  metadata,
  created_at
)
SELECT
  tdu.user_id,
  'integration_connected',
  'integration_connected',
  CASE (tdu.user_number % 6)
    WHEN 0 THEN 'slack'
    WHEN 1 THEN 'google'
    WHEN 2 THEN 'github'
    WHEN 3 THEN 'stripe'
    WHEN 4 THEN 'sendgrid'
    ELSE 'asana'
  END,
  jsonb_build_object(
    'integration_id', gen_random_uuid()::TEXT,
    'scopes', ARRAY['read', 'write']
  ),
  p.created_at + INTERVAL '5 days' + (random() * INTERVAL '8 days')
FROM temp_demo_users tdu
JOIN profiles p ON p.id = tdu.user_id
WHERE tdu.user_number <= 6 -- Only 6 users connected integrations
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================

INSERT INTO system_reliability_events (
  user_id,
  event_type,
  module,
  severity,
  message,
  latency_ms,
  extra,
  created_at
)
SELECT
  tdu.user_id,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'latency_spike'
    WHEN 1 THEN 'error'
    ELSE 'auth_failure'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'dashboard'
    WHEN 1 THEN 'automation_engine'
    ELSE 'signup'
  END,
  CASE (random() * 2)::INTEGER
    WHEN 0 THEN 'warning'
    ELSE 'error'
  END,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'High latency detected in API response'
    WHEN 1 THEN 'Failed to fetch user data'
    ELSE 'Authentication token expired'
  END,
  (500 + random() * 1900)::INTEGER, -- 500-2400ms
  jsonb_build_object(
    'endpoint', '/api/v1/data',
    'status_code', CASE (random() * 3)::INTEGER
      WHEN 0 THEN 500
      WHEN 1 THEN 503
      ELSE 401
    END,
    'retry_count', (random() * 3)::INTEGER
  ),
  NOW() - (random() * INTERVAL '14 days')
FROM temp_demo_users tdu
CROSS JOIN generate_series(1, 2) -- 2 events per user = 20 total
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================

INSERT INTO user_churn_scores (
  user_id,
  churn_score,
  risk_level,
  activity_score,
  engagement_score,
  feature_adoption_score,
  last_activity_days,
  created_at
)
SELECT
  tdu.user_id,
  CASE 
    WHEN tdu.user_number IN (1, 2) THEN 0.85 + (random() * 0.07) -- 2 high-risk users (0.85-0.92)
    WHEN tdu.user_number IN (3, 4, 5) THEN 0.50 + (random() * 0.30) -- 3 medium-risk (0.50-0.80)
    ELSE 0.10 + (random() * 0.35) -- 5 low-risk (0.10-0.45)
  END,
  CASE 
    WHEN tdu.user_number IN (1, 2) THEN 'high'
    WHEN tdu.user_number IN (3, 4, 5) THEN 'medium'
    ELSE 'low'
  END,
  (30 + random() * 70)::NUMERIC(5,2), -- Activity score 30-100
  (40 + random() * 60)::NUMERIC(5,2), -- Engagement score 40-100
  (20 + random() * 80)::NUMERIC(5,2), -- Feature adoption 20-100
  (random() * 14)::INTEGER, -- Last activity 0-14 days ago
  NOW() - (random() * INTERVAL '7 days')
FROM temp_demo_users tdu
ON CONFLICT (user_id) DO UPDATE SET
  churn_score = EXCLUDED.churn_score,
  risk_level = EXCLUDED.risk_level,
  activity_score = EXCLUDED.activity_score,
  engagement_score = EXCLUDED.engagement_score,
  feature_adoption_score = EXCLUDED.feature_adoption_score,
  last_activity_days = EXCLUDED.last_activity_days,
  created_at = EXCLUDED.created_at;

-- ============================================
-- ============================================

INSERT INTO user_quality_scores (
  user_id,
  onboarding_score,
  activity_score,
  feature_usage_score,
  total_score,
  last_calculated_at
)
SELECT
  tdu.user_id,
  CASE WHEN tdu.user_number <= 7 THEN 100 ELSE (random() * 50)::INTEGER END, -- Completed onboarding = 100
  (40 + random() * 60)::INTEGER, -- Activity score 40-100
  (30 + random() * 70)::INTEGER, -- Feature usage 30-100
  CASE 
    WHEN tdu.user_number <= 7 THEN (70 + random() * 30)::INTEGER -- Completed users: 70-100
    ELSE (30 + random() * 40)::INTEGER -- Incomplete users: 30-70
  END,
  NOW() - (random() * INTERVAL '2 days')
FROM temp_demo_users tdu
ON CONFLICT (user_id) DO UPDATE SET
  onboarding_score = EXCLUDED.onboarding_score,
  activity_score = EXCLUDED.activity_score,
  feature_usage_score = EXCLUDED.feature_usage_score,
  total_score = EXCLUDED.total_score,
  last_calculated_at = EXCLUDED.last_calculated_at;

-- ============================================
-- ============================================

INSERT INTO beta_events (
  user_id,
  event_type,
  event_name,
  metadata,
  created_at
)
SELECT
  tdu.user_id,
  CASE (random() * 5)::INTEGER
    WHEN 0 THEN 'page_view'
    WHEN 1 THEN 'feature_used'
    WHEN 2 THEN 'button_click'
    WHEN 3 THEN 'form_submit'
    ELSE 'navigation'
  END,
  CASE (random() * 5)::INTEGER
    WHEN 0 THEN 'dashboard_visit'
    WHEN 1 THEN 'automation_created'
    WHEN 2 THEN 'settings_updated'
    WHEN 3 THEN 'integration_connected'
    ELSE 'profile_viewed'
  END,
  jsonb_build_object(
    'page', CASE (random() * 4)::INTEGER
      WHEN 0 THEN '/dashboard'
      WHEN 1 THEN '/automations'
      WHEN 2 THEN '/integrations'
      ELSE '/settings'
    END,
    'duration_ms', (1000 + random() * 5000)::INTEGER
  ),
  NOW() - (random() * INTERVAL '30 days')
FROM temp_demo_users tdu
CROSS JOIN generate_series(1, 4) -- 4 events per user = 40 total
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================

INSERT INTO beta_feedback (
  user_id,
  category,
  message,
  resolved,
  created_at
)
SELECT
  tdu.user_id,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'Bug'
    WHEN 1 THEN 'Feature Request'
    WHEN 2 THEN 'UI/UX'
    ELSE 'Praise'
  END,
  CASE (random() * 4)::INTEGER
    WHEN 0 THEN 'The automation builder is very intuitive and easy to use!'
    WHEN 1 THEN 'Would love to see more integration options, especially for Notion.'
    WHEN 2 THEN 'Dashboard loads slowly sometimes, especially in the morning.'
    ELSE 'Great product! The AI recommendations are spot on.'
  END,
  CASE WHEN random() > 0.5 THEN TRUE ELSE FALSE END,
  NOW() - (random() * INTERVAL '20 days')
FROM temp_demo_users tdu
WHERE tdu.user_number <= 5 -- Only 5 users submitted feedback
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================

DO $$
DECLARE
  profiles_count INTEGER;
  beta_users_count INTEGER;
  automation_events_count INTEGER;
  integration_events_count INTEGER;
  reliability_events_count INTEGER;
  churn_scores_count INTEGER;
  quality_scores_count INTEGER;
  beta_events_count INTEGER;
  feedback_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_count FROM profiles WHERE email LIKE 'demo_user_%@example.com';
  SELECT COUNT(*) INTO beta_users_count FROM beta_users WHERE access_code LIKE 'DEMOACCESS-%';
  SELECT COUNT(*) INTO automation_events_count FROM fusion_automation_events WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO integration_events_count FROM integration_events WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO reliability_events_count FROM system_reliability_events WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO churn_scores_count FROM user_churn_scores WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO quality_scores_count FROM user_quality_scores WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO beta_events_count FROM beta_events WHERE user_id IN (SELECT user_id FROM temp_demo_users);
  SELECT COUNT(*) INTO feedback_count FROM beta_feedback WHERE user_id IN (SELECT user_id FROM temp_demo_users);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEMO DATA SEEDING SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Profiles created: %', profiles_count;
  RAISE NOTICE 'Beta users created: %', beta_users_count;
  RAISE NOTICE 'Automation events: %', automation_events_count;
  RAISE NOTICE 'Integration events: %', integration_events_count;
  RAISE NOTICE 'Reliability events: %', reliability_events_count;
  RAISE NOTICE 'Churn scores: %', churn_scores_count;
  RAISE NOTICE 'Quality scores: %', quality_scores_count;
  RAISE NOTICE 'Beta events: %', beta_events_count;
  RAISE NOTICE 'Feedback entries: %', feedback_count;
  RAISE NOTICE '========================================';
END $$;

SELECT 
  user_number,
  user_id,
  'demo_user_' || user_number || '@example.com' AS email
FROM temp_demo_users
ORDER BY user_number;

DROP TABLE IF EXISTS temp_demo_users;

-- ============================================
-- ============================================
