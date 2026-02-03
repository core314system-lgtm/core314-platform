/**
 * Integration Readiness Configuration
 * 
 * This file is the SINGLE SOURCE OF TRUTH for integration production readiness.
 * An integration MUST pass ALL readiness checks to be visible in the Integration Hub.
 * 
 * Readiness Checks:
 * 1. auth_config_present - OAuth credentials env vars are defined (for OAuth integrations)
 * 2. poll_function_exists - A poll function exists for data ingestion
 * 3. poll_verified - The poll function has been verified to work with real data
 * 
 * This configuration is used by:
 * - Frontend (IntegrationHub.tsx) to filter visible integrations
 * - CI (scripts/validate-integration-readiness.ts) to fail builds with incomplete integrations
 */

export type ConnectionType = 'oauth2' | 'api_key' | 'manual' | 'observational';

export interface OAuthConfig {
  envVarPrefix: string;
  requiredEnvVars: string[];
}

export interface ApiKeyConfig {
  setupInstructions: string[];
  deepLink: string;
  deepLinkLabel: string;
  secretFields: { name: string; label: string; placeholder: string }[];
}

export interface IntegrationReadinessConfig {
  serviceName: string;
  displayName: string;
  connectionType: ConnectionType;
  pollFunctionName: string;
  isProductionReady: boolean;
  oauthConfig?: OAuthConfig;
  apiKeyConfig?: ApiKeyConfig;
  readinessNotes?: string;
}

/**
 * Production-ready integrations configuration
 * 
 * IMPORTANT: Only add an integration here if:
 * 1. The poll function exists and has been tested
 * 2. OAuth credentials are configured (for OAuth integrations)
 * 3. The integration has been verified end-to-end
 */
export const INTEGRATION_READINESS: IntegrationReadinessConfig[] = [
  // ============================================================
  // WAVE 0 - Core Communication (OAuth2)
  // ============================================================
  {
    serviceName: 'microsoft_teams',
    displayName: 'Microsoft Teams',
    connectionType: 'oauth2',
    pollFunctionName: 'teams-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'TEAMS',
      requiredEnvVars: ['TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET'],
    },
  },
  {
    serviceName: 'zoom',
    displayName: 'Zoom',
    connectionType: 'oauth2',
    pollFunctionName: 'zoom-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'ZOOM',
      requiredEnvVars: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
    },
  },
  {
    serviceName: 'google_calendar',
    displayName: 'Google Calendar',
    connectionType: 'oauth2',
    pollFunctionName: 'gcal-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'GOOGLE',
      requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
  },
  {
    serviceName: 'google_meet',
    displayName: 'Google Meet',
    connectionType: 'oauth2',
    pollFunctionName: 'gmeet-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'GOOGLE',
      requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
  },

  // ============================================================
  // WAVE 1 - Project Management (API Key)
  // ============================================================
  {
    serviceName: 'jira',
    displayName: 'Jira',
    connectionType: 'api_key',
    pollFunctionName: 'jira-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Atlassian account at atlassian.net',
        'Click your profile icon in the top-right corner',
        'Select "Account settings" from the dropdown',
        'Navigate to "Security" in the left sidebar',
        'Under "API tokens", click "Create and manage API tokens"',
        'Click "Create API token" and give it a descriptive name',
        'Copy the generated token immediately (it won\'t be shown again)',
      ],
      deepLink: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      deepLinkLabel: 'Open Atlassian API Tokens',
      secretFields: [
        { name: 'api_key', label: 'API Token', placeholder: 'Enter your Jira API token' },
        { name: 'email', label: 'Email', placeholder: 'Enter your Atlassian email' },
        { name: 'domain', label: 'Jira Domain', placeholder: 'your-domain.atlassian.net' },
      ],
    },
  },
  {
    serviceName: 'asana',
    displayName: 'Asana',
    connectionType: 'api_key',
    pollFunctionName: 'asana-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Asana account',
        'Click your profile photo in the top-right corner',
        'Select "My Settings" from the dropdown',
        'Navigate to the "Apps" tab',
        'Scroll down to "Personal Access Tokens"',
        'Click "Create new token"',
        'Give your token a descriptive name and click "Create token"',
        'Copy the token immediately (it won\'t be shown again)',
      ],
      deepLink: 'https://app.asana.com/0/my-apps',
      deepLinkLabel: 'Open Asana Developer Console',
      secretFields: [
        { name: 'api_key', label: 'Personal Access Token', placeholder: 'Enter your Asana access token' },
      ],
    },
  },
  {
    serviceName: 'github',
    displayName: 'GitHub',
    connectionType: 'api_key',
    pollFunctionName: 'github-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your GitHub account',
        'Click your profile photo in the top-right corner',
        'Select "Settings" from the dropdown',
        'Scroll down and click "Developer settings" in the left sidebar',
        'Click "Personal access tokens" then "Tokens (classic)"',
        'Click "Generate new token" and select "Generate new token (classic)"',
        'Give your token a descriptive name',
        'Select scopes: repo, read:org, read:user',
        'Click "Generate token" and copy it immediately',
      ],
      deepLink: 'https://github.com/settings/tokens',
      deepLinkLabel: 'Open GitHub Token Settings',
      secretFields: [
        { name: 'api_key', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxx' },
      ],
    },
  },

  // ============================================================
  // WAVE 2 - Support & Documentation (API Key)
  // ============================================================
  {
    serviceName: 'zendesk',
    displayName: 'Zendesk',
    connectionType: 'api_key',
    pollFunctionName: 'zendesk-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Zendesk Admin Center',
        'Click the "Apps and integrations" icon in the sidebar',
        'Select "APIs" then "Zendesk API"',
        'Click the "Settings" tab',
        'Enable "Token Access" if not already enabled',
        'Click "Add API token"',
        'Enter a description and click "Create"',
        'Copy the token immediately',
      ],
      deepLink: 'https://your-subdomain.zendesk.com/admin/apps-integrations/apis/zendesk-api/settings',
      deepLinkLabel: 'Open Zendesk API Settings',
      secretFields: [
        { name: 'api_key', label: 'API Token', placeholder: 'Enter your Zendesk API token' },
        { name: 'email', label: 'Email', placeholder: 'Enter your Zendesk email' },
        { name: 'subdomain', label: 'Subdomain', placeholder: 'your-subdomain' },
      ],
    },
  },
  {
    serviceName: 'notion',
    displayName: 'Notion',
    connectionType: 'api_key',
    pollFunctionName: 'notion-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Go to notion.so/my-integrations',
        'Click "New integration"',
        'Give your integration a name (e.g., "Core314")',
        'Select the workspace you want to connect',
        'Click "Submit" to create the integration',
        'Copy the "Internal Integration Token"',
        'Important: Share the pages/databases you want to analyze with this integration',
      ],
      deepLink: 'https://www.notion.so/my-integrations',
      deepLinkLabel: 'Open Notion Integrations',
      secretFields: [
        { name: 'api_key', label: 'Internal Integration Token', placeholder: 'secret_xxxxxxxxxxxx' },
      ],
    },
  },
  {
    serviceName: 'trello',
    displayName: 'Trello',
    connectionType: 'api_key',
    pollFunctionName: 'trello-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Go to trello.com/power-ups/admin',
        'Click "New" to create a new Power-Up',
        'Fill in the required fields and click "Create"',
        'Navigate to the "API Key" section',
        'Copy your API Key',
        'Click "Token" link to generate a token',
        'Authorize the app and copy the token',
      ],
      deepLink: 'https://trello.com/power-ups/admin',
      deepLinkLabel: 'Open Trello Power-Ups Admin',
      secretFields: [
        { name: 'api_key', label: 'API Key', placeholder: 'Enter your Trello API key' },
        { name: 'token', label: 'Token', placeholder: 'Enter your Trello token' },
      ],
    },
  },

  // ============================================================
  // WAVE 3A - Additional Project Management (API Key)
  // ============================================================
  {
    serviceName: 'intercom',
    displayName: 'Intercom',
    connectionType: 'api_key',
    pollFunctionName: 'intercom-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Intercom workspace',
        'Click the gear icon to open Settings',
        'Navigate to "Integrations" then "Developer Hub"',
        'Click "New app" or select an existing app',
        'Go to "Authentication" section',
        'Copy your Access Token',
      ],
      deepLink: 'https://app.intercom.com/a/apps/_/developer-hub',
      deepLinkLabel: 'Open Intercom Developer Hub',
      secretFields: [
        { name: 'api_key', label: 'Access Token', placeholder: 'Enter your Intercom access token' },
      ],
    },
  },
  {
    serviceName: 'discord',
    displayName: 'Discord',
    connectionType: 'api_key',
    pollFunctionName: 'discord-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Go to discord.com/developers/applications',
        'Click "New Application" and give it a name',
        'Navigate to the "Bot" section in the left sidebar',
        'Click "Add Bot" if you haven\'t already',
        'Under "Token", click "Reset Token" to generate a new token',
        'Copy the token immediately',
        'Enable required intents under "Privileged Gateway Intents"',
      ],
      deepLink: 'https://discord.com/developers/applications',
      deepLinkLabel: 'Open Discord Developer Portal',
      secretFields: [
        { name: 'api_key', label: 'Bot Token', placeholder: 'Enter your Discord bot token' },
        { name: 'guild_id', label: 'Server ID', placeholder: 'Enter your Discord server ID' },
      ],
    },
  },
  {
    serviceName: 'linear',
    displayName: 'Linear',
    connectionType: 'api_key',
    pollFunctionName: 'linear-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Linear workspace',
        'Click your profile icon in the bottom-left',
        'Select "Settings"',
        'Navigate to "API" in the left sidebar',
        'Click "Create key"',
        'Give your key a label and click "Create key"',
        'Copy the key immediately',
      ],
      deepLink: 'https://linear.app/settings/api',
      deepLinkLabel: 'Open Linear API Settings',
      secretFields: [
        { name: 'api_key', label: 'API Key', placeholder: 'lin_api_xxxxxxxxxxxx' },
      ],
    },
  },
  {
    serviceName: 'monday',
    displayName: 'Monday.com',
    connectionType: 'api_key',
    pollFunctionName: 'monday-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Monday.com account',
        'Click your profile picture in the bottom-left',
        'Select "Developers"',
        'Click "My Access Tokens" in the left sidebar',
        'Click "Show" next to your token or create a new one',
        'Copy the API token',
      ],
      deepLink: 'https://your-domain.monday.com/apps/manage/tokens',
      deepLinkLabel: 'Open Monday.com Developer Settings',
      secretFields: [
        { name: 'api_key', label: 'API Token', placeholder: 'Enter your Monday.com API token' },
      ],
    },
  },
  {
    serviceName: 'clickup',
    displayName: 'ClickUp',
    connectionType: 'api_key',
    pollFunctionName: 'clickup-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your ClickUp workspace',
        'Click your avatar in the bottom-left corner',
        'Select "Settings"',
        'Navigate to "Apps" in the left sidebar',
        'Click "Generate" under API Token',
        'Copy the generated token',
      ],
      deepLink: 'https://app.clickup.com/settings/apps',
      deepLinkLabel: 'Open ClickUp Apps Settings',
      secretFields: [
        { name: 'api_key', label: 'API Token', placeholder: 'pk_xxxxxxxxxxxx' },
      ],
    },
  },
  {
    serviceName: 'basecamp',
    displayName: 'Basecamp',
    connectionType: 'api_key',
    pollFunctionName: 'basecamp-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Basecamp account',
        'Go to launchpad.37signals.com/integrations',
        'Click "Register an application"',
        'Fill in the application details',
        'Copy your Client ID and Client Secret',
      ],
      deepLink: 'https://launchpad.37signals.com/integrations',
      deepLinkLabel: 'Open Basecamp Integrations',
      secretFields: [
        { name: 'api_key', label: 'Access Token', placeholder: 'Enter your Basecamp access token' },
        { name: 'account_id', label: 'Account ID', placeholder: 'Enter your Basecamp account ID' },
      ],
    },
  },

  // ============================================================
  // WAVE 3B - Development & Design (API Key)
  // ============================================================
  {
    serviceName: 'gitlab',
    displayName: 'GitLab',
    connectionType: 'api_key',
    pollFunctionName: 'gitlab-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your GitLab account',
        'Click your avatar in the top-right corner',
        'Select "Preferences"',
        'Navigate to "Access Tokens" in the left sidebar',
        'Click "Add new token"',
        'Give your token a name and select scopes: read_api, read_user, read_repository',
        'Click "Create personal access token"',
        'Copy the token immediately',
      ],
      deepLink: 'https://gitlab.com/-/profile/personal_access_tokens',
      deepLinkLabel: 'Open GitLab Access Tokens',
      secretFields: [
        { name: 'api_key', label: 'Personal Access Token', placeholder: 'glpat-xxxxxxxxxxxx' },
      ],
    },
  },
  {
    serviceName: 'bitbucket',
    displayName: 'Bitbucket',
    connectionType: 'api_key',
    pollFunctionName: 'bitbucket-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Bitbucket account',
        'Click your avatar in the bottom-left corner',
        'Select "Personal settings"',
        'Navigate to "App passwords" under "Access management"',
        'Click "Create app password"',
        'Give it a label and select permissions: Repositories (Read), Account (Read)',
        'Click "Create" and copy the password',
      ],
      deepLink: 'https://bitbucket.org/account/settings/app-passwords/',
      deepLinkLabel: 'Open Bitbucket App Passwords',
      secretFields: [
        { name: 'api_key', label: 'App Password', placeholder: 'Enter your Bitbucket app password' },
        { name: 'username', label: 'Username', placeholder: 'Enter your Bitbucket username' },
      ],
    },
  },
  {
    serviceName: 'confluence',
    displayName: 'Confluence',
    connectionType: 'api_key',
    pollFunctionName: 'confluence-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Atlassian account at atlassian.net',
        'Click your profile icon in the top-right corner',
        'Select "Account settings" from the dropdown',
        'Navigate to "Security" in the left sidebar',
        'Under "API tokens", click "Create and manage API tokens"',
        'Click "Create API token" and give it a descriptive name',
        'Copy the generated token immediately',
      ],
      deepLink: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      deepLinkLabel: 'Open Atlassian API Tokens',
      secretFields: [
        { name: 'api_key', label: 'API Token', placeholder: 'Enter your Confluence API token' },
        { name: 'email', label: 'Email', placeholder: 'Enter your Atlassian email' },
        { name: 'domain', label: 'Confluence Domain', placeholder: 'your-domain.atlassian.net' },
      ],
    },
  },
  {
    serviceName: 'freshdesk',
    displayName: 'Freshdesk',
    connectionType: 'api_key',
    pollFunctionName: 'freshdesk-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Freshdesk account',
        'Click your profile picture in the top-right corner',
        'Select "Profile settings"',
        'Your API Key is displayed on the right side of the page',
        'Click "View API Key" to reveal it',
        'Copy the API key',
      ],
      deepLink: 'https://your-domain.freshdesk.com/a/admin/profile',
      deepLinkLabel: 'Open Freshdesk Profile Settings',
      secretFields: [
        { name: 'api_key', label: 'API Key', placeholder: 'Enter your Freshdesk API key' },
        { name: 'domain', label: 'Freshdesk Domain', placeholder: 'your-domain.freshdesk.com' },
      ],
    },
  },
  {
    serviceName: 'planner',
    displayName: 'Microsoft Planner',
    connectionType: 'oauth2',
    pollFunctionName: 'planner-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'TEAMS',
      requiredEnvVars: ['TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET'],
    },
  },
  {
    serviceName: 'servicenow',
    displayName: 'ServiceNow',
    connectionType: 'api_key',
    pollFunctionName: 'servicenow-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your ServiceNow instance as an admin',
        'Navigate to System OAuth > Application Registry',
        'Click "New" to create a new OAuth application',
        'Select "Create an OAuth API endpoint for external clients"',
        'Fill in the required fields and save',
        'Note your Client ID and Client Secret',
        'Alternatively, use basic auth with your username and password',
      ],
      deepLink: 'https://your-instance.service-now.com/nav_to.do?uri=%2Foauth_entity_list.do',
      deepLinkLabel: 'Open ServiceNow OAuth Registry',
      secretFields: [
        { name: 'api_key', label: 'Password or OAuth Token', placeholder: 'Enter your ServiceNow credentials' },
        { name: 'username', label: 'Username', placeholder: 'Enter your ServiceNow username' },
        { name: 'instance', label: 'Instance URL', placeholder: 'your-instance.service-now.com' },
      ],
    },
  },
  {
    serviceName: 'airtable',
    displayName: 'Airtable',
    connectionType: 'api_key',
    pollFunctionName: 'airtable-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Airtable account',
        'Go to airtable.com/create/tokens',
        'Click "Create new token"',
        'Give your token a name',
        'Add scopes: data.records:read, schema.bases:read',
        'Add access to the bases you want to connect',
        'Click "Create token" and copy it immediately',
      ],
      deepLink: 'https://airtable.com/create/tokens',
      deepLinkLabel: 'Open Airtable Token Creator',
      secretFields: [
        { name: 'api_key', label: 'Personal Access Token', placeholder: 'pat.xxxxxxxxxxxx' },
      ],
    },
  },
  {
    serviceName: 'smartsheet',
    displayName: 'Smartsheet',
    connectionType: 'api_key',
    pollFunctionName: 'smartsheet-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Smartsheet account',
        'Click your profile icon in the top-right corner',
        'Select "Personal Settings"',
        'Navigate to "API Access" in the left sidebar',
        'Click "Generate new access token"',
        'Give your token a name and click "OK"',
        'Copy the token immediately',
      ],
      deepLink: 'https://app.smartsheet.com/b/home?lx=pneu-PdYPVYgJDqBDlbyKg',
      deepLinkLabel: 'Open Smartsheet Settings',
      secretFields: [
        { name: 'api_key', label: 'Access Token', placeholder: 'Enter your Smartsheet access token' },
      ],
    },
  },
  {
    serviceName: 'miro',
    displayName: 'Miro',
    connectionType: 'api_key',
    pollFunctionName: 'miro-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Miro account',
        'Go to miro.com/app/settings/user-profile',
        'Navigate to "Your apps" section',
        'Click "Create new app"',
        'Fill in the app details and permissions',
        'After creating, go to the app settings',
        'Copy the Access Token',
      ],
      deepLink: 'https://miro.com/app/settings/user-profile/',
      deepLinkLabel: 'Open Miro Settings',
      secretFields: [
        { name: 'api_key', label: 'Access Token', placeholder: 'Enter your Miro access token' },
      ],
    },
  },
  {
    serviceName: 'figma',
    displayName: 'Figma',
    connectionType: 'api_key',
    pollFunctionName: 'figma-poll',
    isProductionReady: true,
    apiKeyConfig: {
      setupInstructions: [
        'Log in to your Figma account',
        'Click your profile icon in the top-right corner',
        'Select "Settings"',
        'Scroll down to "Personal access tokens"',
        'Click "Generate new token"',
        'Give your token a description',
        'Copy the token immediately (it won\'t be shown again)',
      ],
      deepLink: 'https://www.figma.com/settings',
      deepLinkLabel: 'Open Figma Settings',
      secretFields: [
        { name: 'api_key', label: 'Personal Access Token', placeholder: 'figd_xxxxxxxxxxxx' },
      ],
    },
  },

  // ============================================================
  // FINANCIAL OPERATIONS (OAuth2)
  // ============================================================
  {
    serviceName: 'quickbooks',
    displayName: 'QuickBooks Online',
    connectionType: 'oauth2',
    pollFunctionName: 'quickbooks-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'QUICKBOOKS',
      requiredEnvVars: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
    },
  },
  {
    serviceName: 'xero',
    displayName: 'Xero',
    connectionType: 'oauth2',
    pollFunctionName: 'xero-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'XERO',
      requiredEnvVars: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'],
    },
  },

  // ============================================================
  // CRM (OAuth2)
  // ============================================================
  {
    serviceName: 'salesforce',
    displayName: 'Salesforce',
    connectionType: 'oauth2',
    pollFunctionName: 'salesforce-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'SALESFORCE',
      requiredEnvVars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
    },
  },

  // ============================================================
  // Communication (OAuth2)
  // ============================================================
  {
    serviceName: 'slack',
    displayName: 'Slack',
    connectionType: 'oauth2',
    pollFunctionName: 'slack-poll',
    isProductionReady: true,
    oauthConfig: {
      envVarPrefix: 'SLACK',
      requiredEnvVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
    },
  },
];

/**
 * Get all production-ready integrations
 */
export function getProductionReadyIntegrations(): IntegrationReadinessConfig[] {
  return INTEGRATION_READINESS.filter(i => i.isProductionReady);
}

/**
 * Get all integrations that are NOT production-ready
 */
export function getNonProductionReadyIntegrations(): IntegrationReadinessConfig[] {
  return INTEGRATION_READINESS.filter(i => !i.isProductionReady);
}

/**
 * Check if a specific integration is production-ready
 */
export function isIntegrationProductionReady(serviceName: string): boolean {
  const integration = INTEGRATION_READINESS.find(
    i => i.serviceName.toLowerCase() === serviceName.toLowerCase()
  );
  return integration?.isProductionReady ?? false;
}

/**
 * Get readiness config for a specific integration
 */
export function getIntegrationReadinessConfig(serviceName: string): IntegrationReadinessConfig | undefined {
  return INTEGRATION_READINESS.find(
    i => i.serviceName.toLowerCase() === serviceName.toLowerCase()
  );
}

/**
 * Get API key setup instructions for an integration
 */
export function getApiKeySetupInstructions(serviceName: string): ApiKeyConfig | undefined {
  const config = getIntegrationReadinessConfig(serviceName);
  return config?.apiKeyConfig;
}

/**
 * Get list of service names that should be hidden from the Integration Hub
 */
export function getHiddenIntegrations(): string[] {
  return INTEGRATION_READINESS
    .filter(i => !i.isProductionReady)
    .map(i => i.serviceName);
}

/**
 * Validate that all production-ready integrations have required configurations
 * Returns an array of validation errors (empty if all valid)
 */
export function validateIntegrationReadiness(): string[] {
  const errors: string[] = [];

  for (const integration of INTEGRATION_READINESS) {
    if (!integration.isProductionReady) {
      continue;
    }

    if (!integration.pollFunctionName) {
      errors.push(`${integration.displayName}: Missing poll function name`);
    }

    if (integration.connectionType === 'oauth2' && !integration.oauthConfig) {
      errors.push(`${integration.displayName}: OAuth2 integration missing oauthConfig`);
    }

    if (integration.connectionType === 'api_key' && !integration.apiKeyConfig) {
      errors.push(`${integration.displayName}: API key integration missing apiKeyConfig`);
    }

    if (integration.apiKeyConfig) {
      if (!integration.apiKeyConfig.setupInstructions || integration.apiKeyConfig.setupInstructions.length === 0) {
        errors.push(`${integration.displayName}: API key integration missing setup instructions`);
      }
      if (!integration.apiKeyConfig.deepLink) {
        errors.push(`${integration.displayName}: API key integration missing deep link`);
      }
      if (!integration.apiKeyConfig.secretFields || integration.apiKeyConfig.secretFields.length === 0) {
        errors.push(`${integration.displayName}: API key integration missing secret fields`);
      }
    }
  }

  return errors;
}
