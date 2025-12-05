#!/usr/bin/env node

/**
 * DSN Leak Prevention Script
 * Scans dist/ directory for any Sentry DSN references
 * Fails build if any secrets are found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DIST_DIR = './dist';

const FORBIDDEN_PATTERNS = [
  /ingest\.us\.sentry\.io/i,
  /ingest\.sentry\.io/i,
  /VITE_SENTRY_DSN/i,
  /SENTRY_DSN_ADMIN/i,
  /SENTRY_DSN_APP/i,
  /62eca88f3df7b10a1a367cc61130025b/i, // Specific DSN key
  /4510388130676736/i, // Sentry project ID
  /45103881339130880/i, // Sentry project ID
];

let foundLeaks = false;
const leaks = [];

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        const matches = content.match(new RegExp(pattern, 'gi'));
        leaks.push({
          file: filePath,
          pattern: pattern.source,
          matchCount: matches ? matches.length : 0
        });
        foundLeaks = true;
      }
    }
  } catch (error) {
  }
}

function scanDirectory(dir) {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
}

console.log('🔍 Scanning dist/ for DSN leaks...\n');

try {
  scanDirectory(DIST_DIR);
  
  if (foundLeaks) {
    console.error('❌ DSN LEAK DETECTED!\n');
    console.error('The following files contain forbidden patterns:\n');
    
    for (const leak of leaks) {
      console.error(`  File: ${leak.file}`);
      console.error(`  Pattern: ${leak.pattern}`);
      console.error(`  Matches: ${leak.matchCount}\n`);
    }
    
    console.error('Build FAILED: Secrets detected in dist/');
    console.error('This prevents Netlify deployment due to secret scanner.');
    console.error('\nTo fix:');
    console.error('1. Remove all import.meta.env references to DSN');
    console.error('2. Fetch DSN at runtime from Netlify Function');
    console.error('3. Disable source maps if they contain DSN references');
    
    process.exit(1);
  } else {
    console.log('✅ No DSN leaks detected in dist/');
    console.log('Build artifacts are clean and safe for deployment.\n');
    process.exit(0);
  }
} catch (error) {
  console.error('Error during scan:', error.message);
  process.exit(1);
}
