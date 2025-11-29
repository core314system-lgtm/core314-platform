#!/usr/bin/env node
/**
 * Environment Variables Validation
 * Tests:
 * - Required env vars for User App
 * - Required env vars for Admin App
 * - Required secrets for Edge Functions
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function checkEnvVar(name, value) {
  if (!value || value === 'undefined' || value === 'null') {
    results.failed.push(`Missing env var: ${name}`);
    log(`Missing env var: ${name}`, 'fail');
    return false;
  } else {
    results.passed.push(`Env var present: ${name}`);
    log(`Env var present: ${name}`, 'pass');
    return true;
  }
}

function testUserAppEnvVars() {
  console.log('\n=== User App Environment Variables ===\n');

  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY'
  ];

  requiredVars.forEach(varName => {
    checkEnvVar(varName, process.env[varName]);
  });
}

function testAdminAppEnvVars() {
  console.log('\n=== Admin App Environment Variables ===\n');

  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];

  requiredVars.forEach(varName => {
    checkEnvVar(varName, process.env[varName]);
  });
}

function testEdgeFunctionSecrets() {
  console.log('\n=== Edge Function Secrets ===\n');

  try {
    // Check Supabase secrets using CLI
    const output = execSync('cd core314-app && supabase secrets list', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const requiredSecrets = [
      'OPENAI_API_KEY',
      'SLACK_ALERT_WEBHOOK',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_URL'
    ];

    requiredSecrets.forEach(secretName => {
      if (output.includes(secretName)) {
        results.passed.push(`Secret present: ${secretName}`);
        log(`Secret present: ${secretName}`, 'pass');
      } else {
        results.failed.push(`Missing secret: ${secretName}`);
        log(`Missing secret: ${secretName}`, 'fail');
      }
    });
  } catch (error) {
    results.warnings.push('Could not check Edge Function secrets (supabase CLI error)');
    log('Could not check Edge Function secrets (supabase CLI error)', 'warn');
  }
}

function testEnvExampleFiles() {
  console.log('\n=== .env.example Files ===\n');

  const envExamplePaths = [
    'core314-app/.env.example',
    'core314-admin/.env.example'
  ];

  envExamplePaths.forEach(path => {
    try {
      const content = readFileSync(path, 'utf-8');
      if (content.length > 0) {
        results.passed.push(`.env.example exists: ${path}`);
        log(`.env.example exists: ${path}`, 'pass');
      } else {
        results.warnings.push(`.env.example empty: ${path}`);
        log(`.env.example empty: ${path}`, 'warn');
      }
    } catch (error) {
      results.warnings.push(`.env.example missing: ${path}`);
      log(`.env.example missing: ${path}`, 'warn');
    }
  });
}

function runTests() {
  console.log('\n=== Environment Variables Validation ===\n');

  testUserAppEnvVars();
  testAdminAppEnvVars();
  testEdgeFunctionSecrets();
  testEnvExampleFiles();

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

runTests();
