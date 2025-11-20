#!/usr/bin/env ts-node
/**
 * RLS (Row Level Security) Audit Script
 * Tests RLS policies across all user-facing tables
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AuditResult {
  table: string;
  test: string;
  status: 'pass' | 'fail';
  details: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

const results: AuditResult[] = [];

const TABLES_TO_AUDIT = [
  'profiles',
  'user_subscriptions',
  'user_addons',
  'plan_limits',
  'fusion_efficiency_metrics',
  'billing_activity_log',
  'integrity_anomalies',
];

async function createTestUsers() {
  console.log('👥 Creating test users for RLS audit...\n');

  const testUsers = [];

  for (let i = 1; i <= 2; i++) {
    const email = `rls_test_user_${i}_${Date.now()}@core314.com`;
    const password = 'RLSTest2025!';

    const { data, error } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      console.error(`❌ Failed to create test user ${i}:`, error);
      continue;
    }

    testUsers.push({
      id: data.user.id,
      email,
      password,
    });

    console.log(`✅ Created test user ${i}: ${email}`);
  }

  return testUsers;
}

async function testCrossTenantAccess(userA: any, userB: any) {
  console.log('\n🔒 Testing cross-tenant access controls...\n');

  const supabaseA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: sessionA, error: errorA } = await supabaseA.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });

  if (errorA || !sessionA.session) {
    console.error('❌ Failed to sign in as User A:', errorA);
    return;
  }

  const supabaseB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: sessionB, error: errorB } = await supabaseB.auth.signInWithPassword({
    email: userB.email,
    password: userB.password,
  });

  if (errorB || !sessionB.session) {
    console.error('❌ Failed to sign in as User B:', errorB);
    return;
  }

  console.log('Test 1: User A attempts to read User B\'s profile');
  const { data: profileData, error: profileError } = await supabaseA
    .from('profiles')
    .select('*')
    .eq('id', userB.id);

  if (profileError || !profileData || profileData.length === 0) {
    results.push({
      table: 'profiles',
      test: 'Cross-tenant read protection',
      status: 'pass',
      details: 'User A cannot read User B\'s profile',
    });
    console.log('✅ PASS: User A cannot read User B\'s profile');
  } else {
    results.push({
      table: 'profiles',
      test: 'Cross-tenant read protection',
      status: 'fail',
      details: 'User A can read User B\'s profile - RLS VIOLATION',
      severity: 'critical',
    });
    console.log('❌ FAIL: User A can read User B\'s profile - RLS VIOLATION');
  }

  console.log('\nTest 2: User A attempts to update User B\'s profile');
  const { error: updateError } = await supabaseA
    .from('profiles')
    .update({ full_name: 'Hacked by User A' })
    .eq('id', userB.id);

  if (updateError) {
    results.push({
      table: 'profiles',
      test: 'Cross-tenant write protection',
      status: 'pass',
      details: 'User A cannot update User B\'s profile',
    });
    console.log('✅ PASS: User A cannot update User B\'s profile');
  } else {
    results.push({
      table: 'profiles',
      test: 'Cross-tenant write protection',
      status: 'fail',
      details: 'User A can update User B\'s profile - RLS VIOLATION',
      severity: 'critical',
    });
    console.log('❌ FAIL: User A can update User B\'s profile - RLS VIOLATION');
  }

  console.log('\nTest 3: User A attempts to read own profile');
  const { data: ownProfileData, error: ownProfileError } = await supabaseA
    .from('profiles')
    .select('*')
    .eq('id', userA.id);

  if (!ownProfileError && ownProfileData && ownProfileData.length > 0) {
    results.push({
      table: 'profiles',
      test: 'Own data read access',
      status: 'pass',
      details: 'User A can read own profile',
    });
    console.log('✅ PASS: User A can read own profile');
  } else {
    results.push({
      table: 'profiles',
      test: 'Own data read access',
      status: 'fail',
      details: 'User A cannot read own profile - RLS TOO RESTRICTIVE',
      severity: 'high',
    });
    console.log('❌ FAIL: User A cannot read own profile - RLS TOO RESTRICTIVE');
  }

  console.log('\nTest 4: User A attempts to read User B\'s subscriptions');
  const { data: subData, error: subError } = await supabaseA
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userB.id);

  if (subError || !subData || subData.length === 0) {
    results.push({
      table: 'user_subscriptions',
      test: 'Cross-tenant read protection',
      status: 'pass',
      details: 'User A cannot read User B\'s subscriptions',
    });
    console.log('✅ PASS: User A cannot read User B\'s subscriptions');
  } else {
    results.push({
      table: 'user_subscriptions',
      test: 'Cross-tenant read protection',
      status: 'fail',
      details: 'User A can read User B\'s subscriptions - RLS VIOLATION',
      severity: 'critical',
    });
    console.log('❌ FAIL: User A can read User B\'s subscriptions - RLS VIOLATION');
  }

  console.log('\nTest 5: User A attempts to read User B\'s billing activity');
  const { data: billingData, error: billingError } = await supabaseA
    .from('billing_activity_log')
    .select('*')
    .eq('user_id', userB.id);

  if (billingError || !billingData || billingData.length === 0) {
    results.push({
      table: 'billing_activity_log',
      test: 'Cross-tenant read protection',
      status: 'pass',
      details: 'User A cannot read User B\'s billing activity',
    });
    console.log('✅ PASS: User A cannot read User B\'s billing activity');
  } else {
    results.push({
      table: 'billing_activity_log',
      test: 'Cross-tenant read protection',
      status: 'fail',
      details: 'User A can read User B\'s billing activity - RLS VIOLATION',
      severity: 'critical',
    });
    console.log('❌ FAIL: User A can read User B\'s billing activity - RLS VIOLATION');
  }
}

async function testServiceRoleAccess() {
  console.log('\n🔑 Testing service role access...\n');

  for (const table of TABLES_TO_AUDIT) {
    console.log(`Testing service role access to ${table}...`);
    
    const { data, error } = await serviceSupabase
      .from(table)
      .select('*')
      .limit(1);

    if (!error) {
      results.push({
        table,
        test: 'Service role read access',
        status: 'pass',
        details: 'Service role can read from table',
      });
      console.log(`✅ PASS: Service role can read from ${table}`);
    } else {
      results.push({
        table,
        test: 'Service role read access',
        status: 'fail',
        details: `Service role cannot read from table: ${error.message}`,
        severity: 'high',
      });
      console.log(`❌ FAIL: Service role cannot read from ${table}: ${error.message}`);
    }
  }
}

async function testAnonAccess() {
  console.log('\n🌐 Testing anonymous access restrictions...\n');

  const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const sensitiveTables = ['user_subscriptions', 'billing_activity_log', 'integrity_anomalies'];

  for (const table of sensitiveTables) {
    console.log(`Testing anonymous access to ${table}...`);
    
    const { data, error } = await anonSupabase
      .from(table)
      .select('*')
      .limit(1);

    if (error || !data || data.length === 0) {
      results.push({
        table,
        test: 'Anonymous access restriction',
        status: 'pass',
        details: 'Anonymous users cannot access sensitive table',
      });
      console.log(`✅ PASS: Anonymous users cannot access ${table}`);
    } else {
      results.push({
        table,
        test: 'Anonymous access restriction',
        status: 'fail',
        details: 'Anonymous users can access sensitive table - SECURITY RISK',
        severity: 'critical',
      });
      console.log(`❌ FAIL: Anonymous users can access ${table} - SECURITY RISK`);
    }
  }
}

async function cleanupTestUsers(testUsers: any[]) {
  console.log('\n🧹 Cleaning up test users...\n');

  for (const user of testUsers) {
    const { error } = await serviceSupabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`⚠️  Failed to delete test user ${user.email}:`, error);
    } else {
      console.log(`✅ Deleted test user: ${user.email}`);
    }
  }
}

async function runRLSAudit() {
  console.log('🔐 Starting RLS Audit...\n');
  console.log('=' .repeat(80));

  try {
    const testUsers = await createTestUsers();

    if (testUsers.length < 2) {
      console.error('❌ Failed to create sufficient test users');
      return { success: false };
    }

    await testCrossTenantAccess(testUsers[0], testUsers[1]);
    await testServiceRoleAccess();
    await testAnonAccess();

    await cleanupTestUsers(testUsers);

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RLS Audit Summary:\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const critical = results.filter(r => r.severity === 'critical').length;

    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🚨 Critical failures: ${critical}`);

    if (failed > 0) {
      console.log('\n⚠️  Failed tests:');
      results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`  - ${r.table}: ${r.test} [${r.severity}]`);
        console.log(`    ${r.details}`);
      });
    }

    const outputPath = path.join(__dirname, '../../Phase69_RLS_Audit_Results.json');
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed,
        failed,
        critical,
      },
      results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n📝 Results written to ${outputPath}`);

    return { success: failed === 0, results };
  } catch (error) {
    console.error('❌ RLS audit failed:', error);
    return { success: false, error };
  }
}

runRLSAudit()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ RLS audit completed successfully - All tests passed');
      process.exit(0);
    } else {
      console.log('\n❌ RLS audit completed with failures');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
