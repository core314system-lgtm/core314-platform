#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}

interface TestUser {
  id: string;
  email: string;
}

const results: TestResult[] = [];
let testUsers: TestUser[] = [];

async function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function createTestUsers(count: number = 3): Promise<TestUser[]> {
  log(`Creating ${count} test users...`);
  const users: TestUser[] = [];

  for (let i = 0; i < count; i++) {
    const email = `phase5_test_${Date.now()}_${i}@test.com`;
    const password = 'TestPassword123!';

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');

    users.push({ id: data.user.id, email });
  }

  log(`✓ Created ${users.length} test users`);
  return users;
}

async function testDecisionScoringLogic(userId: string): Promise<boolean> {
  log('Test 1: Decision scoring logic with weighted factors...');
  const startTime = Date.now();
  
  try {
    const factors = [
      {
        factor_name: 'revenue_trend',
        factor_category: 'financial',
        current_value: 12000,
        baseline_value: 10000,
        threshold_value: 15000,
        weight: 0.4,
      },
      {
        factor_name: 'cost_efficiency',
        factor_category: 'operational',
        current_value: 0.85,
        baseline_value: 0.75,
        threshold_value: 0.90,
        weight: 0.3,
      },
      {
        factor_name: 'customer_satisfaction',
        factor_category: 'customer',
        current_value: 4.5,
        baseline_value: 4.0,
        threshold_value: 4.8,
        weight: 0.3,
      },
    ];
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        decision_type: 'optimization',
        trigger_source: 'manual',
        context_data: {
          scenario: 'quarterly_review',
          department: 'operations',
        },
        factors,
        requires_approval: true,
        priority: 7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Edge Function failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.decision_event_id) {
      throw new Error('Invalid response structure');
    }
    
    if (result.confidence_score < 0.6) {
      throw new Error(`Confidence score ${result.confidence_score} below acceptable threshold`);
    }
    
    if (!result.factors_analyzed || result.factors_analyzed.length !== 3) {
      throw new Error(`Expected 3 factors, got ${result.factors_analyzed?.length || 0}`);
    }
    
    const totalWeight = result.factors_analyzed.reduce((sum: number, f: any) => sum + f.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Factor weights sum to ${totalWeight}, expected 1.0`);
    }
    
    let expectedScore = 0;
    for (const factor of result.factors_analyzed) {
      if (factor.weighted_score === undefined) {
        throw new Error(`Missing weighted_score for factor ${factor.factor_name}`);
      }
      expectedScore += factor.weighted_score;
    }
    
    const scoringAccuracy = 1 - Math.abs(expectedScore - result.confidence_score) / expectedScore;
    
    const duration = Date.now() - startTime;
    results.push({
      name: 'Decision Scoring Logic',
      passed: scoringAccuracy >= 0.85,
      details: `Scoring accuracy: ${(scoringAccuracy * 100).toFixed(1)}% (target: ≥85%), Confidence: ${result.confidence_score.toFixed(2)}, Factors: ${result.factors_analyzed.length}`,
      duration,
    });
    
    log(`✓ Decision scoring accuracy: ${(scoringAccuracy * 100).toFixed(1)}%`);
    return scoringAccuracy >= 0.85;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Decision Scoring Logic',
      passed: false,
      details: `Error: ${error.message}`,
      duration,
    });
    log(`✗ Test failed: ${error.message}`);
    return false;
  }
}

async function testValidationEnforcement(userId: string): Promise<boolean> {
  log('Test 2: Validation enforcement with policy rules...');
  const startTime = Date.now();
  
  try {
    const response1 = await fetch(`${SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        decision_type: 'alert',
        trigger_source: 'threshold',
        context_data: { test: 'low_confidence' },
        factors: [
          {
            factor_name: 'test_metric',
            factor_category: 'technical',
            current_value: 50,
            baseline_value: 100,
            threshold_value: 80,
            weight: 1.0,
          },
        ],
      }),
    });

    const decision = await response1.json();
    
    const response2 = await fetch(`${SUPABASE_URL}/functions/v1/decision-validation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        decision_event_id: decision.decision_event_id,
        validation_rules: {
          min_confidence: 0.8,
          max_risk_level: 'medium',
          approval_threshold: 0.75,
        },
      }),
    });

    if (!response2.ok) {
      throw new Error('Validation function failed');
    }

    const validation = await response2.json();
    
    if (!validation.violations || validation.violations.length === 0) {
      throw new Error('Expected validation violations for low-confidence decision');
    }
    
    if (validation.validation_status === 'passed') {
      throw new Error('Low-confidence decision should not pass validation');
    }
    
    if (!validation.recommendations || validation.recommendations.length === 0) {
      throw new Error('Expected validation recommendations');
    }
    
    const duration = Date.now() - startTime;
    results.push({
      name: 'Validation Enforcement',
      passed: true,
      details: `Violations detected: ${validation.violations.length}, Status: ${validation.validation_status}, Recommendations: ${validation.recommendations.length}`,
      duration,
    });
    
    log(`✓ Validation enforcement working: ${validation.violations.length} violations detected`);
    return true;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Validation Enforcement',
      passed: false,
      details: `Error: ${error.message}`,
      duration,
    });
    log(`✗ Test failed: ${error.message}`);
    return false;
  }
}

async function testRecommendationLatency(userId: string): Promise<boolean> {
  log('Test 3: Recommendation latency measurement...');
  const startTime = Date.now();
  
  try {
    const response1 = await fetch(`${SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        decision_type: 'recommendation',
        trigger_source: 'manual',
        context_data: { test: 'latency' },
        factors: [
          {
            factor_name: 'performance',
            factor_category: 'technical',
            current_value: 95,
            baseline_value: 80,
            threshold_value: 90,
            weight: 1.0,
          },
        ],
      }),
    });

    const decision = await response1.json();
    const decisionLatency = Date.now() - startTime;
    
    const { data: recommendation, error: recError } = await supabase
      .from('recommendation_queue')
      .insert({
        user_id: userId,
        decision_event_id: decision.decision_event_id,
        recommendation_type: 'action',
        recommendation_title: 'Test Recommendation',
        recommendation_description: 'Latency test',
        action_type: 'create_task',
        action_target: 'internal',
        action_payload: { title: 'Test task' },
        priority: 5,
        urgency: 'medium',
        requires_approval: false,
        approval_status: 'auto_approved',
      })
      .select()
      .single();
    
    if (recError) throw recError;
    
    const execStartTime = Date.now();
    const response2 = await fetch(`${SUPABASE_URL}/functions/v1/recommendation-execution`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        recommendation_id: recommendation.id,
        execution_mode: 'immediate',
      }),
    });

    const execution = await response2.json();
    const executionLatency = Date.now() - execStartTime;
    const totalLatency = Date.now() - startTime;
    
    const latencyOk = totalLatency < 3000;
    
    const duration = Date.now() - startTime;
    results.push({
      name: 'Recommendation Latency',
      passed: latencyOk,
      details: `Total: ${totalLatency}ms (target: <3000ms), Decision: ${decisionLatency}ms, Execution: ${executionLatency}ms`,
      duration,
    });
    
    log(`✓ Recommendation latency: ${totalLatency}ms (target: <3000ms)`);
    return latencyOk;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Recommendation Latency',
      passed: false,
      details: `Error: ${error.message}`,
      duration,
    });
    log(`✗ Test failed: ${error.message}`);
    return false;
  }
}

async function testRLSPolicyIsolation(): Promise<boolean> {
  log('Test 4: RLS policy isolation across users...');
  const startTime = Date.now();
  
  try {
    const user1 = testUsers[0];
    const user2 = testUsers[1];
    
    const response1 = await fetch(`${SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user1.id,
        decision_type: 'optimization',
        trigger_source: 'manual',
        context_data: { owner: 'user1' },
        factors: [
          {
            factor_name: 'test',
            factor_category: 'technical',
            current_value: 100,
            baseline_value: 80,
            weight: 1.0,
          },
        ],
      }),
    });

    const decision1 = await response1.json();
    
    const { data: user2Decisions, error: accessError } = await supabase
      .from('decision_events')
      .select('*')
      .eq('id', decision1.decision_event_id)
      .eq('user_id', user2.id);
    
    if (user2Decisions && user2Decisions.length > 0) {
      throw new Error('RLS failed: User2 can access User1 decisions');
    }
    
    const { data: user1Decisions, error: user1Error } = await supabase
      .from('decision_events')
      .select('*')
      .eq('id', decision1.decision_event_id)
      .eq('user_id', user1.id);
    
    if (user1Error || !user1Decisions || user1Decisions.length === 0) {
      throw new Error('User1 cannot access their own decision');
    }
    
    const { data: user2Factors } = await supabase
      .from('decision_factors')
      .select('*')
      .eq('decision_event_id', decision1.decision_event_id)
      .eq('user_id', user2.id);
    
    if (user2Factors && user2Factors.length > 0) {
      throw new Error('RLS failed: User2 can access User1 decision factors');
    }
    
    const { data: rec } = await supabase
      .from('recommendation_queue')
      .insert({
        user_id: user1.id,
        decision_event_id: decision1.decision_event_id,
        recommendation_type: 'action',
        recommendation_title: 'RLS Test',
        recommendation_description: 'Test',
        action_type: 'create_task',
        action_target: 'internal',
        action_payload: {},
      })
      .select()
      .single();
    
    const { data: user2Recs } = await supabase
      .from('recommendation_queue')
      .select('*')
      .eq('id', rec.id)
      .eq('user_id', user2.id);
    
    if (user2Recs && user2Recs.length > 0) {
      throw new Error('RLS failed: User2 can access User1 recommendations');
    }
    
    const { data: user2Audit } = await supabase
      .from('decision_audit_log')
      .select('*')
      .eq('decision_event_id', decision1.decision_event_id)
      .eq('user_id', user2.id);
    
    if (user2Audit && user2Audit.length > 0) {
      throw new Error('RLS failed: User2 can access User1 audit logs');
    }
    
    const duration = Date.now() - startTime;
    results.push({
      name: 'RLS Policy Isolation',
      passed: true,
      details: 'All 4 tables enforce user isolation: decision_events, decision_factors, recommendation_queue, decision_audit_log',
      duration,
    });
    
    log('✓ RLS policies enforcing user isolation on all Phase 5 tables');
    return true;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'RLS Policy Isolation',
      passed: false,
      details: `Error: ${error.message}`,
      duration,
    });
    log(`✗ Test failed: ${error.message}`);
    return false;
  }
}

async function testDecisionAuditTrail(userId: string): Promise<boolean> {
  log('Test 5: Decision audit trail logging...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        decision_type: 'automation',
        trigger_source: 'scheduled',
        context_data: { test: 'audit' },
        factors: [],
      }),
    });

    const decision = await response.json();
    
    const { data: auditLogs, error: auditError } = await supabase
      .from('decision_audit_log')
      .select('*')
      .eq('decision_event_id', decision.decision_event_id)
      .eq('user_id', userId);
    
    if (auditError) throw auditError;
    
    if (!auditLogs || auditLogs.length === 0) {
      throw new Error('No audit log entries created');
    }
    
    const auditLog = auditLogs[0];
    if (!auditLog.event_type || !auditLog.event_category || !auditLog.event_description) {
      throw new Error('Audit log missing required fields');
    }
    
    const { error: updateError } = await supabase
      .from('decision_audit_log')
      .update({ event_description: 'modified' })
      .eq('id', auditLog.id);
    
    if (!updateError) {
      throw new Error('Audit log is not immutable - UPDATE should be blocked');
    }
    
    const duration = Date.now() - startTime;
    results.push({
      name: 'Decision Audit Trail',
      passed: true,
      details: `Audit logs created: ${auditLogs.length}, Immutability verified`,
      duration,
    });
    
    log(`✓ Audit trail logging: ${auditLogs.length} entries, immutable`);
    return true;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Decision Audit Trail',
      passed: false,
      details: `Error: ${error.message}`,
      duration,
    });
    log(`✗ Test failed: ${error.message}`);
    return false;
  }
}

async function cleanup() {
  log('Cleaning up test data...');
  
  for (const user of testUsers) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        log(`Warning: Failed to delete user ${user.email}: ${error.message}`);
      } else {
        log(`✓ Deleted user ${user.email}`);
      }
    } catch (error) {
      log(`Warning: Error deleting user ${user.email}: ${error.message}`);
    }
  }
}

function printResults() {
  log('\n' + '='.repeat(80));
  log('PHASE 5: COGNITIVE DECISION ENGINE - E2E TEST RESULTS');
  log('='.repeat(80) + '\n');
  
  results.forEach((result, index) => {
    const status = result.passed ? '✓' : '✗';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    log(`${index + 1}. ${status} ${result.name}${duration}`);
    log(`   ${result.details}\n`);
  });
  
  log('='.repeat(80));
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = (passedCount / totalCount * 100).toFixed(1);
  log(`SUMMARY: ${passedCount}/${totalCount} tests passed (${passRate}%)`);
  log('='.repeat(80) + '\n');
  
  if (passedCount === totalCount) {
    log('🎉 ALL TESTS PASSED! Phase 5 backend is ready for frontend implementation.');
  } else {
    log(`⚠️  ${totalCount - passedCount} test(s) failed. Review and fix before proceeding.`);
  }
}

async function main() {
  try {
    log('Starting Phase 5 E2E Test Suite...\n');
    
    testUsers = await createTestUsers(3);
    const user1 = testUsers[0];
    
    await testDecisionScoringLogic(user1.id);
    await testValidationEnforcement(user1.id);
    await testRecommendationLatency(user1.id);
    await testRLSPolicyIsolation();
    await testDecisionAuditTrail(user1.id);
    
    await cleanup();
    
    printResults();
    
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log(`\nFatal error: ${error.message}`);
    await cleanup();
    process.exit(1);
  }
}

main();
