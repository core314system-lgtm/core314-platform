#!/usr/bin/env node

/**
 * DSN Leakage Prevention Script
 * 
 * This script scans the dist/ directory after build to ensure no Sentry DSN
 * values or related sensitive patterns are embedded in the client-side bundle.
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

const FORBIDDEN_PATTERNS = [
  /ingest\.us\.sentry\.io/gi,
  /ingest\.sentry\.io/gi,
  /VITE_SENTRY_DSN/gi,
  /SENTRY_DSN_ADMIN/gi,
  /SENTRY_DSN_APP/gi,
  /4510388130676736/g,
  /45103881339130880/g,
  /@[a-f0-9]+\.ingest\.[a-z]+\.sentry\.io/gi,
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

async function scanFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const violations = [];
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern);
    if (matches) {
      violations.push({
        pattern: pattern.toString(),
        matches: matches.slice(0, 3),
        count: matches.length,
      });
    }
  }
  
  return violations;
}

async function main() {
  console.log('Scanning dist/ for DSN leakage...\n');
  
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
    console.error('DSN LEAKAGE DETECTED!\n');
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
    
    console.error('BUILD FAILED: DSN values must not be embedded in client bundles.');
    console.error('Ensure all Sentry DSN values are fetched at runtime via Netlify Functions.');
    process.exit(1);
  }
  
  console.log(`Scanned ${files.length} files. No DSN leakage detected.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Error during DSN scan:', error);
  process.exit(1);
});
