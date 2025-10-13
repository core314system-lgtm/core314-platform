import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODI3NjksImV4cCI6MjA3NTI1ODc2OX0.OcPNK8fHBzMCdOWmg2nq8KLa5LN4wHQW_uRFqm-aCpk';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing Fusion Table Access');
console.log('================================\n');

async function testAnonAccess() {
  console.log('📋 Test 1: Anon Key Access (same as frontend)');
  const supabase = createClient(supabaseUrl, anonKey);

  try {
    const { data: metricsData, error: metricsError } = await supabase
      .from('fusion_metrics')
      .select('*')
      .limit(1);

    if (metricsError) {
      console.log('❌ fusion_metrics error:', metricsError.message);
      console.log('   Code:', metricsError.code);
      console.log('   Details:', JSON.stringify(metricsError.details, null, 2));
      console.log('   Hint:', metricsError.hint);
    } else {
      console.log('✅ fusion_metrics accessible');
      console.log('   Rows returned:', metricsData?.length || 0);
    }

    const { data: scoresData, error: scoresError } = await supabase
      .from('fusion_scores')
      .select('*')
      .limit(1);

    if (scoresError) {
      console.log('❌ fusion_scores error:', scoresError.message);
      console.log('   Code:', scoresError.code);
      console.log('   Details:', JSON.stringify(scoresError.details, null, 2));
      console.log('   Hint:', scoresError.hint);
    } else {
      console.log('✅ fusion_scores accessible');
      console.log('   Rows returned:', scoresData?.length || 0);
    }

    return !metricsError && !scoresError;
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

async function testServiceRoleAccess() {
  if (!serviceRoleKey) {
    console.log('\n⚠️  Skipping service role test (key not provided)');
    return true;
  }

  console.log('\n📋 Test 2: Service Role Key Access (admin level)');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: metricsData, error: metricsError } = await supabase
      .from('fusion_metrics')
      .select('*')
      .limit(1);

    if (metricsError) {
      console.log('❌ fusion_metrics error:', metricsError.message);
      return false;
    } else {
      console.log('✅ fusion_metrics accessible via service role');
      console.log('   Rows returned:', metricsData?.length || 0);
    }

    const { data: scoresData, error: scoresError } = await supabase
      .from('fusion_scores')
      .select('*')
      .limit(1);

    if (scoresError) {
      console.log('❌ fusion_scores error:', scoresError.message);
      return false;
    } else {
      console.log('✅ fusion_scores accessible via service role');
      console.log('   Rows returned:', scoresData?.length || 0);
    }

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

async function testRawHTTP() {
  console.log('\n📋 Test 3: Raw HTTP Request (bypass Supabase client)');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/fusion_metrics?select=*&limit=1`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    console.log('HTTP Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Raw HTTP request successful');
      console.log('   Rows returned:', data?.length || 0);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Raw HTTP request failed');
      console.log('   Response:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Raw HTTP error:', error.message);
    return false;
  }
}

async function main() {
  const anonSuccess = await testAnonAccess();
  const serviceSuccess = await testServiceRoleAccess();
  const httpSuccess = await testRawHTTP();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log('Anon Key Access:', anonSuccess ? '✅ PASS' : '❌ FAIL');
  console.log('Service Role Access:', serviceSuccess ? '✅ PASS' : '❌ FAIL');
  console.log('Raw HTTP Access:', httpSuccess ? '✅ PASS' : '❌ FAIL');

  if (!anonSuccess && serviceSuccess) {
    console.log('\n💡 Diagnosis: Tables exist but anon key cannot access them');
    console.log('   Possible causes:');
    console.log('   1. Schema cache not refreshed (wait longer or restart PostgREST)');
    console.log('   2. RLS policies preventing access (check policy definitions)');
    console.log('   3. User not authenticated (check auth.uid() in frontend)');
  } else if (!anonSuccess && !serviceSuccess) {
    console.log('\n💡 Diagnosis: Tables not accessible at all');
    console.log('   Possible causes:');
    console.log('   1. Migration not applied to database');
    console.log('   2. Database connection issue');
  } else if (anonSuccess) {
    console.log('\n🎉 Success! Tables are accessible via anon key');
    console.log('   The Fusion Scoring Layer should work correctly now');
  }

  process.exit(anonSuccess ? 0 : 1);
}

main();
