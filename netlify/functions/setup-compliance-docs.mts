import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.TASKORDER_SUPABASE_URL || "https://psmicdfnvgwsjkhkwoub.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY!
)

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  }

  try {
    // Check if table already exists
    const { error: checkErr } = await supabase
      .from("sub_compliance_docs")
      .select("id")
      .limit(1)

    if (!checkErr) {
      return new Response(JSON.stringify({ status: "tables_exist" }), { headers })
    }

    // Use pg to create tables (PostgREST doesn't support DDL)
    const pg = await import("pg")
    const pool = new pg.default.Pool({
      host: "db.psmicdfnvgwsjkhkwoub.supabase.co",
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })

    await pool.query(`
      -- Required compliance document definitions (prime sets these per project/SOW)
      CREATE TABLE IF NOT EXISTS required_compliance_docs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        task_order_id UUID NOT NULL,
        sow_item_id UUID,
        doc_type TEXT NOT NULL,
        doc_label TEXT NOT NULL,
        is_required BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- Subcontractor uploaded compliance documents
      CREATE TABLE IF NOT EXISTS sub_compliance_docs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        subcontractor_id UUID NOT NULL,
        task_order_id UUID NOT NULL,
        sow_item_id UUID,
        doc_type TEXT NOT NULL CHECK (doc_type IN (
          'coi', 'license', 'w9', 'bonding', 'safety', 'quality',
          'trade_cert', 'insurance_gl', 'insurance_wc', 'insurance_auto',
          'insurance_umbrella', 'sam_registration', 'sba_cert', 'other'
        )),
        doc_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        expiration_date DATE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
        reviewer_notes TEXT,
        uploaded_at TIMESTAMPTZ DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_sub_compliance_docs_sub ON sub_compliance_docs(subcontractor_id);
      CREATE INDEX IF NOT EXISTS idx_sub_compliance_docs_to ON sub_compliance_docs(task_order_id);
      CREATE INDEX IF NOT EXISTS idx_sub_compliance_docs_sow ON sub_compliance_docs(sow_item_id);
      CREATE INDEX IF NOT EXISTS idx_required_compliance_docs_to ON required_compliance_docs(task_order_id);

      -- Enable RLS
      ALTER TABLE sub_compliance_docs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE required_compliance_docs ENABLE ROW LEVEL SECURITY;

      -- Policies - allow service role full access, authenticated users can read
      DO $$ BEGIN
        CREATE POLICY sub_compliance_docs_all ON sub_compliance_docs FOR ALL TO authenticated USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      
      DO $$ BEGIN
        CREATE POLICY required_compliance_docs_all ON required_compliance_docs FOR ALL TO authenticated USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Also allow service_role (for portal API functions)
      DO $$ BEGIN
        CREATE POLICY sub_compliance_docs_service ON sub_compliance_docs FOR ALL TO service_role USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      
      DO $$ BEGIN
        CREATE POLICY required_compliance_docs_service ON required_compliance_docs FOR ALL TO service_role USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Also update sow_communications check constraint to add clarification_request
      ALTER TABLE sow_communications DROP CONSTRAINT IF EXISTS sow_communications_comm_type_check;
      ALTER TABLE sow_communications ADD CONSTRAINT sow_communications_comm_type_check 
        CHECK (comm_type IN ('rfq_sent', 'question', 'response', 'follow_up', 'quote_received', 
          'clarification', 'clarification_request', 'award_notice', 'decline_notice', 'note', 'gap_resolution'));
    `)

    await pool.end()

    return new Response(JSON.stringify({ status: "tables_created" }), { headers })
  } catch (err: any) {
    console.error("Setup error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
