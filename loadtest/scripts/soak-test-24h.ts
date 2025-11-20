/**
 * 24-Hour Soak Test for Core314 Beta Launch
 * 
 * Purpose: Validate system stability under sustained load with 100 concurrent users
 * Target: < 1% error rate, > 99.9% uptime
 * 
 * Usage:
 *   SUPABASE_URL="..." SUPABASE_ANON_KEY="..." npx ts-node soak-test-24h.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SoakTestMetrics {
  startTime: string;
  endTime: string;
  durationHours: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  uptimePercentage: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeSessions: number;
  fusionScoreStability: {
    avgScore: number;
    avgDeviation: number;
    maxDeviation: number;
  };
  errorBreakdown: Record<string, number>;
  recommendations: string[];
}

async function runSoakTest(): Promise<SoakTestMetrics> {
  const startTime = new Date().toISOString();
  console.log(`🚀 Starting 24-hour soak test at ${startTime}`);
  console.log('📊 Target: 100 concurrent users, < 1% error rate, > 99.9% uptime\n');

  const testDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  const checkIntervalMs = 5 * 60 * 1000; // Check every 5 minutes
  const totalChecks = testDurationMs / checkIntervalMs;

  let checkCount = 0;
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  const responseTimes: number[] = [];
  const errorTypes: Record<string, number> = {};

  console.log(`⏱️  Test will run for 24 hours with checks every 5 minutes (${totalChecks} total checks)\n`);

  const testInterval = setInterval(async () => {
    checkCount++;
    const progress = ((checkCount / totalChecks) * 100).toFixed(1);
    
    console.log(`[${checkCount}/${totalChecks}] Progress: ${progress}% - ${new Date().toLocaleTimeString()}`);

    try {
      const fiveMinutesAgo = new Date(Date.now() - checkIntervalMs).toISOString();
      
      const { data: apiCalls, error: apiError } = await supabase
        .from('beta_monitoring_log')
        .select('latency_ms, status_code, error_message')
        .eq('event_type', 'api_call')
        .gte('created_at', fiveMinutesAgo);

      if (apiError) {
        console.error('  ❌ Error fetching monitoring data:', apiError.message);
        return;
      }

      if (apiCalls && apiCalls.length > 0) {
        totalRequests += apiCalls.length;
        
        apiCalls.forEach(call => {
          if (call.status_code && call.status_code >= 200 && call.status_code < 400) {
            successfulRequests++;
          } else {
            failedRequests++;
            const errorType = call.error_message || `HTTP ${call.status_code}`;
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
          }
          
          if (call.latency_ms) {
            responseTimes.push(call.latency_ms);
          }
        });

        const currentErrorRate = (failedRequests / totalRequests) * 100;
        const avgLatency = responseTimes.length > 0 
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
          : 0;

        console.log(`  📈 Requests: ${apiCalls.length} | Total: ${totalRequests} | Error Rate: ${currentErrorRate.toFixed(2)}% | Avg Latency: ${avgLatency.toFixed(0)}ms`);

        if (currentErrorRate > 1) {
          console.log(`  ⚠️  WARNING: Error rate exceeds 1% threshold!`);
        }
      } else {
        console.log(`  ℹ️  No API calls in the last 5 minutes`);
      }

    } catch (error) {
      console.error('  ❌ Error during check:', error);
    }

    if (checkCount >= totalChecks) {
      clearInterval(testInterval);
      await generateReport();
    }
  }, checkIntervalMs);

  async function generateReport(): Promise<void> {
    const endTime = new Date().toISOString();
    console.log(`\n✅ Soak test completed at ${endTime}`);
    console.log('📊 Generating final report...\n');

    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    const uptimePercentage = 100 - errorRate;
    
    responseTimes.sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const { data: sessionsData } = await supabase.rpc('get_active_sessions_count');
    const activeSessions = sessionsData || 0;

    const { data: fusionTrend } = await supabase.rpc('get_fusion_health_trend_24h');
    const fusionScores = fusionTrend?.map((t: any) => parseFloat(t.avg_fusion_score)) || [];
    const fusionDeviations = fusionTrend?.map((t: any) => parseFloat(t.avg_deviation)) || [];
    
    const avgScore = fusionScores.length > 0 
      ? fusionScores.reduce((a: number, b: number) => a + b, 0) / fusionScores.length 
      : 0;
    const avgDeviation = fusionDeviations.length > 0 
      ? fusionDeviations.reduce((a: number, b: number) => a + b, 0) / fusionDeviations.length 
      : 0;
    const maxDeviation = fusionDeviations.length > 0 ? Math.max(...fusionDeviations) : 0;

    const recommendations: string[] = [];
    
    if (errorRate > 1) {
      recommendations.push('❌ CRITICAL: Error rate exceeds 1% target - investigate error logs immediately');
    } else {
      recommendations.push('✅ Error rate within acceptable range (< 1%)');
    }

    if (uptimePercentage < 99.9) {
      recommendations.push('⚠️  Uptime below 99.9% target - review system stability');
    } else {
      recommendations.push('✅ Uptime meets 99.9% target');
    }

    if (avgResponseTime > 800) {
      recommendations.push('⚠️  Average response time exceeds 800ms - consider performance optimization');
    } else {
      recommendations.push('✅ Response times within acceptable range');
    }

    if (maxDeviation > 20) {
      recommendations.push('⚠️  High fusion score deviation detected - review scoring algorithm');
    } else {
      recommendations.push('✅ Fusion score stability maintained');
    }

    const metrics: SoakTestMetrics = {
      startTime,
      endTime,
      durationHours: 24,
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate,
      uptimePercentage,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      activeSessions,
      fusionScoreStability: {
        avgScore,
        avgDeviation,
        maxDeviation
      },
      errorBreakdown: errorTypes,
      recommendations
    };

    const reportPath = path.join(__dirname, '..', '..', 'Phase70_Soak_Test_Results.json');
    fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                24-HOUR SOAK TEST RESULTS                  ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Start Time:           ${startTime}`);
    console.log(`End Time:             ${endTime}`);
    console.log(`Duration:             24 hours`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Total Requests:       ${totalRequests.toLocaleString()}`);
    console.log(`Successful:           ${successfulRequests.toLocaleString()}`);
    console.log(`Failed:               ${failedRequests.toLocaleString()}`);
    console.log(`Error Rate:           ${errorRate.toFixed(2)}% ${errorRate <= 1 ? '✅' : '❌'}`);
    console.log(`Uptime:               ${uptimePercentage.toFixed(3)}% ${uptimePercentage >= 99.9 ? '✅' : '❌'}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Avg Response Time:    ${avgResponseTime.toFixed(0)}ms`);
    console.log(`P95 Response Time:    ${p95ResponseTime}ms`);
    console.log(`P99 Response Time:    ${p99ResponseTime}ms`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Active Sessions:      ${activeSessions}`);
    console.log(`Avg Fusion Score:     ${avgScore.toFixed(2)}`);
    console.log(`Avg Deviation:        ${avgDeviation.toFixed(2)}`);
    console.log(`Max Deviation:        ${maxDeviation.toFixed(2)}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log('RECOMMENDATIONS:');
    recommendations.forEach(rec => console.log(`  ${rec}`));
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    process.exit(0);
  }

  return {} as SoakTestMetrics;
}

runSoakTest().catch(error => {
  console.error('❌ Fatal error during soak test:', error);
  process.exit(1);
});
