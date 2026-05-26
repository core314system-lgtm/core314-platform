import pg from 'pg'
import fs from 'fs'

const { Client } = pg

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.psmicdfnvgwsjkhkwoub',
  password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
})

async function run() {
  try {
    await client.connect()
    console.log('Connected to database')
    
    const sql = fs.readFileSync('supabase/schema.sql', 'utf-8')
    await client.query(sql)
    console.log('Schema applied successfully')
  } catch (err) {
    console.error('Error:', err.message)
    
    // Try transaction mode pooler on port 5432
    const client2 = new Client({
      host: 'aws-0-us-east-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.psmicdfnvgwsjkhkwoub',
      password: process.env.TASKORDER_SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    })
    
    try {
      await client2.connect()
      console.log('Connected via port 5432')
      const sql = fs.readFileSync('supabase/schema.sql', 'utf-8')
      await client2.query(sql)
      console.log('Schema applied successfully via port 5432')
    } catch (err2) {
      console.error('Error on port 5432:', err2.message)
    } finally {
      await client2.end()
    }
  } finally {
    await client.end()
  }
}

run()
