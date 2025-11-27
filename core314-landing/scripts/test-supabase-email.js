import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 Testing Supabase Custom SMTP configuration...');
console.log('📧 Sending password reset email to core314system@gmail.com...');

const { data, error } = await supabase.auth.resetPasswordForEmail(
  'core314system@gmail.com',
  {
    redirectTo: 'https://core314.com/reset-password'
  }
);

if (error) {
  console.error('❌ Failed to send Supabase email:', error);
  process.exit(1);
}

console.log('✅ Supabase email sent successfully!');
console.log('Timestamp:', new Date().toISOString());
console.log('\n📋 Next steps:');
console.log('1. Check core314system@gmail.com inbox');
console.log('2. Verify From header shows: "Core314 Systems <support@core314.com>"');
console.log('3. Check SendGrid Activity dashboard for delivery confirmation');
