import type { Context } from "@netlify/functions"
import pg from "pg"

export default async (req: Request, _context: Context) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/(\w+)\.supabase\.co/)?.[1]
  
  if (!projectRef) {
    return new Response(JSON.stringify({ error: 'Could not extract project ref' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Build database connection string
  // Supabase pooler connection using service role
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()

    // Check if table exists
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_subcontractors'
      )
    `)

    if (checkResult.rows[0].exists) {
      await client.end()
      return new Response(JSON.stringify({ status: 'table_already_exists' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_subcontractors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
        subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
        match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
        relevance_reason TEXT,
        matched_requirements TEXT[] DEFAULT '{}',
        status TEXT DEFAULT 'matched' CHECK (status IN ('matched', 'shortlisted', 'invited', 'quoted', 'awarded', 'rejected', 'removed')),
        source TEXT DEFAULT 'ai_match' CHECK (source IN ('ai_match', 'auto_discover', 'manual', 'sow_tracker')),
        added_by UUID,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(task_order_id, subcontractor_id)
      )
    `)

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_subs_task_order ON project_subcontractors(task_order_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_subs_subcontractor ON project_subcontractors(subcontractor_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_subs_status ON project_subcontractors(status)`)

    // Enable RLS
    await client.query(`ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY`)

    // RLS policies
    await client.query(`CREATE POLICY "project_subs_select" ON project_subcontractors FOR SELECT TO authenticated USING (true)`)
    await client.query(`CREATE POLICY "project_subs_insert" ON project_subcontractors FOR INSERT TO authenticated WITH CHECK (true)`)
    await client.query(`CREATE POLICY "project_subs_update" ON project_subcontractors FOR UPDATE TO authenticated USING (true)`)
    await client.query(`CREATE POLICY "project_subs_delete" ON project_subcontractors FOR DELETE TO authenticated USING (true)`)
    await client.query(`CREATE POLICY "project_subs_service_role" ON project_subcontractors FOR ALL TO service_role USING (true)`)

    // Notify PostgREST to reload schema cache
    await client.query(`NOTIFY pgrst, 'reload schema'`)

    await client.end()

    return new Response(JSON.stringify({ status: 'migration_complete', table: 'project_subcontractors' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    try { await client.end() } catch { /* ignore */ }
    
    const message = err instanceof Error ? err.message : 'Unknown error'
    
    // If connection failed, provide the SQL for manual execution
    if (message.includes('Tenant or user not found') || message.includes('password authentication failed') || message.includes('FATAL')) {
      const sql = `-- Run this in Supabase Dashboard > SQL Editor (https://supabase.com/dashboard/project/${projectRef}/sql)
CREATE TABLE IF NOT EXISTS project_subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES task_orders(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  relevance_reason TEXT,
  matched_requirements TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'matched' CHECK (status IN ('matched', 'shortlisted', 'invited', 'quoted', 'awarded', 'rejected', 'removed')),
  source TEXT DEFAULT 'ai_match' CHECK (source IN ('ai_match', 'auto_discover', 'manual', 'sow_tracker')),
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_order_id, subcontractor_id)
);
CREATE INDEX IF NOT EXISTS idx_project_subs_task_order ON project_subcontractors(task_order_id);
CREATE INDEX IF NOT EXISTS idx_project_subs_subcontractor ON project_subcontractors(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_project_subs_status ON project_subcontractors(status);
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_subs_select" ON project_subcontractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_subs_insert" ON project_subcontractors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "project_subs_update" ON project_subcontractors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "project_subs_delete" ON project_subcontractors FOR DELETE TO authenticated USING (true);
CREATE POLICY "project_subs_service_role" ON project_subcontractors FOR ALL TO service_role USING (true);`

      return new Response(JSON.stringify({
        status: 'db_connection_failed',
        error: message,
        manual_migration_needed: true,
        sql,
        instructions: `Database password not available. Please add SUPABASE_DB_PASSWORD to Netlify env vars, or run the SQL above in the Supabase Dashboard SQL Editor.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ status: 'error', error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
