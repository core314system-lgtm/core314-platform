import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY - admin platform requires service role access');
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
