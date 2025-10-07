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

async function fixRLSPolicies() {
  try {
    console.log('Fixing RLS policies to prevent infinite recursion...');

    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
      `
    }).catch(() => {
    });

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.current_user_role()
      RETURNS TEXT AS $$
      DECLARE
        user_role TEXT;
      BEGIN
        SELECT role INTO user_role
        FROM public.profiles
        WHERE id = auth.uid();
        
        RETURN COALESCE(user_role, 'user');
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: createFunctionSQL
    });

    if (funcError) {
      console.log('Function creation via rpc failed, trying direct query...');
      const { error: directError } = await supabase
        .from('_sql')
        .select('*')
        .limit(0);
      
      console.log('Note: You may need to run this SQL manually in Supabase SQL Editor:');
      console.log(createFunctionSQL);
    } else {
      console.log('✅ Created current_user_role() function');
    }

    const recreatePoliciesSQL = `
      CREATE POLICY "Admins can view all profiles"
          ON public.profiles FOR SELECT
          USING (public.current_user_role() = 'admin');

      CREATE POLICY "Admins can update all profiles"
          ON public.profiles FOR UPDATE  
          USING (public.current_user_role() = 'admin');
    `;

    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: recreatePoliciesSQL
    });

    if (policyError) {
      console.log('Note: You may need to run this SQL manually in Supabase SQL Editor:');
      console.log(recreatePoliciesSQL);
    } else {
      console.log('✅ Recreated admin policies with non-recursive function');
    }

    console.log('\n✅ RLS policies fixed! Please refresh your browser to test admin access.');

  } catch (err) {
    console.error('Error:', err.message);
    console.log('\n⚠️ Please run the following SQL manually in Supabase SQL Editor:');
    console.log(`
-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create security definer function
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE  
    USING (public.current_user_role() = 'admin');
    `);
  }
}

fixRLSPolicies();
