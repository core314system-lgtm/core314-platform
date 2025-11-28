/**
 * Environment Variable Validation
 * 
 * This module validates that all required environment variables are present
 * before the application starts. If any required variables are missing,
 * it throws a descriptive error that prevents the app from starting with
 * a blank white screen.
 * 
 * This is a permanent safeguard against the recurring white-screen issue.
 */

interface ValidatedEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const REQUIRED_ENV_VARS = {
  VITE_SUPABASE_URL: 'Supabase project URL',
  VITE_SUPABASE_ANON_KEY: 'Supabase anonymous key',
} as const;

/**
 * Validates that all required environment variables are present and non-empty.
 * 
 * @throws {Error} If any required environment variable is missing or empty
 * @returns {ValidatedEnv} Object containing validated environment variables
 */
export function getValidatedEnv(): ValidatedEnv {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = import.meta.env[key];
    
    if (value === undefined) {
      missing.push(`${key} (${description})`);
    } else if (value === '') {
      empty.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    const errorParts: string[] = [
      '❌ CONFIGURATION ERROR: Missing required environment variables',
      '',
    ];

    if (missing.length > 0) {
      errorParts.push('Missing variables:');
      missing.forEach(v => errorParts.push(`  • ${v}`));
      errorParts.push('');
    }

    if (empty.length > 0) {
      errorParts.push('Empty variables:');
      empty.forEach(v => errorParts.push(`  • ${v}`));
      errorParts.push('');
    }

    errorParts.push(
      'To fix this issue:',
      '1. Go to Netlify dashboard: https://app.netlify.com/sites/core314-admin/configuration/env',
      '2. Add the missing environment variables',
      '3. Trigger a new deployment',
      '',
      'For local development, create a .env file with:',
      '  VITE_SUPABASE_URL=https://your-project.supabase.co',
      '  VITE_SUPABASE_ANON_KEY=your-anon-key',
    );

    throw new Error(errorParts.join('\n'));
  }

  console.info('✅ Environment validation passed:', {
    VITE_SUPABASE_URL: '✓ present',
    VITE_SUPABASE_ANON_KEY: '✓ present',
  });

  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

/**
 * Validates environment variables and logs diagnostic information.
 * This is called early in the application lifecycle to catch configuration
 * errors before React mounts.
 */
export function validateEnv(): void {
  try {
    getValidatedEnv();
  } catch (error) {
    throw error;
  }
}
