---
name: testing-procuvex-enterprise
description: Test enterprise readiness features (Contacts CRM, Project Contacts, Task Assignments, Activity Feed, API Docs, Security Page, Slack Integration, Notifications, Proposal Draft Generation, Compile Proposal PDF) and Enterprise pricing tier gating on procuvex.com. Use when verifying collaboration, CRM, enterprise feature changes, proposal features, or tier gating.
---

# Testing Procuvex Enterprise Readiness Features

## Devin Secrets Needed
- `TASKORDER_SUPABASE_SERVICE_ROLE_KEY` — for direct DB verification queries and test data cleanup
- `TASKORDER_SUPABASE_ANON_KEY` — for authenticated API testing
- Login credentials for admin account (core314system@gmail.com)

## Test Environment
- Production: https://procuvex.com
- Database: Supabase at `${TASKORDER_SUPABASE_URL}`
- Enterprise tables: `contacts`, `project_contacts`, `project_comments`, `project_tasks`, `organization_settings`
- All tables use RLS scoped by `org_id`

## Test Accounts
- **Enterprise admin:** `core314system@gmail.com` + `CORE314_ADMIN_PASSWORD` secret (has `is_global_admin=true`, bypasses tier restrictions)
- **Growth user:** `growth-test@procuvex-testing.com` / `GrowthTest2026!` (Growth tier, can test enterprise feature blocking)
- **Test project with proposal outline:** `3b3c2bfc-0880-472b-b1d6-e97cc89d0626` (E2E Test - GSA FMO Federal Courthouse Jacksonville FL)

## Feature Routes

### Standalone Pages
- `/contacts` — Contact Management (CRM)
- `/api-docs` — API Documentation (public landing page)
- `/security` — Security Page with Data Handling Transparency section

### Project-Level Widgets (inside project detail page)
- Project Contacts ("Key Contacts") — grid alongside Project Team
- Project Tasks ("Tasks") — grid below Key Contacts
- Project Activity Feed ("Activity & Comments") — grid alongside Tasks
- Activity Log — below the Activity Feed

### Settings
- `/settings` → Notifications tab → Slack Integration section
- `/settings` → Notifications tab → Agent Notification Preferences

## Testing Contacts CRUD

1. Navigate to `/contacts` via sidebar
2. Click "Add Contact" button
3. Fill form fields:
   - First Name, Last Name (required)
   - Email, Phone, Title, Agency (optional)
   - Contact Type: dropdown with Government/Partner/Subcontractor/Internal/Other
4. Save — contact appears in table with type badge (Government=blue)
5. Use filter dropdown to filter by type
6. Search by name in search field
7. Navigate away (Dashboard) and back — verify persistence
8. Delete contact — verify removal from table

**DB Verification:** Query Supabase API to confirm `org_id` is non-null UUID:
```bash
curl -s "${TASKORDER_SUPABASE_URL}/rest/v1/contacts?select=id,org_id,first_name,last_name" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY"
```

## Testing Project Widgets

### Navigating to Widgets
1. Go to `/projects` and click any project
2. Scroll down past Capture Gate Progress, Bid Readiness, Smart Recommendations
3. Widgets are in a grid: Project Team + Key Contacts (row 1), Tasks + Activity & Comments (row 2), Activity Log (below)

### Key Contacts Widget
- Renders with "Key Contacts" heading and "+ Add" button
- Empty state: "No contacts assigned to this project."
- Add links contacts from the `/contacts` table to this project

### Tasks Widget
- Renders with "Tasks" heading and "+ Add" button
- Empty state: "No tasks yet. Add action items for your capture team."
- Click "+ Add" to open inline form: task description, assign to, priority (High/Medium/Low), due date
- Add Task button is disabled until description is entered
- Created task shows priority badge (High=red, Medium=yellow, Low=green)
- Shows counter: "0/1 done"
- Circle button cycles status: todo → in_progress → done

### Activity & Comments Widget
- Renders with "Activity & Comments" heading
- Comment input with send button (blue arrow)
- Send button is disabled until text is entered
- Posted comments show user name, avatar initial, timestamp ("just now")
- Trash icon to delete comments

## Testing API Documentation Page
1. Navigate to `/api-docs` (also accessible from footer link)
2. Verify: "Build on Procuvex" heading, "API Documentation" badge
3. Authentication section with JWT curl code example
4. Three info cards: Row-Level Security, Rate Limiting, REST + Realtime
5. Rate limits shown: Enterprise 100 AI/hr, Growth 50 AI/hr

## Testing Security Page Data Handling
1. Navigate to `/security`
2. Scroll past Defense in Depth and Compliance sections
3. "Data Handling Transparency" section has two cards:
   - "What Procuvex Processes" (5 items including SAM.gov data, RFP/SOW documents)
   - "What Procuvex Does NOT Handle" (5 items including classified info, payment card data)
4. Uses Framer Motion animations — must scroll into viewport to trigger rendering

## Testing Slack Integration
1. Navigate to `/settings`
2. Click "Notifications" tab
3. Agent Notifications section: toggle switches + delivery method dropdowns (In-App/Email/Both)
4. Slack Integration section below:
   - "Incoming Webhook URL" input field
   - "Learn how" link to Slack docs (external)
   - "Save" button (disabled until URL entered)

## Testing Footer Link
1. On any public/landing page (e.g., `/security`, `/api-docs`)
2. Scroll to footer → Company column
3. Verify "API Documentation" link exists pointing to `/api-docs`

## Test Data Cleanup
Always clean up test data after testing using Supabase API:
```bash
# Delete test tasks
curl -s -X DELETE "${TASKORDER_SUPABASE_URL}/rest/v1/project_tasks?title=eq.TEST_TITLE" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY"

# Delete test comments
curl -s -X DELETE "${TASKORDER_SUPABASE_URL}/rest/v1/project_comments?content=eq.TEST_CONTENT" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY"

# Delete test contacts
curl -s -X DELETE "${TASKORDER_SUPABASE_URL}/rest/v1/contacts?first_name=eq.Test&last_name=eq.GovContact" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY"
```

## Testing Enterprise Pricing Tier Gating

Enterprise features are gated by the `TierGate` component and the `ENTERPRISE_ONLY_FEATURES` set in `src/hooks/useTier.ts`. When tier gating changes are made, test both marketing pages and in-app behavior.

### Marketing Pages to Verify
These pages list features by tier and should be checked when new enterprise features are added:

1. **Pricing Page (`/pricing`)** — Enterprise tier card, comparison table rows, FAQ
   - New enterprise features should appear in the Enterprise card but NOT in Growth
   - Comparison table should show X (gray) for Growth, checkmark (blue) for Enterprise
   - Use JS to verify: `document.querySelectorAll('td')` and check for feature names
   - FAQ "What Enterprise-only features are included?" should list all enterprise features

2. **Product Page (`/product`)** — Module cards with purple "Enterprise" badge
   - Enterprise-only modules get `enterpriseOnly: true` flag in the modules array
   - Badge renders as `<span>` with purple styling next to the `<h3>` module title
   - Verify with: `document.querySelectorAll('h3')` and check sibling spans for "Enterprise"

3. **Landing Page (`/`)** — Feature Highlights grid, module count
   - New features added to the highlights array
   - Module count stat should reflect total (e.g., "30+")

4. **Compare Page (`/compare/govly`)** — Team Collaboration section
   - New features in the `teamCollaboration` array with `procuvex: true, competitor: false`

5. **Founding Partners Page (`/founding-partners`)** — Enterprise Access benefit
   - Specific feature names listed in the benefit description text

### In-App Tier Gating

**Important:** The `core314system@gmail.com` admin account has `is_global_admin=true`, which bypasses ALL tier restrictions (line ~122 in `useTier.ts`). You CANNOT test Growth-tier blocking with this account.

- **Enterprise user sees:** Full feature access, no "ENT" badges in sidebar, no TierGate upgrade prompts
- **Growth user would see:** "ENT" badge on enterprise sidebar items, TierGate upgrade prompt instead of feature content, disabled buttons with "Enterprise" tooltip

### Key Files for Tier Gating
- `src/hooks/useTier.ts` — `ENTERPRISE_ONLY_FEATURES` set, `useTier()` hook, `TierGate` component
- `src/components/Layout.tsx` — Sidebar items with `enterpriseOnly` flag
- `src/App.tsx` — Route-level TierGate wrapping (e.g., `/contacts`)
- `src/pages/TaskOrderDetail.tsx` — Project widget TierGate wrapping
- `src/pages/OrgSettings.tsx` — Settings feature TierGate wrapping
- `src/pages/ProposalOutline.tsx` — Draft generation button tier check

### Verification Approach for Tier Gating
Since the admin account bypasses tier checks, use these strategies:
1. **Marketing pages (primary evidence):** Verify all public-facing pages correctly distinguish Growth vs Enterprise
2. **Sidebar check:** Enterprise user sidebar shows feature without "ENT" badge
3. **Feature rendering:** Enterprise user sees full feature UI (not upgrade prompt)
4. **Code review:** Verify TierGate wrapping uses correct feature keys that exist in ENTERPRISE_ONLY_FEATURES

## Testing Proposal Draft Generation

The proposal draft generation feature is on the Proposal Outline page (`/projects/{id}/proposal-outline`). It's an Enterprise-only feature gated by `proposal_draft_generation` in `ENTERPRISE_ONLY_FEATURES`.

### Prerequisites
- Project must have a generated proposal outline (4 volumes, ~9 sections)
- Use test project `3b3c2bfc-0880-472b-b1d6-e97cc89d0626` which already has outline data

### Enterprise User — Draft Generation UI
1. Navigate to `/projects/3b3c2bfc-0880-472b-b1d6-e97cc89d0626/proposal-outline`
2. Verify **"Generate All Drafts"** button visible with Wand2 icon + text label (purple/indigo gradient)
3. Verify **draft counter** visible (e.g., "X/9 sections drafted")
4. Expand Volume I — verify each undrafted section has a purple **"Draft"** pill button
5. Verify drafted sections have green **"Redraft"** pill button + **"View"/"Hide"** toggle
6. Click "Draft" on an undrafted section — button disables during generation (~10-20s for AI call)
7. After generation: button changes to "Redraft", "View" appears, counter increments, status → "Drafting"
8. Click "View" to expand draft — shows "AI-Generated Draft" header with "Copy" button and editable textarea

### Enterprise User — Compile Proposal PDF
1. **"Compile Proposal PDF"** green button only appears when `draftedSections > 0`
2. Click it — triggers PDF download named `Proposal_{project_title}.pdf`
3. Verify PDF is valid: title page, table of contents, volume content with formatted sections
4. Undrafted sections show "[Draft not yet generated for this section]" placeholder
5. Same compile function available in Export Center (`/projects/{id}/exports`) as first card "Compiled Proposal (PDF)"

### Growth User — Draft Generation Gated
1. Log in as `growth-test@procuvex-testing.com` / `GrowthTest2026!`
2. Navigate to the same Proposal Outline page
3. Verify "Generate All Drafts" is replaced with gray bar: **"Draft Generation — Enterprise Feature"** with link to `/billing`
4. Verify per-section draft buttons are replaced with purple **"ENT"** badges
5. "Compile Proposal PDF" button may still be visible (compilation doesn't require AI generation)
6. Drafted sections still show "View" button (Growth users can read existing drafts)

### Key Files for Proposal Draft
- `src/pages/ProposalOutline.tsx` — main page with `generateDraft()`, `generateAllDrafts()`, `compileProposal()`
- `src/pages/ExportCenter.tsx` — "Compiled Proposal" export option with `exportProposalPdf()`
- `src/hooks/useTier.ts` — `proposal_draft_generation` in ENTERPRISE_ONLY_FEATURES

## Testing Enterprise Custom Email Domain (SendGrid)

The Enterprise custom email-domain feature (`/settings/email-domain`, route gated by `TierGate feature="custom_email_domain"`) runs on **SendGrid Domain Authentication** — the platform is SendGrid-only, there is NO Mailgun anywhere. Backend: `netlify/functions/enterprise-email-domains.mts` (actions: `add-domain`, `check-dns`, `verify-domain`, `remove-domain`, `list-domains`, `update-branding`). Frontend: `src/pages/EnterpriseEmailSettings.tsx`.

### Critical setup gotcha — org context
The frontend sends only `x-user-id`; the backend derives org from `body.org_id || profile.current_org_id`. The **global-admin account (`core314system@gmail.com`) has `current_org_id = NULL`**, so the UI returns **"Organization ID required"** and you cannot drive the flow as-is. A real Enterprise admin has `current_org_id` set via org provisioning. To test through the UI, temporarily point the admin at a controlled org, then reset:
```bash
# set (controlled "sample 2" org)
curl -s -X PATCH "$TASKORDER_SUPABASE_URL/rest/v1/user_profiles?id=eq.<ADMIN_USER_ID>" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"current_org_id":"<ORG_ID>"}'
# ...run test, then reset...
curl -s -X PATCH ".../user_profiles?id=eq.<ADMIN_USER_ID>" ... -d '{"current_org_id":null}'
```

### Migrations are NOT auto-applied on deploy — verify schema first
This repo does not run `supabase/migrations/*` automatically on Netlify deploy. A merged migration can be missing in prod. Before testing schema-dependent features, check the column exists:
```bash
curl -s "$TASKORDER_SUPABASE_URL/rest/v1/org_email_domains?select=id,provider,sendgrid_domain_id&limit=1" \
  -H "apikey: $TASKORDER_SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $TASKORDER_SUPABASE_SERVICE_ROLE_KEY"
```
If it returns `42703 column ... does not exist`, the migration wasn't applied. Apply the repo migration to prod via the Supabase Management API (`POST /v1/projects/{ref}/database/query` with `SUPABASE_MANAGEMENT_API_TOKEN`), then re-test. (The email-domain feature depends on the `mailgun_domain_id → sendgrid_domain_id` rename.)

### Flow (UI)
1. `/settings/email-domain` → list renders empty-state "No Custom Domains" or existing cards (exercises `list-domains`).
2. "Add Domain" → Domain (use a throwaway like `devin-sendgrid-check-XXX.example.com`), From Name, From Email → submit.
3. Card appears with status **"Verifying"** + "DNS Records Required" (TXT SPF, TXT DKIM, CNAME Tracking).
4. **Assert records are SendGrid, not Mailgun:** DNS data targets end in `sendgrid.net` (e.g. `*.wlNNN.sendgrid.net`). NOT `mailgun.org`.
5. "Re-check DNS" (refresh icon) → `check-dns` returns 200, status stays "Verifying" (throwaway DNS never published — expected).
6. "Remove domain" (trash icon) → card disappears, back to empty state.

### DB verification (service role)
Row in `org_email_domains` for the domain must have `provider='sendgrid'` and `sendgrid_domain_id` = numeric string (proves the renamed column is written). After remove, row count = 0.

### Cleanup (mandatory)
- Delete the `org_email_domains` row if UI didn't.
- `remove-domain` intentionally does NOT delete the SendGrid whitelabel domain — delete it via SendGrid API so no artifact remains:
  ```bash
  curl -s -X DELETE "https://api.sendgrid.com/v3/whitelabel/domains/<SG_ID>" -H "Authorization: Bearer $TASKORDER_SENDGRID_API_KEY"
  # expect HTTP 204
  ```
- Reset admin `current_org_id` to NULL if you changed it.

### Outreach metrics dashboard (also SendGrid/DB-sourced)
`/master-subs` "Email Delivery Metrics" panel is computed from internal DB tracking + SendGrid webhook (`netlify/functions/sendgrid-webhook.mts`), no Mailgun stats API. `GET /.netlify/functions/outreach-metrics` → 200 with `summary`/`warmup`/`emails`; `warmup.domain=procuvex.com`; response must contain no `mailgun` string.

## Devin Secrets Needed (additional)
- `SUPABASE_MANAGEMENT_API_TOKEN` — to apply un-applied migrations to prod
- `TASKORDER_SENDGRID_API_KEY` — to verify/clean up SendGrid whitelabel domains

## Known Issues and Workarounds
- The Security page "Data Handling Transparency" section uses Framer Motion `whileInView` — you must scroll it into the viewport for it to render. It won't appear in initial HTML scrape; use JavaScript `scrollIntoView()` to trigger it.
- The project detail page is very long. Use `scrollIntoView()` on h3 elements to jump to specific widgets rather than repeated scroll-down actions.
- The chatbot overlay may obscure bottom-right UI elements. Close it using the hide button if it blocks interactions.
- Task "Add Task" button requires non-empty description text to enable. Priority defaults to "Medium".
- Comment send button requires non-empty text to enable.
- Global admin (`is_global_admin=true`) bypasses all tier restrictions — cannot test Growth-tier gating with this account. Use `growth-test@procuvex-testing.com` / `GrowthTest2026!` for Growth-tier testing.
- Preview deploys may take a few minutes after PR push to reflect changes. Check Netlify status if content looks stale.
- AI draft generation calls GPT-4o-mini and takes ~10-20 seconds per section. Wait for the loading state to complete before asserting.
- The "Compile Proposal PDF" button only appears when at least 1 section has been drafted. If testing on a fresh project, generate a draft first.
- The FeatureGuidance component (collapsible step guide) appears at the top of Proposal Outline page with 4 steps. It can be dismissed with the X button.
- The Proposal Outline page requires an existing outline to be generated first. If the page shows "Generate with AI" instead of volumes, click it to create the outline structure before testing draft features.
