import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyCaller(callerId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('is_global_admin')
    .eq('id', callerId)
    .single()
  return data?.is_global_admin === true
}

// Map an admin-selected tier to the subscription columns the runtime tier
// logic (useTier / tierLogic) actually reads. Writing only settings.tier had
// no effect on entitlements.
function tierToSubscription(tier: string): { plan: string | null; status: string } {
  switch (tier) {
    case 'enterprise': return { plan: 'enterprise', status: 'active' }
    case 'agentic': return { plan: 'agentic', status: 'active' }
    case 'growth': return { plan: 'growth', status: 'active' }
    default: return { plan: null, status: 'no_subscription' }
  }
}

export default async (req: Request, _context: Context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const callerId = req.headers.get('x-user-id')
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  const isAdmin = await verifyCaller(callerId)
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: global admin required' }), { status: 403, headers })
  }

  // GET — list all platform users (excludes subcontractor accounts)
  if (req.method === 'GET') {
    // Try to filter by account_type; if column doesn't exist yet, fall back to all users
    let users: any[] = []
    let error: any = null

    const result = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, is_global_admin, created_at, account_type')
      .or('account_type.eq.platform,account_type.is.null')
      .order('created_at', { ascending: true })

    if (result.error && result.error.code === '42703') {
      // Column doesn't exist yet — fall back to unfiltered query
      const fallback = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_global_admin, created_at')
        .order('created_at', { ascending: true })
      users = fallback.data || []
      error = fallback.error
    } else {
      users = result.data || []
      error = result.error
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    // Fetch org membership and org details for each user
    const userIds = (users || []).map(u => u.id)
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('user_id, org_id, role')
      .in('user_id', userIds)

    const orgIds = [...new Set((memberships || []).map(m => m.org_id))]
    const { data: orgs } = orgIds.length > 0
      ? await supabase.from('organizations').select('id, name, settings').in('id', orgIds)
      : { data: [] }

    const enrichedUsers = (users || []).map(u => {
      const membership = (memberships || []).find(m => m.user_id === u.id)
      const org = membership ? (orgs || []).find(o => o.id === membership.org_id) : null
      return {
        ...u,
        org_id: membership?.org_id || null,
        org_name: org?.name || null,
        org_role: membership?.role || null,
        tier: org?.settings?.tier || null,
      }
    })

    return new Response(JSON.stringify({ users: enrichedUsers }), { headers })
  }

  // POST — create a new user
  if (req.method === 'POST') {
    const body = await req.json()
    const { action } = body

    if (action === 'create-user') {
      const { email, password, full_name, role, tier } = body

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers })
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers })
      }

      // Create auth user (auto-confirm)
      let { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || email.split('@')[0] },
      })

      // If user already exists (soft-deleted ghost), purge via direct SQL and retry
      if (authError && authError.message?.toLowerCase().includes('already')) {
        await supabase.rpc('purge_auth_user_by_email', { target_email: email })
        const retry = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || email.split('@')[0] },
        })
        authData = retry.data
        authError = retry.error
      }

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers })
      }

      const userId = authData.user.id

      // Create/update user profile
      await supabase.from('user_profiles').upsert({
        id: userId,
        email,
        full_name: full_name || null,
        role: role || 'admin',
        account_type: 'platform',
      })

      // Create an organization for the user
      const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()
      const createTier = tier || 'growth'
      const createSub = tierToSubscription(createTier)
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: full_name ? `${full_name}'s Organization` : `${email.split('@')[0]}'s Organization`,
          slug: orgSlug,
          settings: { tier: createTier },
          subscription_plan: createSub.plan,
          subscription_status: createSub.status,
        })
        .select()
        .single()

      if (orgError) {
        return new Response(JSON.stringify({ error: `User created but org failed: ${orgError.message}` }), { status: 500, headers })
      }

      // Add user to org as owner
      await supabase.from('organization_members').insert({
        org_id: org.id,
        user_id: userId,
        role: 'owner',
      })

      // Set current org on profile
      await supabase.from('user_profiles').update({ current_org_id: org.id }).eq('id', userId)

      return new Response(JSON.stringify({
        success: true,
        user_id: userId,
        org_id: org.id,
        email,
        tier: tier || 'growth',
      }), { headers })
    }

    if (action === 'update-tier') {
      const { org_id, tier } = body
      if (!org_id || !tier) {
        return new Response(JSON.stringify({ error: 'org_id and tier required' }), { status: 400, headers })
      }

      const sub = tierToSubscription(tier)
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', org_id)
        .single()
      const { error } = await supabase
        .from('organizations')
        .update({
          settings: { ...(existingOrg?.settings || {}), tier },
          subscription_plan: sub.plan,
          subscription_status: sub.status,
        })
        .eq('id', org_id)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers })
  }

  // DELETE — delete a user
  if (req.method === 'DELETE') {
    const body = await req.json()
    const { user_id } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers })
    }

    // Cannot delete yourself
    if (user_id === callerId) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers })
    }

    // Check if target is a global admin
    const { data: target } = await supabase
      .from('user_profiles')
      .select('is_global_admin, email, current_org_id')
      .eq('id', user_id)
      .single()

    // Get org membership
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user_id)

    // Delete org memberships
    await supabase.from('organization_members').delete().eq('user_id', user_id)

    // Delete user profile
    await supabase.from('user_profiles').delete().eq('id', user_id)

    // Hard-delete auth user (not soft-delete) so email can be reused
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id, false)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({
      success: true,
      deleted_email: target?.email,
    }), { headers })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
}
