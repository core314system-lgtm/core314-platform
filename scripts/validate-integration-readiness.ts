#!/usr/bin/env npx ts-node
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
 *   npx ts-node scripts/validate-integration-readiness.ts
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import * as fs from 'fs';
import * as path from 'path';

// Import the readiness configuration
// Note: We use require for compatibility with ts-node
const {
  INTEGRATION_READINESS,
  validateIntegrationReadiness,
  getProductionReadyIntegrations,
  getNonProductionReadyIntegrations,
} = require('../shared/integration-readiness');

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

function validatePollFunctionsExist(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const functionsDir = path.join(__dirname, '..', 'core314-app', 'supabase', 'functions');

  const productionReady = getProductionReadyIntegrations();

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

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateOAuthConfigurations(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const productionReady = getProductionReadyIntegrations();
  const oauthIntegrations = productionReady.filter(
    (i: any) => i.connectionType === 'oauth2'
  );

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

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateApiKeyConfigurations(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const productionReady = getProductionReadyIntegrations();
  const apiKeyIntegrations = productionReady.filter(
    (i: any) => i.connectionType === 'api_key'
  );

  for (const integration of apiKeyIntegrations) {
    if (!integration.apiKeyConfig) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - API key integration missing apiKeyConfig`
      );
      continue;
    }

    const config = integration.apiKeyConfig;

    if (!config.setupInstructions || config.setupInstructions.length === 0) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing setup instructions`
      );
    }

    if (!config.deepLink) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing deep link to provider's key generation page`
      );
    }

    if (!config.deepLinkLabel) {
      warnings.push(
        `WARN: ${integration.displayName} (${integration.serviceName}) - Missing deep link label`
      );
    }

    if (!config.secretFields || config.secretFields.length === 0) {
      errors.push(
        `FAIL: ${integration.displayName} (${integration.serviceName}) - Missing secret field definitions`
      );
    } else {
      for (const field of config.secretFields) {
        if (!field.name || !field.label) {
          errors.push(
            `FAIL: ${integration.displayName} (${integration.serviceName}) - Secret field missing name or label`
          );
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateReadinessConfig(): ValidationResult {
  const errors = validateIntegrationReadiness();
  return {
    passed: errors.length === 0,
    errors: errors.map((e: string) => `FAIL: ${e}`),
    warnings: [],
  };
}

function validateNoHiddenProductionReady(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that non-production-ready integrations have a reason documented
  const nonReady = getNonProductionReadyIntegrations();
  for (const integration of nonReady) {
    if (!integration.readinessNotes) {
      warnings.push(
        `WARN: ${integration.displayName} (${integration.serviceName}) - Non-production-ready but missing readinessNotes explaining why`
      );
    }
  }

  return {
    passed: true,
    errors,
    warnings,
  };
}

function main(): void {
  console.log('='.repeat(70));
  console.log('INTEGRATION READINESS VALIDATION');
  console.log('='.repeat(70));
  console.log('');

  const productionReady = getProductionReadyIntegrations();
  const nonReady = getNonProductionReadyIntegrations();

  console.log(`Production-ready integrations: ${productionReady.length}`);
  console.log(`Non-production-ready integrations: ${nonReady.length}`);
  console.log('');

  const validations = [
    { name: 'Poll Functions Exist', fn: validatePollFunctionsExist },
    { name: 'OAuth Configurations', fn: validateOAuthConfigurations },
    { name: 'API Key Configurations', fn: validateApiKeyConfigurations },
    { name: 'Readiness Config Integrity', fn: validateReadinessConfig },
    { name: 'Documentation Check', fn: validateNoHiddenProductionReady },
  ];

  let allPassed = true;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

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
