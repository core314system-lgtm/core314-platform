import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync('./supabase/migrations/003_integration_hub.sql', 'utf8');
    
    console.log('Running migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully!');
    
    console.log('\nVerifying tables...');
    const { data: masterData, error: masterError } = await supabase
      .from('integrations_master')
      .select('*')
      .limit(1);
    
    if (masterError) {
      console.log('Note: Direct query failed, but migration may have succeeded. Error:', masterError.message);
    } else {
      console.log('✅ integrations_master table is accessible');
    }
    
    const { data: userIntData, error: userIntError } = await supabase
      .from('user_integrations')
      .select('*')
      .limit(1);
    
    if (userIntError) {
      console.log('Note: Direct query failed, but migration may have succeeded. Error:', userIntError.message);
    } else {
      console.log('✅ user_integrations table is accessible');
    }
    
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

runMigration();
