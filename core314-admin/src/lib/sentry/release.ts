/**
 * Release tracking utilities
 * Generates release strings from package.json version + commit hash
 */

import packageJson from '../../../package.json';

/**
 * Get the release string for Sentry
 * Format: core314-admin-app@{version}+{commit}
 */
export function getRelease(): string {
  const version = packageJson.version || '0.0.0';
  const commit = import.meta.env.VITE_COMMIT_REF || 'unknown';
  
  return `core314-admin-app@${version}+${commit}`;
}

/**
 * Get the build ID from Netlify
 */
export function getBuildId(): string {
  return import.meta.env.VITE_DEPLOY_ID || 'local';
}

/**
 * Get the environment from Netlify context
 * Maps Netlify CONTEXT to Sentry environment
 */
export function getEnvironment(): string {
  const context = import.meta.env.VITE_CONTEXT || import.meta.env.MODE;
  
  switch (context) {
    case 'production':
      return 'production';
    case 'deploy-preview':
      return 'staging';
    case 'branch-deploy':
      return 'dev';
    default:
      return import.meta.env.SENTRY_ENVIRONMENT || 'beta-test';
  }
}
