---
name: testing-procuvex-govcon
description: Test GovCon BD features (Past Performance, Capture Gates, Contract Vehicles, Color Team Reviews, Personnel/LCAT, SB Plans, Section L/M, Competitive Intelligence, Price-to-Win) on procuvex.com. Use when verifying GovCon feature changes.
---

# Testing Procuvex GovCon Features

## Devin Secrets Needed
- `TASKORDER_SUPABASE_SERVICE_ROLE_KEY` — for direct DB queries if needed
- `TASKORDER_OPENAI_API_KEY` — AI features (Section L/M, Competitive Intel, Price-to-Win) use this
- Login credentials for admin account (core314system@gmail.com)

## Test Environment
- Production: https://procuvex.com
- Test Project ID: Use any existing project (e.g., `699cfa2a-10fd-4177-99b7-acd3ed82628d`)
- Database: Supabase (9 GovCon tables with RLS)
- AI endpoints: `/.netlify/functions/ai-section-lm`, `/.netlify/functions/ai-competitive-intel`, `/.netlify/functions/ai-price-to-win`

## GovCon Feature Routes

### Organization-Level (sidebar navigation)
- `/past-performance` — Past Performance Citation Library
- `/contract-vehicles` — Contract Vehicle Registry
- `/labor-categories` — Personnel & LCAT Database (has 2 tabs: Labor Categories + Key Personnel)
- `/competitive-intelligence` — Market Intel / Competitive Intelligence

### Project-Level (inside project detail → Step 3: Review Generated Outputs)
- `/projects/:id/capture-gates` — Capture Gate Reviews (Shipley 5-gate)
- `/projects/:id/color-team` — Color Team Reviews (Pink/Red/Gold/Blue/Black Hat)
- `/projects/:id/sb-plan` — SB Subcontracting Plan (FAR 52.219-9)
- `/projects/:id/section-lm` — Section L/M Analysis (AI)
- `/projects/:id/price-to-win` — Price-to-Win Analysis (AI)

## Testing CRUD Features (Past Performance, Contract Vehicles, Personnel)

### Past Performance Citations
1. Navigate to `/past-performance`
2. Click "Add Citation" — modal opens
3. Fill required fields: Contract Title, Agency, Contract Type (dropdown: FFP/T&M/CPFF/etc), CPARS Rating (Exceptional/Very Good/Satisfactory/Marginal/Unsatisfactory)
4. Save — verify citation appears in list
5. Check CPARS badge colors: Exceptional=green, Very Good=blue, Satisfactory=yellow, Marginal=orange, Unsatisfactory=red
6. Delete — verify removal

### Contract Vehicles
1. Navigate to `/contract-vehicles`
2. Click "Add Vehicle" — form with Vehicle Name, Type (GSA Schedule/GWAC/BPA/IDIQ/Agency IDIQ/Other), Status (Active/Pending/Expired)
3. Save — verify status badge: Active=green with CheckCircle, Pending=yellow, Expired=red
4. Delete — verify removal

### Personnel & LCAT
1. Navigate to `/labor-categories`
2. Verify TWO tabs: "Labor Categories" and "Key Personnel"
3. Test CRUD on each tab independently
4. Labor Categories: Category Name, Hourly Rate Min/Max, Clearance Required (None/Public Trust/Secret/Top Secret/TS/SCI)
5. Key Personnel: Full Name, Email, Clearance Level, Availability (Available/Assigned/On Leave/Departed)

## Testing Capture Gate Reviews

1. Navigate to `/projects/:id/capture-gates`
2. Verify all 5 Shipley gates render:
   - Gate 0: Opportunity Qualification (7 checklist items)
   - Gate 1: Capture Strategy (6 items)
   - Gate 2: Win Strategy (7 items)
   - Gate 3: Proposal Ready (7 items)
   - Gate 4: Bid Submission (6 items)
3. Click a gate to expand — verify checklist items are interactive (checkboxes)
4. Test decision buttons: GO / NO-GO / CONDITIONAL GO
5. Verify progress percentage updates when checklist items are checked

## Testing Color Team Reviews

1. Navigate to `/projects/:id/color-team`
2. Verify all 5 review types with correct colors:
   - Pink Team: pink/rose styling (bg-pink-100)
   - Red Team: red styling (bg-red-100)
   - Gold Team: amber/yellow styling (bg-amber-100)
   - Blue Team: blue styling (bg-blue-100)
   - Black Hat: gray/dark styling (bg-gray-100)
3. Create a review — set type, status, scheduled date
4. Add findings with Section, Finding text, Severity (Critical/Major/Minor/Observation)
5. Delete review after test

## Testing SB Subcontracting Plan

1. Navigate to `/projects/:id/sb-plan`
2. Verify FAR 52.219-9 reference in heading
3. Check 5 SB categories with correct federal defaults:
   - Small Business (SB): 23%
   - SDB/8(a): 5%
   - WOSB: 5%
   - HUBZone: 3%
   - SDVOSB: 3%
4. Enter Total Subcontracting Dollars — verify auto-calculation (e.g., 23% of $10M = $2.3M)
5. Check "Auto-Populate from Network" button
6. Check status options: Draft/Reviewed/Submitted/Approved

## Testing AI Features

### Competitive Intelligence (Most Reliable for E2E Testing)
This feature uses regular `<input>` fields that work with automated browser tools:
1. Navigate to `/competitive-intelligence`
2. Enter NAICS Code (e.g., "541512") in input field
3. Click "Analyze Competition" — button shows "Analyzing Market..." loading state
4. Wait for AI response (5-15 seconds)
5. Verify structured results: market_summary (total_awards, total_dollars, avg_award_size), competitor_profiles, strategic_recommendations

### Section L/M Analysis and Price-to-Win (Textarea Limitation)
These features use `<textarea>` elements for key inputs. **Known issue with automated browser testing:** React's synthetic event system does not trigger `onChange` when textarea values are set programmatically via DOM manipulation. The button stays disabled because React state doesn't update.

**Workarounds if textarea input is needed:**
1. Try using Playwright CDP scripting to set values and trigger React events
2. Use browser console to directly set React state:
   ```js
   // Find the textarea element
   const textarea = document.querySelector('textarea');
   // Find React fiber
   const key = Object.keys(textarea).find(k => k.startsWith('__reactProps$'));
   // Call onChange directly
   textarea[key].onChange({ target: { value: 'your text here' } });
   ```
3. If all programmatic approaches fail, verify page render (form structure, button labels, field layout) and note that manual user testing is needed for the AI analysis flow

### Price-to-Win Form Fields
- Contract Type (dropdown: FFP/T&M/CPFF/CPAF/CPIF/IDIQ)
- Estimated Value (input, works with automated tools)
- NAICS Code (input, works)
- Agency (input, works)
- Period of Performance (input, works)
- Set-Aside (dropdown: Full & Open/SB/8(a)/SDVOSB/WOSB/HUBZone)
- Scope of Work Summary (**textarea — may need workaround**)
- Incumbent Information (**textarea — optional**)

## Testing Project Detail Integration

The 5 new feature cards appear inside "Step 3: Review Generated Outputs" accordion on the project detail page. This section is **collapsed by default** — you must click to expand it.

1. Navigate to `/projects/:id`
2. Scroll down to find "Step 3: Review Generated Outputs"
3. Click to expand — the section is an accordion/collapsible
4. Verify 5 new cards with correct descriptions:
   - "Capture Gate Reviews" — "Shipley-aligned gate review process"
   - "Color Team Reviews" — "Pink, Red, Gold team proposal quality reviews"
   - "SB Subcontracting Plan" — "FAR 52.219-9 compliant"
   - "Section L/M Analysis" — "AI extraction of evaluation criteria"
   - "Price-to-Win" — "AI-assisted competitive pricing analysis"
5. Click each card to verify navigation to correct URL

## Database Tables (Migration: 20260630_govcon_features.sql)

All tables have RLS enabled with org-scoped policies:
- `past_performance_citations` — org-level
- `project_past_performance` — links citations to projects
- `capture_gates` — project-level, unique(task_order_id, gate_number)
- `contract_vehicles` — org-level
- `color_team_reviews` — project-level
- `labor_categories` — org-level
- `key_personnel` — org-level, references labor_categories
- `project_key_personnel` — links personnel to projects
- `sb_subcontracting_plans` — project-level, unique(task_order_id)

## Testing CPARS Tracker

The CPARS Tracker (`/cpars-tracker`) stores ratings in the `cpars_ratings` table which has RLS requiring `org_id`.

### Test Procedure
1. Navigate to `/cpars-tracker`
2. Click "Add Rating" — form opens with text fields + 5 rating dropdowns
3. Fill contract_title (required), contract_number, agency, period
4. Set rating dropdowns (Quality, Schedule, Cost Control, Management, Small Business) — values 1-5
5. Click "Save Rating"
6. **Key assertion:** Entry appears in table immediately (not just form closes)
7. Navigate away and back — entry must persist (proves DB insert succeeded with org_id)
8. Optional: Query Supabase directly to verify `org_id` is non-null UUID

### Known Issues
- **Select dropdowns:** The browser tool's `select_option` action may fail on these dropdowns. Use the React fiber workaround via console:
  ```js
  const sel = document.querySelectorAll('select')[0]; // 0=Quality, 1=Schedule, etc.
  sel.value = '4';
  const key = Object.keys(sel).find(k => k.startsWith('__reactProps$'));
  sel[key].onChange({ target: { value: '4' } });
  ```
- **Chatbot overlay:** The "Ask Procuvex Intelligence" button overlaps the delete/edit buttons in the table row. Close the chatbot tooltip first, or use the Supabase API for cleanup.
- **org_id requirement:** All inserts to `cpars_ratings` must include `org_id` from `useOrg()` context. Without it, RLS silently rejects the insert — the form closes as if it succeeded but no data is saved. This was fixed in PR #776.

### Database Verification
```bash
curl -s "${TASKORDER_SUPABASE_URL}/rest/v1/cpars_ratings?contract_title=eq.YOUR_TITLE&select=id,contract_title,org_id,quality,overall" \
  -H "apikey: ${TASKORDER_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${TASKORDER_SUPABASE_SERVICE_ROLE_KEY}"
```
Verify `org_id` is a non-null UUID.

## Common Gotchas

1. **Feature cards hidden in accordion:** The project detail page shows new GovCon cards inside "Step 3: Review Generated Outputs" which is collapsed by default. Don't report them as missing without expanding the section first.

2. **Textarea React state issue:** Automated browser tools (including Devin's browser tool and Playwright) may not properly trigger React's synthetic onChange event for `<textarea>` elements. Regular `<input>` elements work fine. This affects Section L/M and Price-to-Win testing.

3. **Capture gates auto-initialize:** When first visiting `/projects/:id/capture-gates`, the system creates all 5 gates with default checklists if none exist. The page handles this automatically.

4. **SB Plan is per-project unique:** Only one SB plan per project (unique constraint on task_order_id). Creating a second one will fail.

5. **CPARS rating colors are hardcoded in the component:** The Past Performance page maps ratings to Tailwind colors directly in the JSX. If ratings don't match the exact strings (Exceptional, Very Good, etc.), the badge falls back to gray.

6. **AI endpoints require OpenAI API key:** The AI features (Section L/M, Competitive Intel, Price-to-Win) call OpenAI via Netlify functions. If the API key is invalid or rate-limited, AI analysis will fail with an error message.

## CI Notes
- The repo has 4 optional Netlify deploy-preview checks that may fail on PRs. These are pre-existing.
- GovCon pages are standard React components with no special build requirements.
