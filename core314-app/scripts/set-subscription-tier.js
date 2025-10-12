import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setSubscriptionTier(email, tier) {
  try {
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier')
      .eq('email', email)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return;
    }

    if (!profile) {
      console.error(`No profile found for email: ${email}`);
      return;
    }

    console.log(`Current tier for ${email}: ${profile.subscription_tier}`);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Error updating subscription tier:', updateError);
      return;
    }

    console.log(`Successfully updated ${email} to ${tier} tier with active status`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

const email = process.argv[2] || 'core314system@gmail.com';
const tier = process.argv[3] || 'starter';

setSubscriptionTier(email, tier);
