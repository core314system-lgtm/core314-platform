import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

export default async (req: Request, _context: Context) => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if table already exists by trying to query it
  const { error: checkErr } = await supabase
    .from('teaming_agreements')
    .select('id')
    .limit(1)

  if (!checkErr) {
    return new Response(JSON.stringify({ status: 'table_exists' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Table doesn't exist - provide the SQL to create it
  const migrationSQL = `
CREATE TABLE IF NOT EXISTS teaming_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  partner_name text NOT NULL,
  partner_role text DEFAULT 'prime',
  our_role text DEFAULT 'sub',
  workshare_percent numeric DEFAULT 0,
  naics_codes text[] DEFAULT '{}'::text[],
  certifications text[] DEFAULT '{}'::text[],
  agreement_status text DEFAULT 'prospective',
  agreement_date date,
  expiration_date date,
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teaming_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY teaming_org_access ON teaming_agreements FOR ALL
  USING (org_id IN (SELECT current_org_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM profiles WHERE id = auth.uid()));
  `

  return new Response(JSON.stringify({
    status: 'table_missing',
    hint: 'Run the following SQL in the Supabase Dashboard SQL editor',
    sql: migrationSQL
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
