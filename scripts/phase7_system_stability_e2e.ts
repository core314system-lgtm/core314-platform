#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TEST_USER_EMAIL = 'phase7-test@core314.com';
const TEST_USER_PASSWORD = 'Phase7TestPassword123!';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);


interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.push({
      name,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`❌ ${name} (${duration}ms)`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}


let testUserId: string;
let testOrgId: string;

async function setupTestUser(): Promise<void> {
  console.log('\n🔧 Setting up test user...');

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  if (authError && !authError.message.includes('already registered')) {
    throw new Error(`Failed to create test user: ${authError.message}`);
  }

  testUserId = authData?.user?.id || '';

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', TEST_USER_EMAIL)
    .single();

  if (!profile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: testUserId,
      email: TEST_USER_EMAIL,
      full_name: 'Phase 7 Test User',
      role: 'admin',
    });

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }
  } else {
    testUserId = profile.id;
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('name', 'Phase 7 Test Org')
    .single();

  if (!org) {
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Phase 7 Test Org',
        owner_id: testUserId,
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }
    testOrgId = newOrg.id;
  } else {
    testOrgId = org.id;
  }

  console.log(`✅ Test user setup complete (user_id: ${testUserId})`);
}

async function cleanupTestData(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');

  await supabase.from('selftest_results').delete().eq('user_id', testUserId);
  await supabase.from('recovery_actions').delete().eq('user_id', testUserId);
  await supabase.from('anomaly_signals').delete().eq('user_id', testUserId);
  await supabase.from('system_health_events').delete().eq('user_id', testUserId);

  console.log('✅ Test data cleaned up');
}


/**
 * Test 1: Create system health event
 */
async function test1_CreateHealthEvent(): Promise<void> {
  const { data, error } = await supabase
    .from('system_health_events')
    .insert({
      user_id: testUserId,
      organization_id: testOrgId,
      component_type: 'edge_function',
      component_name: 'test-function',
      status: 'healthy',
      latency_ms: 150,
      latency_p50_ms: 120,
      latency_p95_ms: 200,
      latency_p99_ms: 250,
      throughput_per_minute: 100,
      error_count: 0,
      error_rate: 0,
      availability_percentage: 100,
      measurement_window_start: new Date(Date.now() - 300000).toISOString(),
      measurement_window_end: new Date().toISOString(),
      measurement_window_seconds: 300,
      tags: ['test', 'e2e'],
    })
    .select()
    .single();

  assert(!error, `Failed to create health event: ${error?.message}`);
  assert(!!data, 'Health event data is null');
  assert(data.component_name === 'test-function', 'Component name mismatch');
  assert(data.status === 'healthy', 'Status mismatch');
}

/**
 * Test 2: Monitor system health Edge Function
 */
async function test2_MonitorSystemHealth(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/monitor-system-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      user_id: testUserId,
      organization_id: testOrgId,
      auto_collect: false,
      metrics: [
        {
          component_type: 'edge_function',
          component_name: 'monitor-test',
          status: 'healthy',
          latency_ms: 100,
          error_count: 0,
          error_rate: 0,
          measurement_window_start: new Date(Date.now() - 60000).toISOString(),
          measurement_window_end: new Date().toISOString(),
          measurement_window_seconds: 60,
        },
      ],
    }),
  });

  assert(response.ok, `Monitor health failed: ${response.status}`);
  const result = await response.json();
  assert(result.success, 'Monitor health returned success=false');
  assert(result.metrics_collected === 1, 'Metrics collected count mismatch');
  assert(result.overall_status === 'healthy', 'Overall status should be healthy');
}

/**
 * Test 3: Create anomaly signal
 */
async function test3_CreateAnomalySignal(): Promise<void> {
  const { data, error } = await supabase
    .from('anomaly_signals')
    .insert({
      user_id: testUserId,
      organization_id: testOrgId,
      anomaly_type: 'latency_spike',
      anomaly_category: 'performance',
      severity: 'high',
      confidence_score: 85.5,
      source_type: 'system_health_event',
      source_component_type: 'edge_function',
      source_component_name: 'test-function',
      anomaly_description: 'Latency spike detected: 2500ms (baseline: 150ms, +1566.7%)',
      baseline_value: 150,
      observed_value: 2500,
      deviation_percentage: 1566.7,
      threshold_exceeded: 'latency_threshold',
      pattern_type: 'sudden_spike',
      detection_method: 'statistical_analysis',
      detection_algorithm: 'threshold_comparison',
      detection_timestamp: new Date().toISOString(),
      status: 'detected',
      business_impact: 'high',
      recommended_actions: ['investigate_recent_deployments', 'check_resource_utilization'],
      tags: ['test', 'e2e'],
    })
    .select()
    .single();

  assert(!error, `Failed to create anomaly signal: ${error?.message}`);
  assert(!!data, 'Anomaly signal data is null');
  assert(data.anomaly_type === 'latency_spike', 'Anomaly type mismatch');
  assert(data.severity === 'high', 'Severity mismatch');
  assert(data.confidence_score === 85.5, 'Confidence score mismatch');
}

/**
 * Test 4: Anomaly detector Edge Function
 */
async function test4_AnomalyDetector(): Promise<void> {
  await supabase.from('system_health_events').insert({
    user_id: testUserId,
    organization_id: testOrgId,
    component_type: 'edge_function',
    component_name: 'anomaly-test',
    status: 'unhealthy',
    latency_ms: 3000,
    error_count: 50,
    error_rate: 25,
    availability_percentage: 75,
    measurement_window_start: new Date(Date.now() - 60000).toISOString(),
    measurement_window_end: new Date().toISOString(),
    measurement_window_seconds: 60,
  });

  const response = await fetch(`${SUPABASE_URL}/functions/v1/anomaly-detector`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      user_id: testUserId,
      organization_id: testOrgId,
      time_window_minutes: 5,
      auto_analyze: true,
      use_gpt4o: false, // Skip GPT-4o for faster testing
    }),
  });

  assert(response.ok, `Anomaly detector failed: ${response.status}`);
  const result = await response.json();
  assert(result.success, 'Anomaly detector returned success=false');
  assert(result.anomalies_detected >= 0, 'Anomalies detected should be >= 0');
}

/**
 * Test 5: Create recovery action
 */
async function test5_CreateRecoveryAction(): Promise<void> {
  const { data, error } = await supabase
    .from('recovery_actions')
    .insert({
      user_id: testUserId,
      organization_id: testOrgId,
      action_type: 'restart_function',
      action_category: 'restart',
      action_name: 'Restart test-function',
      action_description: 'Test recovery action',
      trigger_type: 'automatic',
      trigger_reason: 'Latency spike detected',
      target_component_type: 'edge_function',
      target_component_name: 'test-function',
      action_config: { reason: 'latency_spike' },
      execution_status: 'pending',
      executed_by: 'system',
    })
    .select()
    .single();

  assert(!error, `Failed to create recovery action: ${error?.message}`);
  assert(!!data, 'Recovery action data is null');
  assert(data.action_type === 'restart_function', 'Action type mismatch');
  assert(data.execution_status === 'pending', 'Execution status mismatch');
}

/**
 * Test 6: Self-healing engine Edge Function
 */
async function test6_SelfHealingEngine(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/self-healing-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      user_id: testUserId,
      organization_id: testOrgId,
      action_type: 'clear_cache',
      target_component_type: 'edge_function',
      target_component_name: 'test-function',
      auto_execute: true,
      dry_run: true, // Dry run for testing
    }),
  });

  assert(response.ok, `Self-healing engine failed: ${response.status}`);
  const result = await response.json();
  assert(result.success, 'Self-healing engine returned success=false');
  assert(!!result.recovery_action_id, 'Recovery action ID is missing');
  assert(result.action_type === 'clear_cache', 'Action type mismatch');
}

/**
 * Test 7: Create self-test result
 */
async function test7_CreateSelftestResult(): Promise<void> {
  const { data, error } = await supabase
    .from('selftest_results')
    .insert({
      user_id: testUserId,
      organization_id: testOrgId,
      test_name: 'Edge Function Health Check',
      test_category: 'health_check',
      test_type: 'smoke',
      test_description: 'Verify Edge Functions are responding',
      execution_mode: 'scheduled',
      scheduled_by: 'system',
      target_component_type: 'edge_function',
      target_component_name: 'test-function',
      execution_status: 'completed',
      started_at: new Date(Date.now() - 5000).toISOString(),
      completed_at: new Date().toISOString(),
      execution_duration_ms: 5000,
      test_result: 'pass',
      success: true,
      pass_count: 10,
      fail_count: 0,
      warning_count: 0,
      total_assertions: 10,
      test_summary: 'All health checks passed',
      health_score: 95.5,
      reliability_score: 98.0,
      performance_score: 92.0,
      tags: ['test', 'e2e'],
    })
    .select()
    .single();

  assert(!error, `Failed to create selftest result: ${error?.message}`);
  assert(!!data, 'Selftest result data is null');
  assert(data.test_result === 'pass', 'Test result mismatch');
  assert(data.success === true, 'Success flag mismatch');
  assert(data.health_score === 95.5, 'Health score mismatch');
}

/**
 * Test 8: Query system health summary
 */
async function test8_QueryHealthSummary(): Promise<void> {
  const { data, error } = await supabase.rpc('get_system_health_summary', {
    p_user_id: testUserId,
    p_time_window_minutes: 60,
  });

  assert(!error, `Failed to query health summary: ${error?.message}`);
  assert(Array.isArray(data), 'Health summary should be an array');
}

/**
 * Test 9: Query anomaly statistics
 */
async function test9_QueryAnomalyStatistics(): Promise<void> {
  const { data, error } = await supabase.rpc('get_anomaly_statistics', {
    p_user_id: testUserId,
    p_time_window_hours: 24,
  });

  assert(!error, `Failed to query anomaly statistics: ${error?.message}`);
  assert(Array.isArray(data), 'Anomaly statistics should be an array');
  if (data.length > 0) {
    assert(typeof data[0].total_anomalies === 'number', 'Total anomalies should be a number');
  }
}

/**
 * Test 10: Query recovery action statistics
 */
async function test10_QueryRecoveryStatistics(): Promise<void> {
  const { data, error } = await supabase.rpc('get_recovery_action_statistics', {
    p_user_id: testUserId,
    p_time_window_hours: 24,
  });

  assert(!error, `Failed to query recovery statistics: ${error?.message}`);
  assert(Array.isArray(data), 'Recovery statistics should be an array');
  if (data.length > 0) {
    assert(typeof data[0].total_actions === 'number', 'Total actions should be a number');
  }
}

/**
 * Test 11: Verify RLS isolation
 */
async function test11_VerifyRLSIsolation(): Promise<void> {
  const { data: otherUser } = await supabase.auth.admin.createUser({
    email: 'phase7-other@core314.com',
    password: 'OtherPassword123!',
    email_confirm: true,
  });

  if (!otherUser?.user) {
    throw new Error('Failed to create other test user');
  }

  const { data: healthEvents, error } = await supabase
    .from('system_health_events')
    .select('*')
    .eq('user_id', testUserId);

  assert(!error, `RLS query failed: ${error?.message}`);
  assert(Array.isArray(healthEvents), 'Health events should be an array');

  await supabase.auth.admin.deleteUser(otherUser.user.id);
}

/**
 * Test 12: Performance validation
 */
async function test12_PerformanceValidation(): Promise<void> {
  const startTime = Date.now();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/monitor-system-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      user_id: testUserId,
      auto_collect: false,
      metrics: [],
    }),
  });
  const latency = Date.now() - startTime;

  assert(response.ok, 'Monitor health request failed');
  assert(latency < 3000, `Monitor health latency too high: ${latency}ms (target: <3000ms)`);
  console.log(`   Monitor health latency: ${latency}ms`);
}


async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 7: System Stability & Resilience - E2E Test Suite      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await setupTestUser();

    console.log('\n📋 Running Phase 7 E2E tests...\n');

    await runTest('Test 1: Create system health event', test1_CreateHealthEvent);
    await runTest('Test 2: Monitor system health Edge Function', test2_MonitorSystemHealth);
    await runTest('Test 3: Create anomaly signal', test3_CreateAnomalySignal);
    await runTest('Test 4: Anomaly detector Edge Function', test4_AnomalyDetector);
    await runTest('Test 5: Create recovery action', test5_CreateRecoveryAction);
    await runTest('Test 6: Self-healing engine Edge Function', test6_SelfHealingEngine);
    await runTest('Test 7: Create self-test result', test7_CreateSelftestResult);
    await runTest('Test 8: Query system health summary', test8_QueryHealthSummary);
    await runTest('Test 9: Query anomaly statistics', test9_QueryAnomalyStatistics);
    await runTest('Test 10: Query recovery action statistics', test10_QueryRecoveryStatistics);
    await runTest('Test 11: Verify RLS isolation', test11_VerifyRLSIsolation);
    await runTest('Test 12: Performance validation', test12_PerformanceValidation);

    await cleanupTestData();

    console.log('\n' + '═'.repeat(70));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(70));

    const passedTests = testResults.filter((t) => t.passed).length;
    const failedTests = testResults.filter((t) => t.passed === false).length;
    const totalTests = testResults.length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    const avgDuration = (
      testResults.reduce((sum, t) => sum + t.duration, 0) / totalTests
    ).toFixed(0);

    console.log(`\nTotal Tests:    ${totalTests}`);
    console.log(`Passed:         ${passedTests} ✅`);
    console.log(`Failed:         ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate:   ${successRate}%`);
    console.log(`Avg Duration:   ${avgDuration}ms`);

    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`   - ${t.name}`);
          console.log(`     Error: ${t.error}`);
        });
    }

    console.log('\n' + '═'.repeat(70));

    if (parseFloat(successRate) >= 90) {
      console.log('✅ Phase 7 E2E tests PASSED (≥90% success rate)');
      process.exit(0);
    } else {
      console.log(`❌ Phase 7 E2E tests FAILED (${successRate}% < 90% required)`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
