import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedTestData() {
  const testEmail = 'core314system@gmail.com';

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', testEmail)
    .single();

  if (!profile) {
    console.error('User not found');
    return;
  }

  const userId = profile.id;
  console.log(`Seeding test data for user: ${userId}`);

  const { data: integrations } = await supabase
    .from('integrations_master')
    .select('*')
    .in('integration_name', ['Slack', 'Microsoft Teams', 'Gmail']);

  if (!integrations || integrations.length === 0) {
    console.error('Test integrations not found in integrations_master');
    return;
  }

  console.log(`Found ${integrations.length} integrations to seed`);

  for (const integration of integrations) {
    console.log(`Processing ${integration.integration_name}...`);

    const { data: userInt } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        integration_id: integration.id,
        added_by_user: false,
        status: 'active',
      }, {
        onConflict: 'user_id,integration_id'
      })
      .select()
      .single();

    if (!userInt) continue;

    const metrics = getSampleMetrics(integration.integration_name);
    
    for (const metric of metrics) {
      await supabase
        .from('fusion_metrics')
        .upsert({
          user_id: userId,
          integration_id: integration.id,
          metric_name: metric.name,
          metric_type: metric.type,
          raw_value: metric.value,
          normalized_value: metric.normalized,
          weight: metric.weight,
          data_source: { seed: true },
        }, {
          onConflict: 'user_id,integration_id,metric_name'
        });
    }

    const fusionScore = metrics.reduce((sum, m) => sum + m.normalized * m.weight, 0) / 
                       metrics.reduce((sum, m) => sum + m.weight, 0) * 100;

    await supabase
      .from('fusion_scores')
      .upsert({
        user_id: userId,
        integration_id: integration.id,
        fusion_score: fusionScore,
        score_breakdown: metrics.reduce((obj, m) => ({ ...obj, [m.name]: m.normalized * m.weight }), {}),
        trend_direction: Math.random() > 0.5 ? 'up' : 'down',
        ai_summary: `${integration.integration_name} is performing ${fusionScore > 70 ? 'excellently' : fusionScore > 50 ? 'well' : 'below expectations'}.`,
        ai_cached_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,integration_id'
      });

    console.log(`✓ Seeded ${integration.integration_name} with ${metrics.length} metrics (score: ${fusionScore.toFixed(1)})`);
  }

  console.log('\n✅ Test data seeding complete!');
}

function getSampleMetrics(integrationName) {
  const baseMetrics = {
    'Slack': [
      { name: 'Messages Sent', type: 'count', value: 1250, normalized: 0.85, weight: 0.2 },
      { name: 'Active Users', type: 'count', value: 45, normalized: 0.75, weight: 0.3 },
      { name: 'Response Time', type: 'average', value: 12.5, normalized: 0.9, weight: 0.25 },
    ],
    'Microsoft Teams': [
      { name: 'Team Meetings', type: 'count', value: 32, normalized: 0.7, weight: 0.2 },
      { name: 'Meeting Duration', type: 'average', value: 45, normalized: 0.65, weight: 0.25 },
      { name: 'Collaboration Score', type: 'percentage', value: 78, normalized: 0.78, weight: 0.3 },
    ],
    'Gmail': [
      { name: 'Emails Sent', type: 'count', value: 450, normalized: 0.72, weight: 0.2 },
      { name: 'Response Rate', type: 'percentage', value: 85, normalized: 0.85, weight: 0.3 },
      { name: 'Inbox Zero Days', type: 'count', value: 12, normalized: 0.6, weight: 0.25 },
    ],
  };

  return baseMetrics[integrationName] || [];
}

seedTestData().catch(console.error);
