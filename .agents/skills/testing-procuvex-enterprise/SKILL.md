---
name: testing-procuvex-enterprise
description: Test enterprise readiness features (Contacts CRM, Project Contacts, Task Assignments, Activity Feed, API Docs, Security Page, Slack Integration, Notifications) on procuvex.com. Use when verifying collaboration, CRM, or enterprise feature changes.
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

## Known Issues and Workarounds
- The Security page "Data Handling Transparency" section uses Framer Motion `whileInView` — you must scroll it into the viewport for it to render. It won't appear in initial HTML scrape; use JavaScript `scrollIntoView()` to trigger it.
- The project detail page is very long. Use `scrollIntoView()` on h3 elements to jump to specific widgets rather than repeated scroll-down actions.
- The chatbot overlay may obscure bottom-right UI elements. Close it using the hide button if it blocks interactions.
- Task "Add Task" button requires non-empty description text to enable. Priority defaults to "Medium".
- Comment send button requires non-empty text to enable.
