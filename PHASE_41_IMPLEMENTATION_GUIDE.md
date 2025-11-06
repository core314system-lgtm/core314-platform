# Phase 41: Role-Based Intelligence Access (RBIA) - Implementation Guide

## Overview

Phase 41 implements secure, role-based access control across Core314's Admin Dashboard and User Application, ensuring granular permissions for every AI subsystem and dataset.

## Role Hierarchy

### 1. platform_admin
- **Access Level**: Full read/write access to all systems
- **Capabilities**:
  - Manage all AI subsystems (Optimization, Calibration, Prediction, Oversight, Orchestrator)
  - View and modify all user data across organizations
  - Trigger all Edge Functions
  - Access all admin dashboard features
  - Manage user roles and permissions

### 2. operator
- **Access Level**: Read-only access to AI metrics
- **Capabilities**:
  - View optimization events, calibration data, predictions
  - Access oversight and orchestrator metrics
  - View system insights and cohesion scores
  - Cannot modify data or trigger calibration actions
  - Cannot access user management features

### 3. end_user
- **Access Level**: Limited access to own organization data
- **Capabilities**:
  - View system insights (high-level summaries)
  - Access prediction recommendations for their organization
  - View cohesion scores and system health
  - Cannot access raw AI subsystem data
  - Cannot trigger any Edge Functions

## Database Changes

### Profiles Table Updates

```sql
-- Updated role constraint to support new roles
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'user', 'platform_admin', 'operator', 'end_user'));

-- Added organization_id for data isolation
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
```

### Fusion Audit Log Extensions

```sql
-- Track which user triggered each action
ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fusion_audit_log 
  ADD COLUMN IF NOT EXISTS user_role TEXT;
```

## RLS Policies

All AI subsystem tables now have role-based RLS policies:

### Policy Pattern

```sql
-- Platform admins: Full access
CREATE POLICY "Platform admins can manage [table]"
  ON public.[table] FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_platform_admin = TRUE OR profiles.role = 'platform_admin')
    )
  );

-- Operators: Read-only
CREATE POLICY "Operators can view [table]"
  ON public.[table] FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operator', 'admin', 'manager')
    )
  );

-- End users: Own organization data only
CREATE POLICY "End users can view own org [table]"
  ON public.[table] FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('end_user', 'user')
    )
  );
```

### Tables with RLS Policies

- ✅ fusion_optimization_events
- ✅ fusion_behavioral_metrics
- ✅ fusion_prediction_events
- ✅ fusion_calibration_events
- ✅ fusion_audit_log
- ✅ fusion_orchestrator_events
- ✅ fusion_system_insights

## Edge Function Authentication

### Shared Auth Module

Location: `core314-app/supabase/functions/_shared/auth.ts`

**Key Functions:**

1. **verifyAuth()** - Verifies JWT token and extracts user context
2. **checkRole()** - Checks if user has required role
3. **createUnauthorizedResponse()** - Returns 401 error
4. **createForbiddenResponse()** - Returns 403 error
5. **logAuditEvent()** - Logs user actions to fusion_audit_log

### Updated Edge Functions

#### fusion-optimization-engine
- **Required Role**: operator or platform_admin
- **Auth**: JWT verification before execution
- **Audit**: Logs optimization triggers with user context

#### fusion-calibration-engine
- **Required Role**: operator or platform_admin
- **Auth**: JWT verification before execution
- **Audit**: Logs calibration actions with user context

#### fusion-oversight-engine
- **Required Role**: operator or platform_admin
- **Auth**: JWT verification before execution
- **Audit**: Logs oversight analysis with user context

#### fusion-orchestrator-engine
- **Required Role**: operator or platform_admin
- **Auth**: JWT verification before execution
- **Audit**: Logs orchestration tasks with user context

#### fusion-explainability-engine
- **Required Role**: end_user or higher
- **Auth**: JWT verification before execution
- **Audit**: No logging (read-only operation)

#### recommendation-engine
- **Required Role**: end_user or higher
- **Auth**: JWT verification before execution
- **Audit**: Logs recommendation requests with user context

## Helper Functions

### check_user_role(required_role TEXT)

```sql
-- Returns TRUE if current user has required role
SELECT public.check_user_role('operator');
```

**Logic:**
- Platform admins always return TRUE
- Operator role includes: operator, admin, manager
- End user role includes: end_user, user

### get_user_organization()

```sql
-- Returns organization_id of current user
SELECT public.get_user_organization();
```

## Testing Checklist

### Database Migration
- [ ] Run migration 048_role_based_intelligence_access.sql
- [ ] Verify profiles table has organization_id column
- [ ] Verify fusion_audit_log has user_id and user_role columns
- [ ] Check RLS policies are created for all tables

### Role Testing

#### Platform Admin Tests
- [ ] Can view all optimization events
- [ ] Can trigger calibration engine
- [ ] Can access all user data in User Management
- [ ] Can view all organizations' data

#### Operator Tests
- [ ] Can view optimization events (read-only)
- [ ] Can view calibration data (read-only)
- [ ] Cannot trigger calibration engine (403 Forbidden)
- [ ] Cannot access User Management

#### End User Tests
- [ ] Can view system insights
- [ ] Can access recommendations
- [ ] Cannot view raw optimization data (403 Forbidden)
- [ ] Cannot trigger any AI engines (403 Forbidden)

### Edge Function Tests

Test each Edge Function with different roles:

```bash
# Platform Admin (should succeed)
curl -X POST "https://ygvkegcstaowikessigx.supabase.co/functions/v1/fusion-optimization-engine" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"

# Operator (should succeed for read operations)
curl -X POST "https://ygvkegcstaowikessigx.supabase.co/functions/v1/fusion-explainability-engine?phase=Calibration" \
  -H "Authorization: Bearer <OPERATOR_TOKEN>"

# End User (should fail with 403)
curl -X POST "https://ygvkegcstaowikessigx.supabase.co/functions/v1/fusion-calibration-engine" \
  -H "Authorization: Bearer <END_USER_TOKEN>"
```

## Deployment Steps

### 1. Apply Database Migration

```sql
-- Run in Supabase SQL Editor
-- File: 048_role_based_intelligence_access.sql
```

### 2. Deploy Edge Functions

The shared auth module is automatically included when Edge Functions are deployed:

```bash
# Deploy updated functions (if needed)
supabase functions deploy fusion-optimization-engine --project-ref ygvkegcstaowikessigx
supabase functions deploy fusion-calibration-engine --project-ref ygvkegcstaowikessigx
# ... etc
```

### 3. Update Existing Users

```sql
-- Promote specific users to platform_admin
UPDATE public.profiles 
SET role = 'platform_admin'
WHERE email IN ('core314system@gmail.com', 'support@govmatchai.com');

-- Assign operators
UPDATE public.profiles 
SET role = 'operator'
WHERE email IN ('operator1@example.com', 'operator2@example.com');

-- Assign end users to organizations
UPDATE public.profiles 
SET role = 'end_user', organization_id = '<ORG_UUID>'
WHERE email IN ('user1@example.com', 'user2@example.com');
```

### 4. Test Authentication

Create test accounts for each role and verify access levels work correctly.

## Security Considerations

### JWT Token Management
- Tokens are verified on every Edge Function call
- Invalid or expired tokens return 401 Unauthorized
- Token verification uses Supabase Auth's built-in JWT validation

### RLS Policy Enforcement
- All queries automatically enforce RLS policies
- Service role bypasses RLS (used only by Edge Functions)
- Authenticated users are restricted by their role

### Audit Trail
- All Edge Function calls are logged with user_id and user_role
- Audit logs track who triggered which AI subsystem
- Anomaly detection flags suspicious activity

### Organization Isolation
- End users can only access their own organization's data
- Organization membership is enforced at the database level
- Cross-organization queries are blocked by RLS policies

## Troubleshooting

### Issue: 401 Unauthorized
**Cause**: Missing or invalid JWT token
**Solution**: Ensure Authorization header is set: `Bearer <token>`

### Issue: 403 Forbidden
**Cause**: User doesn't have required role
**Solution**: Check user's role in profiles table, update if needed

### Issue: RLS Policy Blocking Query
**Cause**: User's role doesn't match policy requirements
**Solution**: Verify RLS policies are correctly configured for the user's role

### Issue: Edge Function Returns Empty Data
**Cause**: RLS policies filtering out all results
**Solution**: Check if user has access to the requested data based on their role and organization

## Future Enhancements

### Phase 41.1: User Management UI
- Add role selector dropdown in User Management
- Display organization membership
- Show last login and activity metrics

### Phase 41.2: User App Integration
- Implement role-based navigation
- Show/hide features based on user role
- Display simplified metrics for end users

### Phase 41.3: API Key Management
- Generate API keys for programmatic access
- Assign roles to API keys
- Rate limiting per role

## Support

For questions or issues with Phase 41 implementation:
- Review this guide thoroughly
- Check Supabase logs for authentication errors
- Verify RLS policies in Supabase Dashboard
- Test with different role accounts to isolate issues
