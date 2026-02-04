#!/usr/bin/env node
/**
 * Core Navigation Validation Script
 * 
 * This script validates that CORE UI navigation items are present in MainLayout.tsx.
 * Core navigation items are considered essential to the platform and cannot be removed
 * without explicit, intentional changes.
 * 
 * Run this script in CI to prevent accidental removal of core navigation items.
 * 
 * Usage:
 *   node scripts/validate-core-navigation.js
 * 
 * Exit codes:
 *   0 - All core navigation items are present
 *   1 - One or more core navigation items are missing
 */

const fs = require('fs');
const path = require('path');

/**
 * CORE NAVIGATION ITEMS
 * 
 * These navigation items are considered CORE UI and must always be present
 * in the left-hand navigation. Removing any of these requires explicit
 * justification and intentional modification of this validation file.
 * 
 * To add a new core navigation item:
 * 1. Add the route to MainLayout.tsx
 * 2. Add the path and label to this array
 * 
 * To remove a core navigation item:
 * 1. Remove from MainLayout.tsx
 * 2. Remove from this array with a comment explaining why
 */
const CORE_NAVIGATION_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', reason: 'Primary landing page for authenticated users' },
  { path: '/system-intelligence', label: 'System Intelligence', reason: 'Core314 platform promise: continuous system evaluation and understanding' },
  { path: '/integrations', label: 'Integrations', reason: 'User integration management' },
  { path: '/integration-hub', label: 'Integration Hub', reason: 'Integration discovery and connection' },
];

const mainLayoutPath = path.join(__dirname, '..', 'core314-app', 'src', 'components', 'MainLayout.tsx');

function validateCoreNavigation() {
  console.log('='.repeat(70));
  console.log('CORE NAVIGATION VALIDATION');
  console.log('='.repeat(70));
  console.log('');

  if (!fs.existsSync(mainLayoutPath)) {
    console.error('FAIL: MainLayout.tsx not found at expected path');
    console.error(`  Expected: ${mainLayoutPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(mainLayoutPath, 'utf-8');
  const errors = [];
  const passed = [];

  for (const item of CORE_NAVIGATION_ITEMS) {
    // Check for the path in the navigation items
    const pathPattern = new RegExp(`path:\\s*['"]${item.path.replace('/', '\\/')}['"]`);
    const labelPattern = new RegExp(`label:\\s*['"]${item.label}['"]`);

    const hasPath = pathPattern.test(content);
    const hasLabel = labelPattern.test(content);

    if (hasPath && hasLabel) {
      passed.push(item);
      console.log(`  PASS: ${item.label} (${item.path})`);
    } else if (hasPath) {
      errors.push({
        item,
        error: `Path found but label mismatch - expected "${item.label}"`
      });
      console.log(`  FAIL: ${item.label} (${item.path}) - label mismatch`);
    } else {
      errors.push({
        item,
        error: `Navigation item not found in MainLayout.tsx`
      });
      console.log(`  FAIL: ${item.label} (${item.path}) - NOT FOUND`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  if (errors.length === 0) {
    console.log(`\nAll ${CORE_NAVIGATION_ITEMS.length} core navigation items are present.`);
    console.log('\nCore navigation validation PASSED.');
    process.exit(0);
  } else {
    console.log(`\nCore navigation validation FAILED`);
    console.log(`\nMissing or incorrect items (${errors.length}):`);
    for (const { item, error } of errors) {
      console.log(`  - ${item.label} (${item.path})`);
      console.log(`    Reason this is required: ${item.reason}`);
      console.log(`    Error: ${error}`);
    }
    console.log('\nTo fix this:');
    console.log('  1. Add the missing navigation item to MainLayout.tsx');
    console.log('  2. OR if intentionally removing, update scripts/validate-core-navigation.js');
    process.exit(1);
  }
}

validateCoreNavigation();
