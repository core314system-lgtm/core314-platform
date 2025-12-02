#!/usr/bin/env node

/**
 * Core314 AI Edge Function Smoke Test Suite
 * Tests the ai-generate Edge Function with proper authentication
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate required environment variables
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL environment variable is required');
  console.error('   Set it with: export SUPABASE_URL=https://your-project.supabase.co');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY environment variable is required');
  console.error('   Set it with: export SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

// Test user from seed-demo-users.js
const TEST_USER = {
  email: 'demo_user_1@example.com',
  password: 'DemoPassword123!'
};

let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, details = '') {
  if (passed) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    testsPassed++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('🧪 Core314 AI Edge Function Smoke Test Suite\n');
  console.log('='.repeat(60));
  
  // Test 1: Create Supabase client
  console.log('\n📝 Test 1: Initialize Supabase Client');
  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    logTest('Supabase client created', true);
  } catch (error) {
    logTest('Supabase client created', false, error.message);
    return;
  }
  
  // Test 2: Authenticate user
  console.log('\n📝 Test 2: Authenticate Test User');
  let session;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    
    session = data.session;
    logTest('User authentication', true, `JWT token obtained (${session.access_token.substring(0, 20)}...)`);
  } catch (error) {
    logTest('User authentication', false, error.message);
    console.log('\n⚠️  Cannot proceed without authentication. Ensure demo users are seeded.');
    return;
  }
  
  // Test 3: Test Edge Function with valid prompt
  console.log('\n📝 Test 3: Edge Function - Valid Prompt');
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: 'Respond with exactly one word: operational',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 10
      }
    });
    
    if (error) throw error;
    if (!data || !data.text) throw new Error('No response text returned');
    
    const responseText = data.text.toLowerCase();
    const containsOperational = responseText.includes('operational');
    
    logTest('Edge Function invocation', true, `Response: "${data.text}"`);
    logTest('Response contains "operational"', containsOperational, 
      containsOperational ? 'AI responded correctly' : `Got: "${data.text}"`);
  } catch (error) {
    logTest('Edge Function invocation', false, error.message);
  }
  
  // Test 4: Test error handling - empty prompt
  console.log('\n📝 Test 4: Edge Function - Error Handling (Empty Prompt)');
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: ''
      }
    });
    
    if (error && (error.message.includes('Missing prompt') || error.message.includes('empty_prompt'))) {
      logTest('Empty prompt error handling', true, 'Correctly rejected empty prompt');
    } else if (data && data.error && (data.error.includes('Missing prompt') || data.error.includes('empty_prompt'))) {
      logTest('Empty prompt error handling', true, 'Correctly rejected empty prompt');
    } else {
      logTest('Empty prompt error handling', false, 'Should reject empty prompts');
    }
  } catch (error) {
    if (error.message.includes('Missing prompt') || error.message.includes('empty_prompt') || error.message.includes('400')) {
      logTest('Empty prompt error handling', true, 'Correctly rejected empty prompt');
    } else {
      logTest('Empty prompt error handling', false, error.message);
    }
  }
  
  // Test 5: Test embedding generation
  console.log('\n📝 Test 5: Edge Function - Embedding Generation');
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: 'test embedding',
        operation: 'embedding'
      }
    });
    
    if (error) throw error;
    if (!data || !data.embedding) throw new Error('No embedding returned');
    if (!Array.isArray(data.embedding)) throw new Error('Embedding is not an array');
    if (data.embedding.length === 0) throw new Error('Embedding array is empty');
    
    logTest('Embedding generation', true, `Generated ${data.embedding.length}-dimensional embedding`);
  } catch (error) {
    logTest('Embedding generation', false, error.message);
  }
  
  // Test 6: Test with JSON response format
  console.log('\n📝 Test 6: Edge Function - JSON Response Format');
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: 'Return a JSON object with a single key "status" set to "ok"',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }
    });
    
    if (error) throw error;
    if (!data || !data.text) throw new Error('No response text returned');
    
    const parsed = JSON.parse(data.text);
    logTest('JSON response format', true, `Parsed JSON: ${JSON.stringify(parsed)}`);
  } catch (error) {
    logTest('JSON response format', false, error.message);
  }
  
  // Test 7: Test model whitelist
  console.log('\n📝 Test 7: Edge Function - Model Whitelist');
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        prompt: 'test',
        model: 'gpt-4-turbo-preview' // Not in whitelist
      }
    });
    
    if (error && error.message.includes('not allowed')) {
      logTest('Model whitelist enforcement', true, 'Correctly rejected non-whitelisted model');
    } else if (data && data.error && data.error.includes('not allowed')) {
      logTest('Model whitelist enforcement', true, 'Correctly rejected non-whitelisted model');
    } else {
      logTest('Model whitelist enforcement', false, 'Should reject non-whitelisted models');
    }
  } catch (error) {
    if (error.message.includes('not allowed') || error.message.includes('400')) {
      logTest('Model whitelist enforcement', true, 'Correctly rejected non-whitelisted model');
    } else {
      logTest('Model whitelist enforcement', false, error.message);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! AI Edge Function is operational.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
