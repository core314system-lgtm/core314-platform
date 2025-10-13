import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function refreshSchemaCache() {
  console.log('🔄 Triggering PostgREST schema cache refresh...\n');

  try {
    const { error } = await supabase.rpc('pg_notify', {
      channel: 'pgrst',
      payload: 'reload schema'
    });

    if (error) {
      console.log('⚠️  RPC method failed, trying direct SQL execution...');
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ 
          query: "NOTIFY pgrst, 'reload schema';" 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log('✅ Schema cache refresh triggered via direct SQL');
    } else {
      console.log('✅ Schema cache refresh triggered via RPC');
    }

    console.log('\n⏳ Waiting 10 seconds for cache to refresh...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n🔍 Verifying tables are now accessible via anon key...');
    
    const anonClient = createClient(
      supabaseUrl,
      process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODI3NjksImV4cCI6MjA3NTI1ODc2OX0.OcPNK8fHBzMCdOWmg2nq8KLa5LN4wHQW_uRFqm-aCpk'
    );

    const { data: metricsData, error: metricsError } = await anonClient
      .from('fusion_metrics')
      .select('id')
      .limit(1);

    const { data: scoresData, error: scoresError } = await anonClient
      .from('fusion_scores')
      .select('id')
      .limit(1);

    if (metricsError) {
      console.log(`❌ fusion_metrics still not accessible: ${metricsError.message}`);
      console.log('   Code:', metricsError.code);
    } else {
      console.log('✅ fusion_metrics is now accessible via anon key');
    }

    if (scoresError) {
      console.log(`❌ fusion_scores still not accessible: ${scoresError.message}`);
      console.log('   Code:', scoresError.code);
    } else {
      console.log('✅ fusion_scores is now accessible via anon key');
    }

    if (metricsError || scoresError) {
      console.log('\n⚠️  Schema cache may need more time to refresh (up to 60 seconds).');
      console.log('Try reloading the dashboard in 30-60 seconds.');
      console.log('\nAlternatively, restart the PostgREST instance in Supabase dashboard:');
      console.log('https://supabase.com/dashboard/project/ygvkegcstaowikessigx/settings/api');
      process.exit(1);
    }

    console.log('\n🎉 Schema cache successfully refreshed!');
    console.log('The Fusion Scoring Layer should now work correctly.');
    console.log('\nNext steps:');
    console.log('1. Reload the dashboard: https://deploy-preview-9--polite-mochi-fc5be5.netlify.app');
    console.log('2. Click "Sync Data" to populate metrics');
    console.log('3. Verify fusion scores display correctly');

  } catch (error) {
    console.error('❌ Error refreshing schema cache:', error.message);
    console.log('\n📋 Manual steps required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ygvkegcstaowikessigx/sql/new');
    console.log('2. Execute: NOTIFY pgrst, \'reload schema\';');
    console.log('3. Wait 30-60 seconds');
    console.log('4. Reload your dashboard');
    process.exit(1);
  }
}

refreshSchemaCache();
