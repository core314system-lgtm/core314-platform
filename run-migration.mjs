import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.TASKORDER_SUPABASE_URL,
  process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
)

// We can't run raw DDL through the REST API, so we'll create tables using
// the Supabase Management API (requires project access token) or
// we'll use the SQL API endpoint.

// Try using the SQL endpoint on the project directly
const projectRef = 'psmicdfnvgwsjkhkwoub'
const sql = fs.readFileSync('supabase/migration-rfq-portal.sql', 'utf-8')

// The Supabase platform exposes a /pg endpoint for SQL execution
// But only with the database password via postgres protocol.
// Since direct DB connection isn't working, let's try the Management API.

// Alternative: Use the Supabase Dashboard SQL editor endpoint
const serviceKey = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY

// Split SQL into individual statements and execute via rpc
// First, let's create a temporary function to exec arbitrary SQL
const createExecFn = `
CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS void AS $$
BEGIN
  EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

// Actually let's try the pg module with direct connection (different approach)
import pg from 'pg'
const { Client } = pg

// Try various connection strings
const configs = [
  {
    connectionString: `postgresql://postgres:${process.env.TASKORDER_SUPABASE_DB_PASSWORD}@db.psmicdfnvgwsjkhkwoub.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  },
  {
    host: 'db.psmicdfnvgwsjkhkwoub.supabase.co',
    port: 5432,
    user: 'postgres',
    password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
  {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.psmicdfnvgwsjkhkwoub`,
    password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
  {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    user: `postgres.psmicdfnvgwsjkhkwoub`,
    password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  },
]

for (const config of configs) {
  const client = new Client(config)
  try {
    console.log(`Trying: ${config.host || 'connection string'}:${config.port || ''}...`)
    await client.connect()
    console.log('Connected! Running migration...')
    await client.query(sql)
    console.log('Migration applied successfully!')
    await client.end()
    process.exit(0)
  } catch (err) {
    console.log(`Failed: ${err.message}`)
    try { await client.end() } catch {}
  }
}

console.log('\nAll direct DB connections failed. Trying Supabase REST approach...')

// Fallback: create tables one at a time using individual REST calls
// Parse the SQL and break into statements
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0)

console.log(`Found ${statements.length} SQL statements to execute`)
console.log('\nDirect DB access is required for DDL. Please run the migration manually:')
console.log('1. Go to https://supabase.com/dashboard/project/psmicdfnvgwsjkhkwoub/sql')
console.log('2. Paste the contents of supabase/migration-rfq-portal.sql')
console.log('3. Click Run')
