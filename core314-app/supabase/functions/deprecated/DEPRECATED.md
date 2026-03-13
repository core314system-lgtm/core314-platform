# Deprecated Edge Functions

**Date deprecated:** 2026-03-13
**Reason:** Platform stabilization — these functions are not referenced by any active code path (scheduler, frontend, or active Edge Functions).

## Status

These functions have been moved to `/deprecated` to:
1. Prevent accidental invocation
2. Reduce confusion about which functions are production-active
3. Clean up the deployment surface

## DO NOT

- Do NOT deploy these functions to Supabase
- Do NOT reference these functions from new code
- Do NOT delete them without reviewing for any reusable logic

## Active Functions (NOT in this directory)

The following functions remain active and are deployed in production:

| Function | Purpose | Trigger |
|----------|---------|---------|
| `_shared` | Shared utilities (Sentry, audit logger) | Imported by other functions |
| `activate-beta-invite` | Activate beta invite codes | User action (BetaInvite page) |
| `adaptive-retraining-scheduler` | Retrain predictive models | Admin action (PredictiveModels page) |
| `admin-messaging` | Admin bulk messaging | Admin action (BetaOperations page) |
| `ai-generate` | AI text generation (GPT-4o) | Frontend (ai.ts service) |
| `beta-application` | Beta program applications | Landing page (BetaInvitePage) |
| `calculate-user-score` | Calculate user quality scores | Admin Netlify function |
| `check-oauth-readiness` | Verify OAuth readiness for integrations | IntegrationHub page |
| `disconnect-integration` | Disconnect user integration (set inactive, delete tokens) | IntegrationManager page |
| `calculate-operational-momentum` | Calculate momentum delta from health score history | On demand / brief-generate |
| `health-score-calculator` | Calculate composite health score (0-100) | On demand / scheduler |
| `hubspot-poll` | Poll HubSpot CRM data | pg_cron via integration-scheduler |
| `integration-health-check` | Validate/refresh OAuth tokens | pg_cron every 5 min |
| `integration-scheduler` | Orchestrate all polling + signal detection | pg_cron every 15 min |
| `oauth-callback` | Handle OAuth2 callback (exchange code, store tokens) | OAuth redirect |
| `oauth-initiate` | Start OAuth2 flow | User action |
| `onboarding-complete-step` | Mark onboarding steps complete | OnboardingContext |
| `operational-brief-generate` | Generate AI operational narratives | On demand |
| `quickbooks-poll` | Poll QuickBooks financial data | pg_cron via integration-scheduler |
| `send-bulk-email` | Send bulk emails to users | Admin EmailUsersModal |
| `signal-correlator` | Correlate signals across integrations into unified events | Called by scheduler |
| `signal-detector` | Analyze events, create operational signals | Called by scheduler |
| `slack-poll` | Poll Slack workspace metrics | pg_cron via integration-scheduler |
| `stripe-webhook` | Process Stripe subscription events | Stripe webhook |

## Deprecated Function Categories

### Fusion Engine (23 functions)
Speculative fusion scoring, calibration, and optimization engine. Never reached production use.

### Poll Functions — Unconfigured Integrations (18 functions)
Poll functions for integrations that have no OAuth credentials configured:
airtable-poll, asana-poll, basecamp-poll, bitbucket-poll, clickup-poll, confluence-poll, discord-poll, figma-poll, freshdesk-poll, gcal-poll, github-poll, gitlab-poll, gmeet-poll, intercom-poll, jira-poll, linear-poll, miro-poll, monday-poll, notion-poll, planner-poll, salesforce-poll, servicenow-poll, smartsheet-poll, teams-poll, trello-poll, xero-poll, zendesk-poll, zoom-poll

### AI/ML Pipeline (12 functions)
Speculative AI agent, automation, and prediction infrastructure.

### Governance & Policy (8 functions)
Governance framework, neural policy engine, trust graph — never activated.

### Simulation & Optimization (8 functions)
Simulation engine and optimization pipeline — never activated.

### Beta Management (5 functions)
Legacy beta monitoring and notification functions.

### Auth & Security (6 functions)
2FA, session logging, RLS verification — not currently active.

### Organization Management (10 functions)
Organization CRUD operations — may be reactivated if org features are built.

### Other (various)
Miscellaneous dormant functions including alerts, insights, narratives, telemetry.
