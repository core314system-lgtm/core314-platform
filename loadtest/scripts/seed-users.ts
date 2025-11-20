#!/usr/bin/env ts-node
/**
 * Seed Test Users for Load Testing
 * Creates 1,000 test users with mixed plan tiers and generates fixture file
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PLAN_DISTRIBUTION = {
  Starter: 600,
  Pro: 300,
  Enterprise: 100,
};

interface TestUser {
  email: string;
  password: string;
  plan: string;
  userId?: string;
  stripeCustomerId?: string;
}

async function seedUsers() {
  console.log('🌱 Starting user seeding process...');
  
  const users: TestUser[] = [];
  let userIndex = 0;

  for (const [plan, count] of Object.entries(PLAN_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      userIndex++;
      users.push({
        email: `loadtest+${userIndex}@core314.com`,
        password: 'LoadTest2025!',
        plan,
      });
    }
  }

  console.log(`📊 Generated ${users.length} test users`);
  console.log(`   - Starter: ${PLAN_DISTRIBUTION.Starter}`);
  console.log(`   - Pro: ${PLAN_DISTRIBUTION.Pro}`);
  console.log(`   - Enterprise: ${PLAN_DISTRIBUTION.Enterprise}`);

  const BATCH_SIZE = 50;
  const createdUsers: TestUser[] = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}...`);

    for (const user of batch) {
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (authError) {
          console.error(`❌ Failed to create user ${user.email}:`, authError.message);
          continue;
        }

        if (!authData.user) {
          console.error(`❌ No user data returned for ${user.email}`);
          continue;
        }

        user.userId = authData.user.id;
        user.stripeCustomerId = `cus_loadtest_${user.userId.substring(0, 8)}`;

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            stripe_customer_id: user.stripeCustomerId,
            full_name: `Load Test User ${i + batch.indexOf(user) + 1}`,
          })
          .eq('id', user.userId);

        if (profileError) {
          console.error(`⚠️  Failed to update profile for ${user.email}:`, profileError.message);
        }

        if (user.plan !== 'Free') {
          const { error: subError } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: user.userId,
              plan_name: user.plan,
              stripe_subscription_id: `sub_loadtest_${user.userId.substring(0, 8)}`,
              stripe_customer_id: user.stripeCustomerId,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            });

          if (subError) {
            console.error(`⚠️  Failed to create subscription for ${user.email}:`, subError.message);
          }

          const { error: limitsError } = await supabase.rpc('apply_plan_limits', {
            p_user_id: user.userId,
            p_plan_name: user.plan,
          });

          if (limitsError) {
            console.error(`⚠️  Failed to apply plan limits for ${user.email}:`, limitsError.message);
          }
        }

        createdUsers.push(user);
        process.stdout.write('.');
      } catch (error) {
        console.error(`❌ Error creating user ${user.email}:`, error);
      }
    }

    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n\n✅ Successfully created ${createdUsers.length}/${users.length} users`);

  const fixturePath = path.join(__dirname, '../k6/users.seed.json');
  fs.writeFileSync(fixturePath, JSON.stringify(createdUsers, null, 2));
  console.log(`📝 Wrote user fixture to ${fixturePath}`);

  const summary = {
    total: createdUsers.length,
    byPlan: {
      Starter: createdUsers.filter(u => u.plan === 'Starter').length,
      Pro: createdUsers.filter(u => u.plan === 'Pro').length,
      Enterprise: createdUsers.filter(u => u.plan === 'Enterprise').length,
    },
    timestamp: new Date().toISOString(),
  };

  console.log('\n📊 Seeding Summary:');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

seedUsers()
  .then(() => {
    console.log('\n🎉 User seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ User seeding failed:', error);
    process.exit(1);
  });
