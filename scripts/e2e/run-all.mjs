#!/usr/bin/env node
/**
 * Run All E2E Tests
 * Executes all test suites and generates comprehensive health report
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const results = {
  backend: null,
  userApp: null,
  adminApp: null,
  ai: null,
  env: null
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function runTest(name, command) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log('='.repeat(60));

  try {
    execSync(command, {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    results[name] = 'PASSED';
    return true;
  } catch (error) {
    results[name] = 'FAILED';
    return false;
  }
}

function generateHealthReport() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'CORE314 SYSTEM HEALTH REPORT' + ' '.repeat(20) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  const testSuites = [
    { name: 'Backend/Database/RLS', key: 'backend' },
    { name: 'User App', key: 'userApp' },
    { name: 'Admin App', key: 'adminApp' },
    { name: 'AI Edge Functions', key: 'ai' },
    { name: 'Environment Variables', key: 'env' }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  testSuites.forEach(suite => {
    const status = results[suite.key];
    const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️';
    const statusText = status || 'SKIPPED';
    
    console.log(`${icon} ${suite.name.padEnd(30)} ${statusText}`);
    
    if (status === 'PASSED') totalPassed++;
    if (status === 'FAILED') totalFailed++;
  });

  console.log('');
  console.log('─'.repeat(60));
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('─'.repeat(60));

  if (totalFailed === 0) {
    console.log('');
    log('All tests passed! System is healthy.', 'pass');
    console.log('');
  } else {
    console.log('');
    log(`${totalFailed} test suite(s) failed. Review logs above for details.`, 'fail');
    console.log('');
  }

  return totalFailed === 0;
}

async function main() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(8) + 'CORE314 FULL E2E TEST SUITE' + ' '.repeat(23) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  // Run all test suites
  runTest('backend', 'node scripts/e2e/test-backend.mjs');
  runTest('userApp', 'node scripts/e2e/test-user-app.mjs');
  runTest('adminApp', 'node scripts/e2e/test-admin-app.mjs');
  runTest('ai', 'node scripts/e2e/test-ai.mjs');
  runTest('env', 'node scripts/e2e/validate-env.mjs');

  // Generate health report
  const allPassed = generateHealthReport();

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
