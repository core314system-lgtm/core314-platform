const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = fs.readFileSync('/tmp/service_key_new.txt', 'utf8').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('🔍 Verifying tables are now accessible via API...\n');
  
  const tables = ['beta_users', 'beta_events', 'beta_feedback', 'user_churn_scores', 'system_reliability_events', 'user_quality_scores'];
  
  let successCount = 0;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log('❌', table + ':', error.message);
    } else {
      console.log('✅', table + ': accessible via API');
      successCount++;
    }
  }
  
  console.log('\n📊 Result:', successCount, '/', tables.length, 'tables accessible\n');
  
  if (successCount === tables.length) {
    console.log('✅ All tables are now properly exposed! Ready to seed demo data.\n');
  } else {
    console.log('⚠️  Some tables are still not accessible. May need to wait for schema cache refresh.\n');
  }
})();
