const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODI3NjksImV4cCI6MjA3NTI1ODc2OX0.quryX7VE1TVE1cR-uZ4ZmjowvKE2XVoGv-1hhJg87eY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  console.log('🔍 Testing ANON key access to demo tables...\n');
  
  const tables = ['beta_users', 'beta_events', 'beta_feedback', 'user_churn_scores', 'system_reliability_events', 'user_quality_scores', 'profiles'];
  
  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' });
    
    if (error) {
      console.log('❌', table + ':', error.message);
    } else {
      console.log('✅', table + ':', count, 'rows accessible');
      if (count === 0) {
        console.log('   ⚠️  Table is accessible but contains 0 rows!');
      }
    }
  }
})();
