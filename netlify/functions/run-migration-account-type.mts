import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// One-time migration: adds account_type column and marks subcontractor accounts.
// Safe to run multiple times (idempotent).
// DELETE THIS FUNCTION AFTER RUNNING ONCE.
export default async (req: Request, _context: Context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  // Verify caller is global admin
  const callerId = req.headers.get('x-user-id')
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  const { data: caller } = await supabase
    .from('user_profiles')
    .select('is_global_admin')
    .eq('id', callerId)
    .single()

  if (!caller?.is_global_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
  }

  // Step 1: Check if column already exists by trying to query it
  const { error: checkError } = await supabase
    .from('user_profiles')
    .select('account_type')
    .limit(1)

  if (checkError && checkError.code === '42703') {
    // Column doesn't exist — we need to add it via direct SQL
    // Since we can't run DDL via PostgREST, return instructions
    return new Response(JSON.stringify({
      status: 'column_missing',
      message: 'The account_type column needs to be added via Supabase SQL Editor. Run this SQL:',
      sql: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'platform';`,
    }), { headers })
  }

  // Step 2: Column exists — mark subcontractor accounts
  // Find all user IDs that have claimed subcontractor profiles
  const { data: subs } = await supabase
    .from('master_subcontractors')
    .select('claimed_by_user_id')
    .not('claimed_by_user_id', 'is', null)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({
      status: 'no_subcontractors',
      message: 'No claimed subcontractor profiles found',
    }), { headers })
  }

  const subUserIds = [...new Set(subs.map(s => s.claimed_by_user_id))]

  // Mark these users as subcontractor accounts (skip global admins)
  let updated = 0
  for (const userId of subUserIds) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_global_admin')
      .eq('id', userId)
      .single()

    if (profile && !profile.is_global_admin) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ account_type: 'subcontractor' })
        .eq('id', userId)

      if (!error) updated++
    }
  }

  return new Response(JSON.stringify({
    status: 'success',
    total_claimed: subUserIds.length,
    updated_to_subcontractor: updated,
    message: `Marked ${updated} user(s) as subcontractor accounts`,
  }), { headers })
}
