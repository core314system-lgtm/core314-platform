import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it in your environment or pass it as: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/run-migration-programmatic.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQLDirectly(sql) {
  console.log('\n🔄 Attempting direct SQL execution via PostgREST...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️  PostgREST RPC failed (${response.status}): ${errorText}`);
      return false;
    }

    console.log('✅ Migration executed successfully via PostgREST RPC');
    return true;
  } catch (error) {
    console.log(`⚠️  PostgREST RPC error: ${error.message}`);
    return false;
  }
}

async function executeSQLViaFunction(sql) {
  console.log('\n🔄 Creating and executing via custom SQL executor function...');
  
  try {
    const createExecutorSQL = `
      CREATE OR REPLACE FUNCTION execute_migration_sql(sql_text TEXT)
      RETURNS TEXT AS $$
      BEGIN
        EXECUTE sql_text;
        RETURN 'SUCCESS';
      EXCEPTION WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: createError } = await supabase.rpc('execute_migration_sql', {
      sql_text: createExecutorSQL
    });

    if (createError) {
      console.log(`⚠️  Failed to create executor function: ${createError.message}`);
      return false;
    }

    const { data, error: execError } = await supabase.rpc('execute_migration_sql', {
      sql_text: sql
    });

    if (execError) {
      console.log(`⚠️  Migration execution failed: ${execError.message}`);
      return false;
    }

    if (data && data.startsWith('ERROR:')) {
      console.log(`⚠️  Migration returned error: ${data}`);
      return false;
    }

    console.log('✅ Migration executed successfully via custom function');
    return true;
  } catch (error) {
    console.log(`⚠️  Custom function error: ${error.message}`);
    return false;
  }
}

async function runMigration(migrationFile) {
  console.log(`\n📄 Reading migration file: ${migrationFile}`);
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log(`\n📊 Migration file stats:`);
  console.log(`   - File size: ${sql.length} characters`);
  console.log(`   - Lines: ${sql.split('\n').length}`);
  console.log(`\n📝 SQL Preview (first 300 chars):\n${sql.substring(0, 300)}...\n`);

  let success = await executeSQLDirectly(sql);
  
  if (!success) {
    console.log('\n🔄 Trying alternative execution method...');
    success = await executeSQLViaFunction(sql);
  }

  if (!success) {
    console.log('\n❌ All execution methods failed.');
    console.log('\n📋 Manual execution required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ygvkegcstaowikessigx/sql/new');
    console.log(`2. Copy contents of: ${migrationPath}`);
    console.log('3. Paste and click "Run"');
    console.log('4. After running, execute: NOTIFY pgrst, \'reload schema\';');
    return false;
  }

  return true;
}

async function verifyTables() {
  console.log('\n🔍 Verifying tables exist and are accessible...');
  
  try {
    const { data: metricsTest, error: metricsError } = await supabase
      .from('fusion_metrics')
      .select('id')
      .limit(1);

    if (metricsError) {
      console.log(`❌ fusion_metrics table: ${metricsError.message}`);
      return false;
    }

    const { data: scoresTest, error: scoresError } = await supabase
      .from('fusion_scores')
      .select('id')
      .limit(1);

    if (scoresError) {
      console.log(`❌ fusion_scores table: ${scoresError.message}`);
      return false;
    }

    console.log('✅ fusion_metrics table: Accessible');
    console.log('✅ fusion_scores table: Accessible');
    return true;
  } catch (error) {
    console.error(`❌ Table verification failed: ${error.message}`);
    return false;
  }
}

async function triggerSchemaRefresh() {
  console.log('\n🔄 Triggering PostgREST schema cache refresh...');
  
  try {
    const { error } = await supabase.rpc('notify', {
      channel: 'pgrst',
      payload: 'reload schema'
    });

    if (error) {
      console.log('⚠️  Schema refresh notification failed (this is normal if notify function doesn\'t exist)');
      console.log('   Please run in SQL Editor: NOTIFY pgrst, \'reload schema\';');
      return false;
    }

    console.log('✅ Schema refresh notification sent');
    return true;
  } catch (error) {
    console.log('⚠️  Schema refresh failed (this is normal)');
    console.log('   Please run in SQL Editor: NOTIFY pgrst, \'reload schema\';');
    return false;
  }
}

async function main() {
  console.log('🚀 Core314 Programmatic Migration Runner');
  console.log('==========================================');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Service Role Key: ${serviceRoleKey.substring(0, 20)}...`);

  const tablesExist = await verifyTables();

  if (tablesExist) {
    console.log('\n✅ Tables already exist! Migration may have been applied previously.');
    console.log('\n💡 If you\'re experiencing schema cache issues:');
    console.log('   1. Run in SQL Editor: NOTIFY pgrst, \'reload schema\';');
    console.log('   2. Or restart PostgREST in Supabase dashboard');
    console.log('   3. Wait up to 60 seconds for cache to refresh');
    process.exit(0);
  }

  console.log('\n⚠️  Tables not found. Proceeding with migration...');

  const migrationSuccess = await runMigration('004_fusion_scoring.sql');

  if (!migrationSuccess) {
    console.log('\n❌ Migration failed. Please apply manually.');
    process.exit(1);
  }

  await triggerSchemaRefresh();

  console.log('\n⏳ Waiting 5 seconds for schema cache to refresh...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const verifySuccess = await verifyTables();

  if (verifySuccess) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ All tables are accessible via Supabase client');
    console.log('\n🚀 Next steps:');
    console.log('   1. Test the Fusion Scoring Layer in the dashboard');
    console.log('   2. Click "Sync Data" to populate metrics');
    console.log('   3. Verify fusion scores display correctly');
  } else {
    console.log('\n⚠️  Migration executed but tables not accessible yet.');
    console.log('PostgREST schema cache may need more time to refresh.');
    console.log('\n📋 To complete the setup:');
    console.log('1. Run in SQL Editor: NOTIFY pgrst, \'reload schema\';');
    console.log('2. Wait 30-60 seconds');
    console.log('3. Reload your dashboard');
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
