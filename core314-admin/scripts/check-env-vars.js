#!/usr/bin/env node

/**
 * Postbuild Environment Variable Check
 * 
 * This script runs after the build completes to verify that all required
 * environment variables were present during the build. If any are missing,
 * the build fails with a clear error message.
 * 
 * This is a permanent safeguard to prevent deploying broken builds.
 */

const REQUIRED_ENV_VARS = {
  VITE_SUPABASE_URL: 'Supabase project URL',
  VITE_SUPABASE_ANON_KEY: 'Supabase anonymous key',
};

console.log('\n🔍 Checking environment variables...\n');

const missing = [];
const empty = [];
const present = [];

for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
  const value = process.env[key];
  
  if (value === undefined) {
    missing.push(`  ❌ ${key} (${description})`);
  } else if (value === '') {
    empty.push(`  ⚠️  ${key} (${description}) - present but empty`);
  } else {
    present.push(`  ✅ ${key} (${description})`);
  }
}

if (present.length > 0) {
  console.log('Present:');
  present.forEach(line => console.log(line));
  console.log('');
}

if (empty.length > 0) {
  console.log('Empty:');
  empty.forEach(line => console.log(line));
  console.log('');
}

if (missing.length > 0) {
  console.log('Missing:');
  missing.forEach(line => console.log(line));
  console.log('');
}

if (missing.length > 0 || empty.length > 0) {
  console.error('❌ BUILD FAILED: Required environment variables are missing or empty\n');
  console.error('To fix this issue:');
  console.error('1. Go to Netlify dashboard: https://app.netlify.com/sites/core314-admin/configuration/env');
  console.error('2. Add the missing/empty environment variables');
  console.error('3. Trigger a new deployment\n');
  console.error('For local development, create a .env file with:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key\n');
  
  process.exit(1);
}

console.log('✅ All required environment variables are present\n');
process.exit(0);
