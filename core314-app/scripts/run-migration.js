import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY4Mjc2OSwiZXhwIjoyMDc1MjU4NzY5fQ.FoVvdFbKE7zLwsOZtNmr8fg0BktG4bgWeewNleKkBWg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const sqlPath = join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    
    console.log('\nRunning seed data...');
    const seedPath = join(__dirname, '../supabase/seed.sql');
    const seedSql = readFileSync(seedPath, 'utf8');
    
    const { error: seedError } = await supabase.rpc('exec_sql', { sql_query: seedSql });
    
    if (seedError) {
      console.error('Seed error:', seedError);
      process.exit(1);
    }
    
    console.log('Seed data completed successfully!');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

runMigration();
