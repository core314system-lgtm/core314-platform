#!/usr/bin/env node

/**
 * Core314 Demo Data Seeding Script
 * Creates demo users in auth.users and profiles, then seeds all related tables
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function promptForSecret(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(promptText);
    
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let secret = '';
    
    stdin.on('data', (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeAllListeners('data');
        process.stdout.write('\n');
        rl.close();
        resolve(secret);
      } else if (char === '\u0003') {
        process.stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007f' || char === '\b') {
        if (secret.length > 0) {
          secret = secret.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        secret += char;
        process.stdout.write('*');
      }
    });
  });
}

const args = process.argv.slice(2);
const serviceRoleKeyArg = args.find(arg => arg.startsWith('--service-role='))?.split('=')[1];

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
let SUPABASE_SERVICE_ROLE_KEY = serviceRoleKeyArg || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.log('🔐 Supabase Service Role Key not found in environment.');
  console.log('Please paste your Service Role Key (input will be masked):');
  SUPABASE_SERVICE_ROLE_KEY = await promptForSecret('Service Role Key: ');
  
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.trim().length === 0) {
    console.error('\n❌ Service Role Key is required to proceed.');
    process.exit(1);
  }
  
  console.log('✅ Service Role Key received (stored in memory only).\n');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEMO_USERS = [
  { number: 1, email: 'demo_user_1@example.com', name: 'Demo User 1', verified: true },
  { number: 2, email: 'demo_user_2@example.com', name: 'Demo User 2', verified: true },
  { number: 3, email: 'demo_user_3@example.com', name: 'Demo User 3', verified: true },
  { number: 4, email: 'demo_user_4@example.com', name: 'Demo User 4', verified: true },
  { number: 5, email: 'demo_user_5@example.com', name: 'Demo User 5', verified: true },
  { number: 6, email: 'demo_user_6@example.com', name: 'Demo User 6', verified: true },
  { number: 7, email: 'demo_user_7@example.com', name: 'Demo User 7', verified: true },
  { number: 8, email: 'demo_user_8@example.com', name: 'Demo User 8', verified: true },
  { number: 9, email: 'demo_user_9@example.com', name: 'Demo User 9', verified: false },
  { number: 10, email: 'demo_user_10@example.com', name: 'Demo User 10', verified: false },
];

async function createDemoUsers() {
  console.log('🚀 Starting Core314 demo data seeding...\n');
  
  const createdUsers = [];
  const baseTimestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  console.log('📝 Step 1: Creating demo users in auth.users and profiles...');
  
  for (const user of DEMO_USERS) {
    try {
      const createdAt = new Date(baseTimestamp.getTime() + (user.number * 2 * 24 * 60 * 60 * 1000) + (Math.random() * 12 * 60 * 60 * 1000));
      
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'DemoPassword123!', // Temporary password for demo users
        email_confirm: user.verified,
        user_metadata: {
          full_name: user.name,
          role: 'beta'
        }
      });

      if (authError) {
        if (authError.message && (authError.message.includes('already registered') || authError.message.includes('already been registered'))) {
          console.log(`   ⚠️  User ${user.email} already exists in auth.users`);
          
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const existingAuthUser = authUsers.users.find(u => u.email === user.email);
          
          if (existingAuthUser) {
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: existingAuthUser.id,
                email: user.email,
                full_name: user.name,
                created_at: createdAt.toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });
            
            if (profileError) {
              console.error(`   ❌ Error creating profile for ${user.email}:`, profileError.message);
            } else {
              console.log(`   ✅ Created/updated profile: ${user.name}`);
            }
            
            createdUsers.push({
              id: existingAuthUser.id,
              email: user.email,
              name: user.name,
              number: user.number
            });
          }
        } else {
          console.error(`   ❌ Error creating auth user ${user.email}:`, authError.message);
        }
        continue;
      }

      console.log(`   ✅ Created auth user: ${user.email} (${authUser.user.id})`);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          email: user.email,
          full_name: user.name,
          created_at: createdAt.toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError && !profileError.message.includes('duplicate key')) {
        throw profileError;
      }

      createdUsers.push({
        id: authUser.user.id,
        email: user.email,
        name: user.name,
        number: user.number
      });

      console.log(`   ✅ Created profile: ${user.name}`);
      
    } catch (error) {
      console.error(`   ❌ Unexpected error for ${user.email}:`, error.message);
    }
  }

  console.log(`\n✅ Created ${createdUsers.length} demo users\n`);

  console.log('📝 Step 2: Seeding beta_users table...');
  await seedBetaUsers(createdUsers);

  console.log('\n📝 Step 3: Seeding fusion automation events...');
  await seedAutomationEvents(createdUsers);

  console.log('\n📝 Step 4: Seeding integration events...');
  await seedIntegrationEvents(createdUsers);

  console.log('\n📝 Step 5: Seeding system reliability events...');
  await seedReliabilityEvents(createdUsers);

  console.log('\n📝 Step 6: Seeding churn scores...');
  await seedChurnScores(createdUsers);

  console.log('\n📝 Step 7: Seeding user quality scores...');
  await seedQualityScores(createdUsers);

  console.log('\n📝 Step 8: Seeding beta events...');
  await seedBetaEvents(createdUsers);

  console.log('\n📝 Step 9: Seeding beta feedback...');
  await seedBetaFeedback(createdUsers);

  console.log('\n📊 Validation Summary:');
  await validateSeeding(createdUsers);

  console.log('\n📋 Demo User IDs:');
  console.log('================');
  createdUsers.forEach(user => {
    console.log(`${user.number}. ${user.email}`);
    console.log(`   UUID: ${user.id}`);
  });

  console.log('\n✅ Demo data seeding complete!');
  console.log('\n🔗 View in admin dashboard: https://admin.core314.com/beta-ops');
}

async function seedBetaUsers(users) {
  const baseTimestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  for (const user of users) {
    const createdAt = new Date(baseTimestamp.getTime() + (user.number * 2 * 24 * 60 * 60 * 1000));
    const onboardingCompleted = user.number <= 7 ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000 + Math.random() * 6 * 60 * 60 * 1000) : null;
    
    const { error } = await supabase
      .from('beta_users')
      .upsert({
        user_id: user.id,
        signup_at: createdAt.toISOString(),
        onboarding_completed: user.number <= 7,
        onboarding_completed_at: onboardingCompleted ? onboardingCompleted.toISOString() : null,
        created_at: createdAt.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error(`   ❌ Error seeding beta_user ${user.email}:`, error.message);
    else console.log(`   ✅ Seeded beta_user: ${user.email}`);
  }
}

async function seedAutomationEvents(users) {
  for (const user of users.slice(0, 7)) {
    const createdAt = new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('fusion_automation_events')
      .insert({
        user_id: user.id,
        event_type: 'automation_created',
        event_name: 'automation_created',
        metadata: {
          automation_name: `Demo Workflow ${user.number}`,
          automation_type: ['scheduled', 'triggered', 'manual'][user.number % 3],
          steps_count: 3 + Math.floor(Math.random() * 5)
        },
        created_at: createdAt.toISOString()
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`   ❌ Error seeding automation event for ${user.email}:`, error.message);
    } else {
      console.log(`   ✅ Seeded automation event: ${user.email}`);
    }
  }
}

async function seedIntegrationEvents(users) {
  const providers = ['slack', 'google', 'github', 'stripe', 'sendgrid', 'asana'];
  
  for (let i = 0; i < 6; i++) {
    const user = users[i];
    const createdAt = new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('integration_events')
      .insert({
        user_id: user.id,
        service_name: providers[i],
        event_type: 'integration_connected',
        status: 'success',
        payload: {
          integration_id: crypto.randomUUID(),
          scopes: ['read', 'write']
        },
        created_at: createdAt.toISOString()
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`   ❌ Error seeding integration event for ${user.email}:`, error.message);
    } else {
      console.log(`   ✅ Seeded integration event: ${user.email} (${providers[i]})`);
    }
  }
}

async function seedReliabilityEvents(users) {
  const eventTypes = ['latency_spike', 'error', 'auth_failure'];
  const modules = ['dashboard', 'automation_engine', 'signup'];
  const severities = ['warning', 'error'];
  const messages = [
    'High latency detected in API response',
    'Failed to fetch user data',
    'Authentication token expired'
  ];
  
  let count = 0;
  for (let i = 0; i < 20; i++) {
    const createdAt = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('system_reliability_events')
      .insert({
        event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        module: modules[Math.floor(Math.random() * modules.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        latency_ms: Math.floor(500 + Math.random() * 1900),
        http_status: [500, 503, 401][Math.floor(Math.random() * 3)],
        created_at: createdAt.toISOString()
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`   ❌ Error seeding reliability event:`, error.message);
    } else {
      count++;
    }
  }
  console.log(`   ✅ Seeded ${count} reliability events`);
}

async function seedChurnScores(users) {
  for (const user of users) {
    let churnScore;
    
    if (user.number <= 2) {
      churnScore = 0.85 + Math.random() * 0.07;
    }
    else if (user.number <= 5) {
      churnScore = 0.50 + Math.random() * 0.30;
    }
    else {
      churnScore = 0.10 + Math.random() * 0.35;
    }
    
    const { error } = await supabase
      .from('user_churn_scores')
      .upsert({
        user_id: user.id,
        churn_score: churnScore,
        last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        sessions_last_7d: Math.floor(Math.random() * 20),
        events_last_7d: Math.floor(Math.random() * 100),
        streak_days: Math.floor(Math.random() * 30),
        prediction_reason: churnScore > 0.7 ? 'Low activity and engagement' : churnScore > 0.4 ? 'Moderate engagement' : 'High engagement',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error(`   ❌ Error seeding churn score for ${user.email}:`, error.message);
    else console.log(`   ✅ Seeded churn score: ${user.email} (score: ${churnScore.toFixed(2)})`);
  }
}

async function seedQualityScores(users) {
  for (const user of users) {
    const onboardingScore = user.number <= 7 ? 100 : Math.floor(Math.random() * 50);
    const activityScore = Math.floor(40 + Math.random() * 60);
    const featureUsageScore = Math.floor(30 + Math.random() * 70);
    
    const { error } = await supabase
      .from('user_quality_scores')
      .upsert({
        user_id: user.id,
        onboarding_score: onboardingScore,
        activity_score: activityScore,
        feature_usage_score: featureUsageScore,
        last_calculated_at: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error(`   ❌ Error seeding quality score for ${user.email}:`, error.message);
    else console.log(`   ✅ Seeded quality score: ${user.email}`);
  }
}

async function seedBetaEvents(users) {
  const eventTypes = ['page_view', 'feature_used', 'button_click', 'form_submit', 'navigation'];
  const eventNames = ['dashboard_visit', 'automation_created', 'settings_updated', 'integration_connected', 'profile_viewed'];
  const pages = ['/dashboard', '/automations', '/integrations', '/settings'];
  
  let count = 0;
  for (const user of users) {
    for (let i = 0; i < 4; i++) {
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      const { error } = await supabase
        .from('beta_events')
        .insert({
          user_id: user.id,
          event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          event_name: eventNames[Math.floor(Math.random() * eventNames.length)],
          metadata: {
            page: pages[Math.floor(Math.random() * pages.length)],
            duration_ms: Math.floor(1000 + Math.random() * 5000)
          },
          created_at: createdAt.toISOString()
        });

      if (error && !error.message.includes('duplicate')) {
        console.error(`   ❌ Error seeding beta event:`, error.message);
      } else {
        count++;
      }
    }
  }
  console.log(`   ✅ Seeded ${count} beta events`);
}

async function seedBetaFeedback(users) {
  const categories = ['Bug', 'Feature Request', 'UI/UX', 'Praise'];
  const messages = [
    'The automation builder is very intuitive and easy to use!',
    'Would love to see more integration options, especially for Notion.',
    'Dashboard loads slowly sometimes, especially in the morning.',
    'Great product! The AI recommendations are spot on.'
  ];
  
  for (let i = 0; i < 5; i++) {
    const user = users[i];
    const createdAt = new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('beta_feedback')
      .insert({
        user_id: user.id,
        category: categories[i % categories.length],
        message: messages[i % messages.length],
        resolved: Math.random() > 0.5,
        created_at: createdAt.toISOString()
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`   ❌ Error seeding feedback for ${user.email}:`, error.message);
    } else {
      console.log(`   ✅ Seeded feedback: ${user.email}`);
    }
  }
}

async function validateSeeding(users) {
  const userIds = users.map(u => u.id);
  
  const { count: profilesCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('id', userIds);
  
  const { count: betaUsersCount } = await supabase
    .from('beta_users')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: automationCount } = await supabase
    .from('fusion_automation_events')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: integrationCount } = await supabase
    .from('integration_events')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: reliabilityCount } = await supabase
    .from('system_reliability_events')
    .select('*', { count: 'exact', head: true });
  
  const { count: churnCount } = await supabase
    .from('user_churn_scores')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: qualityCount } = await supabase
    .from('user_quality_scores')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: eventsCount } = await supabase
    .from('beta_events')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  const { count: feedbackCount } = await supabase
    .from('beta_feedback')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);
  
  console.log(`   Profiles: ${profilesCount}`);
  console.log(`   Beta users: ${betaUsersCount}`);
  console.log(`   Automation events: ${automationCount}`);
  console.log(`   Integration events: ${integrationCount}`);
  console.log(`   Reliability events: ${reliabilityCount}`);
  console.log(`   Churn scores: ${churnCount}`);
  console.log(`   Quality scores: ${qualityCount}`);
  console.log(`   Beta events: ${eventsCount}`);
  console.log(`   Feedback entries: ${feedbackCount}`);
}

createDemoUsers().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
