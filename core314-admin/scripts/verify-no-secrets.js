#!/usr/bin/env node

/**
 * Comprehensive Secret Leakage Prevention Script
 * 
 * This script scans the dist/ directory after build to ensure no sensitive
 * values are embedded in the client-side bundle, including:
 * - Supabase URLs and anon keys
 * - Sentry DSN values
 * - Any other secrets detected by Netlify's secret scanner
 * 
 * If any matches are found, the build will fail to prevent accidental exposure
 * of sensitive configuration values.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Patterns that should NEVER appear in client bundles
const FORBIDDEN_PATTERNS = [
  // Supabase patterns
  /supabase\.co/gi,
  /VITE_SUPABASE_URL/gi,
  /VITE_SUPABASE_ANON_KEY/gi,
  /ygvkegcstaowikessigx/gi, // Supabase project ID
  
  // Sentry patterns
  /ingest\.us\.sentry\.io/gi,
  /ingest\.sentry\.io/gi,
  /VITE_SENTRY_DSN/gi,
  /SENTRY_DSN_ADMIN/gi,
  /SENTRY_DSN_APP/gi,
  /4510388130676736/g,
  /45103881339130880/g,
  /@[a-f0-9]+\.ingest\.[a-z]+\.sentry\.io/gi,
  
  // Generic secret patterns
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT tokens (anon keys look like this)
];

// Patterns to exclude from scanning (false positives)
const EXCLUDE_PATTERNS = [
  /\.netlify\/functions\//gi, // Netlify function paths are OK
  /get-supabase-config/gi, // Function name references are OK
  /get-sentry-config/gi, // Function name references are OK
];

const DIST_DIR = join(__dirname, '..', 'dist');

async function getAllFiles(dir, files = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await getAllFiles(fullPath, files);
      } else if (entry.isFile() && /\.(js|html|css|json)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  return files;
}

function isExcluded(match) {
  for (const pattern of EXCLUDE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(match)) {
      return true;
    }
  }
  return false;
}

async function scanFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const violations = [];
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern);
    if (matches) {
      // Filter out excluded patterns
      const filteredMatches = matches.filter(m => !isExcluded(m));
      if (filteredMatches.length > 0) {
        violations.push({
          pattern: pattern.toString(),
          matches: filteredMatches.slice(0, 3),
          count: filteredMatches.length,
        });
      }
    }
  }
  
  return violations;
}

async function main() {
  console.log('Scanning dist/ for secret leakage...\n');
  console.log('Checking for: Supabase URLs, Sentry DSNs, JWT tokens, and other secrets\n');
  
  const files = await getAllFiles(DIST_DIR);
  
  if (files.length === 0) {
    console.log('No files found in dist/ directory. Skipping scan.');
    process.exit(0);
  }
  
  let hasViolations = false;
  const results = [];
  
  for (const file of files) {
    const violations = await scanFile(file);
    if (violations.length > 0) {
      hasViolations = true;
      results.push({ file, violations });
    }
  }
  
  if (hasViolations) {
    console.error('SECRET LEAKAGE DETECTED!\n');
    console.error('The following files contain forbidden patterns:\n');
    
    for (const { file, violations } of results) {
      const relativePath = file.replace(DIST_DIR, 'dist');
      console.error(`  ${relativePath}:`);
      for (const v of violations) {
        console.error(`    - Pattern: ${v.pattern}`);
        console.error(`      Found ${v.count} match(es): ${v.matches.join(', ')}`);
      }
      console.error('');
    }
    
    console.error('BUILD FAILED: Secrets must not be embedded in client bundles.');
    console.error('Ensure all sensitive values are fetched at runtime via Netlify Functions.');
    process.exit(1);
  }
  
  console.log(`Scanned ${files.length} files. No secret leakage detected.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Error during secret scan:', error);
  process.exit(1);
});
