import type { Context } from "@netlify/functions"
import pg from "pg"

const { Client } = pg

export default async (req: Request, _context: Context) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers })
  }

  // Verify authorization via a simple shared secret
  const auth = req.headers.get("x-migration-key")
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
  if (!auth || auth !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  
  if (!dbUrl) {
    // Construct from individual parts
    const host = "aws-0-us-east-1.pooler.supabase.com"
    const port = 6543
    const password = process.env.SUPABASE_DB_PASSWORD || process.env.TASKORDER_SUPABASE_DB_PASSWORD
    const projectRef = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace("https://", "").replace(".supabase.co", "")
    
    if (!password || !projectRef) {
      return new Response(JSON.stringify({ error: "Missing DB credentials" }), { status: 500, headers })
    }

    const client = new Client({
      host,
      port,
      user: `postgres.${projectRef}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false }
    })

    try {
      await client.connect()

      await client.query(`
        CREATE TABLE IF NOT EXISTS public.ai_audit_log (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT NOT NULL,
          org_id TEXT,
          request_type TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt_tokens INTEGER DEFAULT 0,
          completion_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          task_order_id UUID,
          task_order_title TEXT,
          document_context TEXT,
          response_summary TEXT,
          latency_ms INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'success',
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)

      await client.query("CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON public.ai_audit_log(created_at DESC);")
      await client.query("CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user_id ON public.ai_audit_log(user_id);")
      await client.query("CREATE INDEX IF NOT EXISTS idx_ai_audit_log_request_type ON public.ai_audit_log(request_type);")

      await client.query("ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;")

      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_log' AND policyname = 'Authenticated users can read audit log') THEN
            CREATE POLICY "Authenticated users can read audit log" ON public.ai_audit_log FOR SELECT TO authenticated USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_log' AND policyname = 'Authenticated users can insert audit log') THEN
            CREATE POLICY "Authenticated users can insert audit log" ON public.ai_audit_log FOR INSERT TO authenticated WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_log' AND policyname = 'Service role full access') THEN
            CREATE POLICY "Service role full access" ON public.ai_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
          END IF;
        END $$;
      `)

      const result = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_audit_log' AND table_schema = 'public' ORDER BY ordinal_position;"
      )

      await client.end()
      return new Response(JSON.stringify({ success: true, columns: result.rows }), { headers })
    } catch (err: unknown) {
      try { await client.end() } catch { /* ignore */ }
      const msg = err instanceof Error ? err.message : String(err)
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers })
    }
  }

  return new Response(JSON.stringify({ error: "No DB URL configured" }), { status: 500, headers })
}
