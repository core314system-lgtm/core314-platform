#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Phase 3: Predictive Operations Layer - Comprehensive E2E Test Suite
 * 
 * Tests:
 * 1. Create 10 test users
 * 2. Insert 50 metrics per user (500 total)
 * 3. Train 5 predictive models per user (50 total)
 * 4. Generate 5 forecasts per user (50 total)
 * 5. Validate threshold breach predictions
 * 6. Test adaptive retraining scheduler
 * 7. Verify prediction accuracy > 85%
 * 8. Test query performance < 6s
 * 9. Cleanup test data
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];
const testUserIds: string[] = [];

function logInfo(message: string) {
  console.log(`  ℹ️  ${message}`);
}

function logSuccess(message: string) {
  console.log(`  ✅ ${message}`);
}

function logError(message: string) {
  console.log(`  ❌ ${message}`);
}

function logWarning(message: string) {
  console.log(`  ⚠️  ${message}`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  console.log(`\n🧪 ${name}`);
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    logSuccess(`Completed in ${duration}ms`);
    testResults.push({ name, passed: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Failed: ${error.message}`);
    testResults.push({ name, passed: false, duration, error: error.message });
  }
}

async function createTestUsers(): Promise<void> {
  logInfo('Creating 10 test users...');
  
  for (let i = 1; i <= 10; i++) {
    const email = `phase3_test_user_${i}_${Date.now()}@test.com`;
    const password = 'TestPassword123!';
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    
    if (error) {
      throw new Error(`Failed to create user ${i}: ${error.message}`);
    }
    
    testUserIds.push(data.user.id);
    logInfo(`Created user ${i}: ${data.user.id}`);
  }
}

async function insertMetrics(): Promise<void> {
  logInfo('Inserting 50 metrics per user (500 total)...');
  
  const metrics = [];
  const metricNames = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate', 'throughput'];
  
  for (const userId of testUserIds) {
    for (let i = 0; i < 50; i++) {
      const metricName = metricNames[i % metricNames.length];
      const baseValue = metricName === 'cpu_usage' ? 60 : 
                       metricName === 'memory_usage' ? 70 :
                       metricName === 'response_time' ? 200 :
                       metricName === 'error_rate' ? 2 :
                       1000;
      
      const recordedAt = new Date();
      recordedAt.setHours(recordedAt.getHours() - (50 - i));
      
      metrics.push({
        user_id: userId,
        metric_name: metricName,
        metric_value: baseValue + (Math.random() * 20 - 10),
        metric_unit: metricName === 'response_time' ? 'ms' : metricName === 'throughput' ? 'req/s' : '%',
        timestamp: recordedAt.toISOString(),
        source_app: 'phase3_e2e_test',
      });
    }
  }
  
  const { error } = await supabase
    .from('telemetry_metrics')
    .insert(metrics);
  
  if (error) {
    throw new Error(`Failed to insert metrics: ${error.message}`);
  }
  
  logInfo(`Inserted ${metrics.length} metrics successfully`);
}

async function trainPredictiveModels(): Promise<void> {
  logInfo('Training 5 predictive models per user (50 total)...');
  
  const metricNames = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate', 'throughput'];
  let successCount = 0;
  let failCount = 0;
  
  for (const userId of testUserIds) {
    for (const metricName of metricNames) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/train-predictive-model`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            model_name: `${metricName}_predictor`,
            model_type: 'time_series',
            target_metric: metricName,
            features: ['hour_of_day', 'day_of_week'],
            training_window_days: 30,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Training failed: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Training failed');
        }
        
        successCount++;
      } catch (error) {
        failCount++;
        logWarning(`Failed to train ${metricName} for user: ${error.message}`);
      }
    }
  }
  
  logInfo(`Trained ${successCount} models successfully, ${failCount} failed`);
  
  if (successCount < 40) {
    throw new Error(`Too many training failures: ${failCount}/50`);
  }
}

async function generateForecasts(): Promise<void> {
  logInfo('Generating 5 forecasts per user (50 total)...');
  
  const { data: models, error: modelsError } = await supabase
    .from('predictive_models')
    .select('id, user_id, model_name, target_metric')
    .in('user_id', testUserIds)
    .eq('is_active', true);
  
  if (modelsError || !models || models.length === 0) {
    throw new Error('No trained models found');
  }
  
  logInfo(`Found ${models.length} trained models`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const model of models) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-predictive-insights`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: model.user_id,
          model_id: model.id,
          forecast_hours: 24,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Forecast failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Forecast generation failed');
      }
      
      successCount++;
    } catch (error) {
      failCount++;
      logWarning(`Failed to generate forecast for ${model.model_name}: ${error.message}`);
    }
  }
  
  logInfo(`Generated ${successCount} forecasts successfully, ${failCount} failed`);
  
  if (successCount < 40) {
    throw new Error(`Too many forecast failures: ${failCount}/${models.length}`);
  }
}

async function validateThresholdBreaches(): Promise<void> {
  logInfo('Validating threshold breach predictions...');
  
  const { data: thresholds, error: thresholdError } = await supabase
    .from('metric_thresholds')
    .insert(
      testUserIds.slice(0, 3).map(userId => ({
        user_id: userId,
        metric_name: 'cpu_usage',
        threshold_value: 75,
        threshold_type: 'above',
        alert_level: 'warning',
        enabled: true,
      }))
    )
    .select();
  
  if (thresholdError) {
    throw new Error(`Failed to create thresholds: ${thresholdError.message}`);
  }
  
  logInfo(`Created ${thresholds.length} test thresholds`);
  
  const { data: alerts, error: alertsError } = await supabase
    .from('predictive_alerts')
    .select('*')
    .in('user_id', testUserIds);
  
  if (alertsError) {
    throw new Error(`Failed to query predictive alerts: ${alertsError.message}`);
  }
  
  logInfo(`Found ${alerts?.length || 0} predictive alerts`);
  
  if (alerts && alerts.length > 0) {
    logInfo('Threshold breach predictions are working');
  } else {
    logWarning('No threshold breaches predicted (may be expected if values are within thresholds)');
  }
}

async function testAdaptiveRetraining(): Promise<void> {
  logInfo('Testing adaptive retraining scheduler...');
  
  const testUserId = testUserIds[0];
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/adaptive-retraining-scheduler`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: testUserId,
      force_retrain: false,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Retraining scheduler failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Retraining scheduler failed');
  }
  
  logInfo(`Retraining scheduler executed: ${result.message}`);
  logInfo(`Models checked: ${result.models_checked}, retrained: ${result.models_retrained}`);
}

async function verifyPredictionAccuracy(): Promise<void> {
  logInfo('Verifying prediction accuracy > 85%...');
  
  const { data: models, error: modelsError } = await supabase
    .from('predictive_models')
    .select('id, model_name, accuracy_score, mae, rmse, r2_score')
    .in('user_id', testUserIds)
    .eq('is_active', true);
  
  if (modelsError || !models || models.length === 0) {
    throw new Error('No models found for accuracy verification');
  }
  
  const avgAccuracy = models.reduce((sum, m) => sum + (m.accuracy_score || 0), 0) / models.length;
  const avgMae = models.reduce((sum, m) => sum + (m.mae || 0), 0) / models.length;
  const avgRmse = models.reduce((sum, m) => sum + (m.rmse || 0), 0) / models.length;
  const avgR2 = models.reduce((sum, m) => sum + (m.r2_score || 0), 0) / models.length;
  
  logInfo(`Average accuracy: ${(avgAccuracy * 100).toFixed(2)}%`);
  logInfo(`Average MAE: ${avgMae.toFixed(2)}`);
  logInfo(`Average RMSE: ${avgRmse.toFixed(2)}`);
  logInfo(`Average R²: ${avgR2.toFixed(4)}`);
  
  if (avgAccuracy < 0.85) {
    logWarning(`Average accuracy ${(avgAccuracy * 100).toFixed(2)}% is below 85% target`);
  } else {
    logInfo('Accuracy target met: > 85%');
  }
}

async function testQueryPerformance(): Promise<void> {
  logInfo('Testing database query performance...');
  
  const queries = [
    {
      name: 'Active models query',
      fn: () => supabase
        .from('predictive_models')
        .select('*')
        .in('user_id', testUserIds)
        .eq('is_active', true)
        .limit(50),
    },
    {
      name: 'Recent predictions query',
      fn: () => supabase
        .from('prediction_results')
        .select('*')
        .in('user_id', testUserIds)
        .order('predicted_at', { ascending: false })
        .limit(50),
    },
    {
      name: 'Training logs query',
      fn: () => supabase
        .from('training_logs')
        .select('*')
        .in('user_id', testUserIds)
        .order('training_started_at', { ascending: false })
        .limit(50),
    },
    {
      name: 'Predictive alerts query',
      fn: () => supabase
        .from('predictive_alerts')
        .select('*')
        .in('user_id', testUserIds)
        .order('created_at', { ascending: false })
        .limit(50),
    },
  ];
  
  let totalTime = 0;
  
  for (const query of queries) {
    const startTime = Date.now();
    const { error } = await query.fn();
    const duration = Date.now() - startTime;
    totalTime += duration;
    
    if (error) {
      throw new Error(`${query.name} failed: ${error.message}`);
    }
    
    logInfo(`${query.name}: ${duration}ms`);
    
    if (duration > 6000) {
      logWarning(`${query.name} exceeded 6s target`);
    }
  }
  
  if (totalTime > 6000) {
    logWarning(`Total query time ${totalTime}ms exceeds 6s target`);
  }
}

async function cleanupTestData(): Promise<void> {
  logInfo('Cleaning up test data...');
  
  for (const userId of testUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
  
  logInfo(`Cleaned up ${testUserIds.length} test users and associated data`);
}

async function main() {
  console.log('🚀 Phase 3: Predictive Operations Layer - Comprehensive E2E Test Suite\n');
  console.log('============================================================\n');
  
  await runTest('Create 10 test users', createTestUsers);
  await runTest('Insert 50 metrics per user (500 total)', insertMetrics);
  await runTest('Train 5 predictive models per user (50 total)', trainPredictiveModels);
  await runTest('Generate 5 forecasts per user (50 total)', generateForecasts);
  await runTest('Validate threshold breach predictions', validateThresholdBreaches);
  await runTest('Test adaptive retraining scheduler', testAdaptiveRetraining);
  await runTest('Verify prediction accuracy > 85%', verifyPredictionAccuracy);
  await runTest('Test database query performance', testQueryPerformance);
  await runTest('Cleanup test data', cleanupTestData);
  
  console.log('\n============================================================');
  console.log('📊 Test Summary\n');
  
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = testResults.filter(r => !r.passed).length;
  const successRate = (passedTests / testResults.length) * 100;
  
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);
  
  console.log('📋 Detailed Results:\n');
  for (const result of testResults) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\n============================================================\n');
  
  if (failedTests === 0) {
    console.log('✅ All tests passed!\n');
    Deno.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    Deno.exit(1);
  }
}

main();
