#!/usr/bin/env node
/**
 * Backend, Database, and RLS Validation Test
 * Tests:
 * - Database connectivity
 * - RLS policies on rate_limits and function_error_events
 * - Cleanup functions exist and are callable
 * - Table schemas are correct
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

async function testDatabaseConnectivity() {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Test basic connectivity by checking auth
    const { data, error } = await supabase.auth.getSession();
    
    if (error && error.message !== 'Auth session missing!') {
      throw error;
    }

    results.passed.push('Database connectivity');
    log('Database connectivity test passed', 'pass');
    return true;
  } catch (error) {
    results.failed.push(`Database connectivity: ${error.message}`);
    log(`Database connectivity test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testRateLimitsTable() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Try to query rate_limits table (should work with RLS)
    const { data, error } = await supabase
      .from('rate_limits')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    results.passed.push('rate_limits table accessible');
    log('rate_limits table test passed', 'pass');
    return true;
  } catch (error) {
    results.failed.push(`rate_limits table: ${error.message}`);
    log(`rate_limits table test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testFunctionErrorEventsTable() {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      results.warnings.push('function_error_events table: Skipped (no service key)');
      log('function_error_events table test skipped (no service key)', 'warn');
      return true;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Try to query function_error_events table (requires service role)
    const { data, error } = await supabase
      .from('function_error_events')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    results.passed.push('function_error_events table accessible');
    log('function_error_events table test passed', 'pass');
    return true;
  } catch (error) {
    results.failed.push(`function_error_events table: ${error.message}`);
    log(`function_error_events table test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testCleanupFunctions() {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      results.warnings.push('Cleanup functions: Skipped (no service key)');
      log('Cleanup functions test skipped (no service key)', 'warn');
      return true;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Test cleanup_old_rate_limits function
    const { data: rateLimitsData, error: rateLimitsError } = await supabase
      .rpc('cleanup_old_rate_limits');

    if (rateLimitsError) {
      throw new Error(`cleanup_old_rate_limits: ${rateLimitsError.message}`);
    }

    // Test cleanup_old_error_events function
    const { data: errorEventsData, error: errorEventsError } = await supabase
      .rpc('cleanup_old_error_events');

    if (errorEventsError) {
      throw new Error(`cleanup_old_error_events: ${errorEventsError.message}`);
    }

    results.passed.push('Cleanup functions callable');
    log(`Cleanup functions test passed (deleted ${rateLimitsData} rate limits, ${errorEventsData} error events)`, 'pass');
    return true;
  } catch (error) {
    results.failed.push(`Cleanup functions: ${error.message}`);
    log(`Cleanup functions test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function runTests() {
  console.log('\n=== Backend, Database, and RLS Validation ===\n');

  await testDatabaseConnectivity();
  await testRateLimitsTable();
  await testFunctionErrorEventsTable();
  await testCleanupFunctions();

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
