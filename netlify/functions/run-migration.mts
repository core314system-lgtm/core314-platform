import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

export default async (req: Request, _context: Context) => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create tables by inserting a test row and letting it fail, then using rpc
  // Actually, we need to create an exec_sql function first through the service role

  // Use the Supabase REST endpoint to call postgres functions
  // We'll create tables through the HTTP API
  const tables = [
    {
      name: 'quote_form_templates',
      testInsert: {
        id: '00000000-0000-0000-0000-000000000001',
        name: '__test__',
        is_default: false,
      }
    }
  ]

  // Check if migration already ran by trying to read from one of the new tables
  const { error: checkErr } = await supabase
    .from('quote_form_templates')
    .select('id')
    .limit(1)

  if (!checkErr) {
    return new Response(JSON.stringify({ status: 'already_migrated' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    status: 'migration_needed',
    error: checkErr.message,
    hint: 'Run the SQL in supabase/migration-rfq-portal.sql via the Supabase Dashboard SQL editor'
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
