#!/usr/bin/env node
/**
 * Integration Readiness Validation Script
 * 
 * This script validates that all production-ready integrations meet the required standards:
 * 1. Poll function exists in supabase/functions/{service}-poll/
 * 2. OAuth integrations have required env var patterns defined
 * 3. API key integrations have setup instructions and deep links
 * 4. No integration is marked as production-ready without passing all checks
 * 
 * Run this script in CI to prevent shipping broken integrations.
 * 
 * Usage:
 *   node scripts/validate-integration-readiness.js
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

const fs = require('fs');
const path = require('path');

// Since we can't directly import TypeScript, we'll parse the config file
// and extract the integration definitions

const configPath = path.join(__dirname, '..', 'shared', 'integration-readiness.ts');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Parse the INTEGRATION_READINESS array from the TypeScript file
function parseIntegrationReadiness(content) {
  // Find the INTEGRATION_READINESS array
  const arrayMatch = content.match(/export const INTEGRATION_READINESS[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!arrayMatch) {
    console.error('Could not find INTEGRATION_READINESS array in config file');
    process.exit(1);
  }

  const arrayContent = arrayMatch[1];
  const integrations = [];
  
  // Match each integration object
  const objectRegex = /\{\s*serviceName:\s*['"]([^'"]+)['"],\s*displayName:\s*['"]([^'"]+)['"],\s*connectionType:\s*['"]([^'"]+)['"],\s*pollFunctionName:\s*['"]([^'"]+)['"],\s*isProductionReady:\s*(true|false)/g;
  
  let match;
  while ((match = objectRegex.exec(arrayContent)) !== null) {
    const integration = {
      serviceName: match[1],
      displayName: match[2],
      connectionType: match[3],
      pollFunctionName: match[4],
      isProductionReady: match[5] === 'true'
    };
    
    // Check for oauthConfig
    const afterMatch = arrayContent.slice(match.index);
    const nextBrace = afterMatch.indexOf('},');
    const objectContent = afterMatch.slice(0, nextBrace > 0 ? nextBrace : afterMatch.indexOf('},\n'));
    
    if (objectContent.includes('oauthConfig:')) {
      const envVarPrefixMatch = objectContent.match(/envVarPrefix:\s*['"]([^'"]+)['"]/);
      const requiredEnvVarsMatch = objectContent.match(/requiredEnvVars:\s*\[([^\]]+)\]/);
      
      if (envVarPrefixMatch || requiredEnvVarsMatch) {
        integration.oauthConfig = {
          envVarPrefix: envVarPrefixMatch ? envVarPrefixMatch[1] : null,
          requiredEnvVars: requiredEnvVarsMatch 
            ? requiredEnvVarsMatch[1].match(/['"]([^'"]+)['"]/g)?.map(s => s.replace(/['"]/g, '')) || []
            : []
        };
      }
    }
    
    if (objectContent.includes('apiKeyConfig:')) {
      const deepLinkMatch = objectContent.match(/deepLink:\s*['"]([^'"]+)['"]/);
      const setupInstructionsMatch = objectContent.match(/setupInstructions:\s*\[/);
      const secretFieldsMatch = objectContent.match(/secretFields:\s*\[/);
      
      integration.apiKeyConfig = {
        hasSetupInstructions: !!setupInstructionsMatch,
        hasDeepLink: !!deepLinkMatch,
        hasSecretFields: !!secretFieldsMatch
      };
    }
    
    integrations.push(integration);
  }
  
  return integrations;
}

const integrations = parseIntegrationReadiness(configContent);
const productionReady = integrations.filter(i => i.isProductionReady);
const nonReady = integrations.filter(i => !i.isProductionReady);

function validatePollFunctionsExist() {
  const errors = [];
  const warnings = [];
  const functionsDir = path.join(__dirname, '..', 'core314-app', 'supabase', 'functions');

  for (const integration of productionReady) {
    const pollFunctionPath = path.join(functionsDir, integration.pollFunctionName);
    const indexPath = path.join(pollFunctionPath, 'index.ts');

    if (!fs.existsSync(pollFunctionPath)) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Poll function directory not found: ${integration.pollFunctionName}/`
      );
    } else if (!fs.existsSync(indexPath)) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Poll function index.ts not found: ${integration.pollFunctionName}/index.ts`
      );
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

function validateOAuthConfigurations() {
  const errors = [];
  const warnings = [];

  const oauthIntegrations = productionReady.filter(i => i.connectionType === 'oauth2');

  for (const integration of oauthIntegrations) {
    if (!integration.oauthConfig) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - OAuth2 integration missing oauthConfig`
      );
      continue;
    }

    if (!integration.oauthConfig.envVarPrefix) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - OAuth config missing envVarPrefix`
      );
    }

    if (!integration.oauthConfig.requiredEnvVars || integration.oauthConfig.requiredEnvVars.length === 0) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - OAuth config missing requiredEnvVars`
      );
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

function validateApiKeyConfigurations() {
  const errors = [];
  const warnings = [];

  const apiKeyIntegrations = productionReady.filter(i => i.connectionType === 'api_key');

  for (const integration of apiKeyIntegrations) {
    if (!integration.apiKeyConfig) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - API key integration missing apiKeyConfig`
      );
      continue;
    }

    const config = integration.apiKeyConfig;

    if (!config.hasSetupInstructions) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing setup instructions`
      );
    }

    if (!config.hasDeepLink) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing deep link to provider's key generation page`
      );
    }

    if (!config.hasSecretFields) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing secret field definitions`
      );
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * Slack-specific validation
 * Ensures Slack integration meets Core314 platform promise:
 * - Core314 owns all OAuth configuration
 * - Users never create their own Slack apps
 * - auth.test verification is present in slack-poll
 * - Post-OAuth verification is present in oauth-callback
 */
function validateSlackIntegration() {
  const errors = [];
  const warnings = [];

  const slack = productionReady.find(i => i.serviceName === 'slack');
  
  if (!slack) {
    // Slack not in production-ready list - this is acceptable if intentionally hidden
    warnings.push('Slack integration is not marked as production-ready');
    return { passed: true, errors, warnings };
  }

  // Verify Slack is OAuth2 (not API key - users should never configure anything)
  if (slack.connectionType !== 'oauth2') {
    errors.push(
      'FAIL: Slack must use oauth2 connection type (Core314-owned Slack App)'
    );
  }

  // Verify OAuth config exists
  if (!slack.oauthConfig) {
    errors.push(
      'FAIL: Slack missing oauthConfig - Core314 must own OAuth credentials'
    );
  } else {
    // Verify required env vars are defined
    const requiredVars = ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'];
    for (const envVar of requiredVars) {
      if (!slack.oauthConfig.requiredEnvVars?.includes(envVar)) {
        errors.push(
          `FAIL: Slack oauthConfig missing required env var: ${envVar}`
        );
      }
    }
  }

  // Verify slack-poll function exists
  const functionsDir = path.join(__dirname, '..', 'core314-app', 'supabase', 'functions');
  const pollFunctionPath = path.join(functionsDir, 'slack-poll', 'index.ts');
  if (!fs.existsSync(pollFunctionPath)) {
    errors.push(
      'FAIL: Slack poll function not found at slack-poll/index.ts'
    );
  } else {
    // Verify auth.test verification is present in slack-poll
    const pollContent = fs.readFileSync(pollFunctionPath, 'utf-8');
    if (!pollContent.includes('auth.test')) {
      errors.push(
        'FAIL: slack-poll missing auth.test verification - required for self-healing'
      );
    }
    if (!pollContent.includes('integration_auth_failed')) {
      errors.push(
        'FAIL: slack-poll missing integration_auth_failed event emission'
      );
    }
  }

  // Verify oauth-callback has Slack post-auth verification
  const callbackPath = path.join(functionsDir, 'oauth-callback', 'index.ts');
  if (fs.existsSync(callbackPath)) {
    const callbackContent = fs.readFileSync(callbackPath, 'utf-8');
    if (!callbackContent.includes("'slack'") || !callbackContent.includes('auth.test')) {
      errors.push(
        'FAIL: oauth-callback missing Slack auth.test post-OAuth verification'
      );
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * Salesforce-specific validation
 * Ensures Salesforce integration meets Core314 platform promise:
 * - Core314 owns all OAuth configuration
 * - Users never need to create Connected Apps
 * - No user-side Salesforce setup required
 */
function validateSalesforceIntegration() {
  const errors = [];
  const warnings = [];

  const salesforce = productionReady.find(i => i.serviceName === 'salesforce');
  
  if (!salesforce) {
    // Salesforce not in production-ready list - this is acceptable if intentionally hidden
    warnings.push('Salesforce integration is not marked as production-ready');
    return { passed: true, errors, warnings };
  }

  // Verify Salesforce is OAuth2 (not API key - users should never configure anything)
  if (salesforce.connectionType !== 'oauth2') {
    errors.push(
      'FAIL: Salesforce must use oauth2 connection type (Core314-owned Connected App)'
    );
  }

  // Verify OAuth config exists
  if (!salesforce.oauthConfig) {
    errors.push(
      'FAIL: Salesforce missing oauthConfig - Core314 must own OAuth credentials'
    );
  } else {
    // Verify required env vars are defined
    const requiredVars = ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'];
    for (const envVar of requiredVars) {
      if (!salesforce.oauthConfig.requiredEnvVars?.includes(envVar)) {
        errors.push(
          `FAIL: Salesforce oauthConfig missing required env var: ${envVar}`
        );
      }
    }
  }

  // Verify poll function exists
  const functionsDir = path.join(__dirname, '..', 'core314-app', 'supabase', 'functions');
  const pollFunctionPath = path.join(functionsDir, 'salesforce-poll', 'index.ts');
  if (!fs.existsSync(pollFunctionPath)) {
    errors.push(
      'FAIL: Salesforce poll function not found at salesforce-poll/index.ts'
    );
  }

  return { passed: errors.length === 0, errors, warnings };
}

function main() {
  console.log('='.repeat(70));
  console.log('INTEGRATION READINESS VALIDATION');
  console.log('='.repeat(70));
  console.log('');

  console.log(`Production-ready integrations: ${productionReady.length}`);
  console.log(`Non-production-ready integrations: ${nonReady.length}`);
  console.log('');

  const validations = [
    { name: 'Poll Functions Exist', fn: validatePollFunctionsExist },
    { name: 'OAuth Configurations', fn: validateOAuthConfigurations },
    { name: 'API Key Configurations', fn: validateApiKeyConfigurations },
    { name: 'Slack Integration (Core314 Platform Promise)', fn: validateSlackIntegration },
    { name: 'Salesforce Integration (Core314 Platform Promise)', fn: validateSalesforceIntegration },
  ];

  let allPassed = true;
  const allErrors = [];
  const allWarnings = [];

  for (const validation of validations) {
    console.log(`\n[${validation.name}]`);
    console.log('-'.repeat(50));

    const result = validation.fn();

    if (result.errors.length > 0) {
      allPassed = false;
      allErrors.push(...result.errors);
      for (const error of result.errors) {
        console.log(`  ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      allWarnings.push(...result.warnings);
      for (const warning of result.warnings) {
        console.log(`  ${warning}`);
      }
    }

    if (result.passed && result.warnings.length === 0) {
      console.log('  PASSED');
    } else if (result.passed) {
      console.log(`  PASSED with ${result.warnings.length} warning(s)`);
    } else {
      console.log(`  FAILED with ${result.errors.length} error(s)`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  if (allPassed) {
    console.log('\nAll integration readiness checks PASSED');
    if (allWarnings.length > 0) {
      console.log(`\nWarnings (${allWarnings.length}):`);
      for (const warning of allWarnings) {
        console.log(`  - ${warning}`);
      }
    }
    console.log('\nIntegration Hub is production-ready.');
    process.exit(0);
  } else {
    console.log('\nIntegration readiness checks FAILED');
    console.log(`\nErrors (${allErrors.length}):`);
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }
    if (allWarnings.length > 0) {
      console.log(`\nWarnings (${allWarnings.length}):`);
      for (const warning of allWarnings) {
        console.log(`  - ${warning}`);
      }
    }
    console.log('\nFix the above errors before deploying.');
    process.exit(1);
  }
}

main();
