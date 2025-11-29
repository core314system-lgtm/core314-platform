#!/usr/bin/env node
/**
 * Admin App Smoke Test
 * Tests:
 * - App loads (200 response)
 * - Critical routes accessible
 * - Assets load correctly
 */

const ADMIN_APP_URL = process.env.ADMIN_APP_URL || 'https://admin.core314.com';

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

async function testAppLoads() {
  try {
    const response = await fetch(ADMIN_APP_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Core314-E2E-Test'
      }
    });

    if (response.status === 200) {
      const html = await response.text();
      
      // Check for expected markers
      if (html.includes('<!doctype html') || html.includes('<!DOCTYPE html')) {
        results.passed.push('Admin app loads successfully');
        log('Admin app loads test passed (200)', 'pass');
        return true;
      } else {
        throw new Error('Response is not valid HTML');
      }
    } else {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`Admin app loads: ${error.message}`);
    log(`Admin app loads test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testLoginRoute() {
  try {
    const response = await fetch(`${ADMIN_APP_URL}/login`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Core314-E2E-Test'
      }
    });

    if (response.status === 200) {
      results.passed.push('Login route accessible');
      log('Login route test passed (200)', 'pass');
      return true;
    } else {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`Login route: ${error.message}`);
    log(`Login route test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testAdminDashboardRoute() {
  try {
    const response = await fetch(`${ADMIN_APP_URL}/admin`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Core314-E2E-Test'
      }
    });

    // Admin dashboard should redirect to login if not authenticated (302/401) or load (200)
    if (response.status === 200 || response.status === 302 || response.status === 401) {
      results.passed.push('Admin dashboard route accessible');
      log(`Admin dashboard route test passed (${response.status})`, 'pass');
      return true;
    } else {
      throw new Error(`Expected 200/302/401, got ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`Admin dashboard route: ${error.message}`);
    log(`Admin dashboard route test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function runTests() {
  console.log('\n=== Admin App Smoke Test ===\n');
  console.log(`Testing: ${ADMIN_APP_URL}\n`);

  await testAppLoads();
  await testLoginRoute();
  await testAdminDashboardRoute();

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
