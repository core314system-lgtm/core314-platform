#!/usr/bin/env node

/**
 * Comprehensive Secret Leakage Prevention Script
 * 
 * This script scans the dist/ directory after build to ensure no sensitive
 * values are embedded in the client-side bundle.
 * 
 * IMPORTANT: Supabase public identifiers (project URL, project ref, anon key)
 * are NOT secrets - they are designed to be client-side. This script uses an
 * allowlist to permit these public values while still blocking real secrets
 * like service_role keys.
 * 
 * If any real secret matches are found, the build will fail to prevent
 * accidental exposure of sensitive configuration values.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === ALLOWLIST FOR PUBLIC SUPABASE IDENTIFIERS ===
// These are NOT secrets - Supabase anon key and project URL are designed for client-side use
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Extract project ref from URL (e.g., "ygvkegcstaowikessigx" from "https://ygvkegcstaowikessigx.supabase.co")
function getSupabaseProjectRef(url) {
  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split('.')[0];
    return ref;
  } catch {
    return '';
  }
}

const SUPABASE_PROJECT_REF = getSupabaseProjectRef(SUPABASE_URL);

// Build allowlist of public Supabase values that are OK in client bundles
const SUPABASE_ALLOWLIST = new Set(
  [
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_PROJECT_REF,
    // Also allow the hostname without protocol
    SUPABASE_URL ? new URL(SUPABASE_URL).hostname : '',
  ].filter(Boolean)
);

// Helper to check if a JWT is a service_role key (NEVER allowed in client)
function isServiceRoleKey(jwt) {
  try {
    // JWT format: header.payload.signature
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload (base64url)
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    
    // Check if this is a service_role key
    return decoded.role === 'service_role';
  } catch {
    return false;
  }
}

// Patterns that should NEVER appear in client bundles
const FORBIDDEN_PATTERNS = [
  // Env var names should not leak (indicates build misconfiguration)
  /VITE_SUPABASE_URL/gi,
  /VITE_SUPABASE_ANON_KEY/gi,
  
  // Sentry patterns (if Sentry DSN should be secret - can be allowlisted similarly if needed)
  /ingest\.us\.sentry\.io/gi,
  /ingest\.sentry\.io/gi,
  /VITE_SENTRY_DSN/gi,
  /SENTRY_DSN_ADMIN/gi,
  /SENTRY_DSN_APP/gi,
  /4510388130676736/g,
  /45103881339130880/g,
  /@[a-f0-9]+\.ingest\.[a-z]+\.sentry\.io/gi,
  
  // Generic secret patterns - JWTs are checked separately with service_role detection
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
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

// Check if a match is in the Supabase allowlist (public identifiers)
function isAllowlisted(match) {
  // Direct match in allowlist
  if (SUPABASE_ALLOWLIST.has(match)) {
    return true;
  }
  
  // Check if match is contained within any allowlisted value
  for (const allowed of SUPABASE_ALLOWLIST) {
    if (allowed && match.includes(allowed)) {
      return true;
    }
    if (allowed && allowed.includes(match)) {
      return true;
    }
  }
  
  return false;
}

// Check if a JWT match should be flagged as a violation
function isJwtViolation(jwt) {
  // If it's the known public anon key, it's allowed
  if (SUPABASE_ANON_KEY && jwt === SUPABASE_ANON_KEY) {
    return false;
  }
  
  // If it's a service_role key, it's ALWAYS a violation
  if (isServiceRoleKey(jwt)) {
    return true;
  }
  
  // For other JWTs, check if they're in the allowlist
  if (isAllowlisted(jwt)) {
    return false;
  }
  
  // Unknown JWTs are violations (conservative approach)
  return true;
}

async function scanFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const violations = [];
  
  // JWT pattern for special handling
  const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    const patternStr = pattern.toString();
    const isJwtPattern = patternStr.includes('eyJ');
    
    const matches = content.match(pattern);
    if (matches) {
      // Filter out excluded patterns and allowlisted values
      const filteredMatches = matches.filter(m => {
        // Skip if excluded by pattern
        if (isExcluded(m)) return false;
        
        // For JWT patterns, use special handling
        if (isJwtPattern) {
          return isJwtViolation(m);
        }
        
        // For other patterns, check allowlist
        return !isAllowlisted(m);
      });
      
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
  console.log('Checking for: service_role keys, Sentry DSNs, unknown JWTs, and other secrets');
  console.log('Allowlisted (public): Supabase URL, project ref, and anon key\n');
  
  // Log allowlist status for debugging
  if (SUPABASE_URL) {
    console.log(`Supabase URL allowlisted: ${SUPABASE_URL}`);
  }
  if (SUPABASE_PROJECT_REF) {
    console.log(`Supabase project ref allowlisted: ${SUPABASE_PROJECT_REF}`);
  }
  if (SUPABASE_ANON_KEY) {
    console.log(`Supabase anon key allowlisted: [${SUPABASE_ANON_KEY.substring(0, 20)}...]`);
  }
  console.log('');
  
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
