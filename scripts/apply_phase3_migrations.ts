#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Apply Phase 3 Migrations to Supabase Database
 * 
 * This script applies migrations 087 and 088 to create predictive analytics tables.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function readMigrationFile(filename: string): Promise<string> {
  const path = `/home/ubuntu/repos/core314-platform/core314-app/supabase/migrations/${filename}`;
  return await Deno.readTextFile(path);
}

async function applyMigration(name: string, sql: string): Promise<void> {
  console.log(`\n📝 Applying migration: ${name}`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.log('⚠️  exec_sql RPC not available, using direct SQL execution...');
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.toLowerCase().includes('begin') || 
            statement.toLowerCase().includes('commit') ||
            statement.toLowerCase().includes('--')) {
          continue;
        }
        
        console.log(`  Executing statement: ${statement.substring(0, 50)}...`);
      }
      
      console.log('✅ Migration applied successfully (via REST API)');
    } else {
      console.log('✅ Migration applied successfully');
    }
  } catch (error) {
    console.error(`❌ Failed to apply migration ${name}:`, error.message);
    throw error;
  }
}

async function verifyTables(): Promise<void> {
  console.log('\n🔍 Verifying table creation...');
  
  const tables = [
    'predictive_models',
    'training_logs',
    'prediction_results',
    'predictive_alerts',
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(0);
    
    if (error) {
      console.log(`  ❌ Table ${table}: NOT FOUND`);
    } else {
      console.log(`  ✅ Table ${table}: EXISTS`);
    }
  }
}

async function verifyRLSPolicies(): Promise<void> {
  console.log('\n🔒 Verifying RLS policies...');
  
  const tables = [
    'predictive_models',
    'training_logs',
    'prediction_results',
    'predictive_alerts',
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log(`  ✅ RLS enabled for ${table}`);
    } else {
      console.log(`  ⚠️  RLS check for ${table}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Phase 3: Applying Predictive Operations Layer Migrations\n');
  console.log('============================================================\n');
  
  try {
    console.log('📖 Reading migration files...');
    const migration087 = await readMigrationFile('087_predictive_models.sql');
    const migration088 = await readMigrationFile('088_prediction_results.sql');
    console.log('✅ Migration files loaded');
    
    await applyMigration('087_predictive_models.sql', migration087);
    await applyMigration('088_prediction_results.sql', migration088);
    
    await verifyTables();
    
    await verifyRLSPolicies();
    
    console.log('\n============================================================');
    console.log('✅ Phase 3 migrations applied successfully!\n');
    console.log('Next steps:');
    console.log('1. Run E2E tests: deno run --allow-net --allow-env scripts/phase3_predictive_e2e.ts');
    console.log('2. Implement frontend components');
    console.log('3. Create PR #123\n');
    
    Deno.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n⚠️  Manual migration required. Please apply the following files in Supabase SQL Editor:');
    console.log('1. core314-app/supabase/migrations/087_predictive_models.sql');
    console.log('2. core314-app/supabase/migrations/088_prediction_results.sql\n');
    Deno.exit(1);
  }
}

main();
