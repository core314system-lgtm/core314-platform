import { createClient } from '@supabase/supabase-js';
import { getValidatedEnv } from './validateEnv';

const { supabaseUrl, supabaseAnonKey } = getValidatedEnv();

console.info('🔌 Supabase client initialized successfully');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});
