import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/confirm-user-email.js <email>');
  console.error('Example: node scripts/confirm-user-email.js user@example.com');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUserEmail() {
  try {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      process.exit(1);
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    console.log(`Found user: ${user.email} (ID: ${user.id})`);
    console.log(`Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);

    if (!user.email_confirmed_at) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );

      if (error) {
        console.error('Error confirming email:', error);
        process.exit(1);
      }

      console.log('✅ Email confirmed successfully!');
    } else {
      console.log('✅ Email already confirmed');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

confirmUserEmail();
