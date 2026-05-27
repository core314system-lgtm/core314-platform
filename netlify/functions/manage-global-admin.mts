import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async (req: Request, _context: Context) => {
  const headers = { 'Content-Type': 'application/json' }

  if (req.method === 'GET') {
    // List all users with their global admin status
    const callerId = req.headers.get('x-user-id')
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
    }

    // Verify caller is a global admin
    const { data: caller } = await supabase
      .from('user_profiles')
      .select('is_global_admin')
      .eq('id', callerId)
      .single()

    if (!caller?.is_global_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
    }

    // Fetch all user profiles
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, is_global_admin, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ users }), { headers })
  }

  if (req.method === 'POST') {
    const { caller_id, target_user_id, is_global_admin } = await req.json()

    if (!caller_id || !target_user_id || typeof is_global_admin !== 'boolean') {
      return new Response(JSON.stringify({ error: 'caller_id, target_user_id, and is_global_admin (boolean) required' }), { status: 400, headers })
    }

    // Verify caller is a global admin
    const { data: caller } = await supabase
      .from('user_profiles')
      .select('is_global_admin')
      .eq('id', caller_id)
      .single()

    if (!caller?.is_global_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: only global admins can manage access' }), { status: 403, headers })
    }

    // Prevent removing your own global admin access
    if (caller_id === target_user_id && !is_global_admin) {
      return new Response(JSON.stringify({ error: 'Cannot remove your own global admin access' }), { status: 400, headers })
    }

    // Update the target user
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_global_admin })
      .eq('id', target_user_id)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ success: true }), { headers })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
}
