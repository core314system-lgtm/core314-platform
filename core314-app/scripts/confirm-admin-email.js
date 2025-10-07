import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmAdminEmail() {
  try {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      process.exit(1);
    }

    const adminUser = users.users.find(u => u.email === 'core314system@gmail.com');
    
    if (!adminUser) {
      console.error('Admin user not found');
      process.exit(1);
    }

    console.log(`Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);
    console.log(`Email confirmed: ${adminUser.email_confirmed_at ? 'Yes' : 'No'}`);

    if (!adminUser.email_confirmed_at) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { email_confirm: true }
      );

      if (error) {
        console.error('Error confirming email:', error);
        process.exit(1);
      }

      console.log('✅ Admin email confirmed successfully!');
    } else {
      console.log('✅ Admin email already confirmed');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

confirmAdminEmail();
