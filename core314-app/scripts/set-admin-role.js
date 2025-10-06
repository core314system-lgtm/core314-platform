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

async function setAdminRole() {
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      process.exit(1);
    }

    console.log(`Current role: ${profile.role}`);

    if (profile.role === 'admin') {
      console.log('✅ User already has admin role');
      process.exit(0);
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error('Error updating role:', updateError);
      process.exit(1);
    }

    console.log('✅ Successfully updated role to admin');

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

setAdminRole();
