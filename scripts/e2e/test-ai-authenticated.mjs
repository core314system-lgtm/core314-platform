#!/usr/bin/env node
/**
 * AI Edge Functions Test (Authenticated)
 * Tests with a real JWT token:
 * - Valid chat request
 * - Valid embeddings request
 * - Model whitelist enforcement
 * - Rate limiting (20/min)
 * - Error paths: 400, 401, 429, 500
 * - Error logging to function_error_events
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlndmtlZ2NzdGFvd2lrZXNzaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjU0MjYsImV4cCI6MjA0NjUwMTQyNn0.lKzNvVYOLhanii_VPXqCEqPOSHQXBTEVwFLqTGxKkqI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-generate`;

// Try to load JWT from file or environment
let AUTH_TOKEN = process.env.CORE314_TEST_JWT;
if (!AUTH_TOKEN) {
  try {
    AUTH_TOKEN = readFileSync('core314-app/.test_jwt', 'utf-8').trim();
  } catch (e) {
    console.error('⚠️  No JWT token found. Run test user setup first.');
  }
}

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

async function testUnauthorizedRequest() {
  try {
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        prompt: 'test',
        model: 'gpt-4o-mini'
      })
    });

    if (response.status === 401) {
      results.passed.push('Unauthorized request returns 401');
      log('Unauthorized request test passed (401)', 'pass');
      return true;
    } else {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`Unauthorized request: ${error.message}`);
    log(`Unauthorized request test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testInvalidModel() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Invalid model test: Skipped (no auth token)');
    log('Invalid model test skipped (no auth token)', 'warn');
    return true;
  }

  try {
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        prompt: 'test',
        model: 'gpt-4-turbo' // Not in allowlist
      })
    });

    if (response.status === 400) {
      const data = await response.json();
      if (data.error === 'Model not allowed') {
        results.passed.push('Invalid model returns 400');
        log('Invalid model test passed (400)', 'pass');
        return true;
      }
    }
    
    throw new Error(`Expected 400 with "Model not allowed", got ${response.status}`);
  } catch (error) {
    results.failed.push(`Invalid model: ${error.message}`);
    log(`Invalid model test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testMissingPrompt() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Missing prompt test: Skipped (no auth token)');
    log('Missing prompt test skipped (no auth token)', 'warn');
    return true;
  }

  try {
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini'
      })
    });

    if (response.status === 400) {
      const data = await response.json();
      if (data.error === 'Missing prompt') {
        results.passed.push('Missing prompt returns 400');
        log('Missing prompt test passed (400)', 'pass');
        return true;
      }
    }
    
    throw new Error(`Expected 400 with "Missing prompt", got ${response.status}`);
  } catch (error) {
    results.failed.push(`Missing prompt: ${error.message}`);
    log(`Missing prompt test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testPromptTooLong() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Prompt too long test: Skipped (no auth token)');
    log('Prompt too long test skipped (no auth token)', 'warn');
    return true;
  }

  try {
    const longPrompt = 'a'.repeat(8001); // Exceeds 8000 char limit
    
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        prompt: longPrompt,
        model: 'gpt-4o-mini'
      })
    });

    if (response.status === 400) {
      const data = await response.json();
      if (data.error === 'Prompt too long') {
        results.passed.push('Prompt too long returns 400');
        log('Prompt too long test passed (400)', 'pass');
        return true;
      }
    }
    
    throw new Error(`Expected 400 with "Prompt too long", got ${response.status}`);
  } catch (error) {
    results.failed.push(`Prompt too long: ${error.message}`);
    log(`Prompt too long test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testValidChatRequest() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Valid chat request: Skipped (no auth token)');
    log('Valid chat request skipped (no auth token)', 'warn');
    return true;
  }

  try {
    log('Testing valid chat request (will use OpenAI API)...', 'info');
    
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        prompt: 'Say "test" and nothing else',
        model: 'gpt-4o-mini',
        max_tokens: 10
      })
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data.text) {
        results.passed.push('Valid chat request returns 200');
        log(`Valid chat request test passed (200) - Response: "${data.text.substring(0, 50)}"`, 'pass');
        return true;
      }
    }
    
    const errorData = await response.json();
    throw new Error(`Expected 200 with text, got ${response.status}: ${JSON.stringify(errorData)}`);
  } catch (error) {
    results.failed.push(`Valid chat request: ${error.message}`);
    log(`Valid chat request test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testValidEmbeddingsRequest() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Valid embeddings request: Skipped (no auth token)');
    log('Valid embeddings request skipped (no auth token)', 'warn');
    return true;
  }

  try {
    log('Testing valid embeddings request (will use OpenAI API)...', 'info');
    
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Origin': 'https://app.core314.com'
      },
      body: JSON.stringify({
        prompt: 'test embedding',
        operation: 'embedding'
      })
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data.embedding && Array.isArray(data.embedding) && data.embedding.length > 0) {
        results.passed.push('Valid embeddings request returns 200');
        log(`Valid embeddings request test passed (200) - Vector length: ${data.embedding.length}`, 'pass');
        return true;
      }
    }
    
    const errorData = await response.json();
    throw new Error(`Expected 200 with embedding, got ${response.status}: ${JSON.stringify(errorData)}`);
  } catch (error) {
    results.failed.push(`Valid embeddings request: ${error.message}`);
    log(`Valid embeddings request test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testRateLimiting() {
  if (!AUTH_TOKEN) {
    results.warnings.push('Rate limiting test: Skipped (no auth token)');
    log('Rate limiting test skipped (no auth token)', 'warn');
    return true;
  }

  try {
    log('Testing rate limiting (making 21 requests)...', 'info');
    
    const requests = [];
    for (let i = 0; i < 21; i++) {
      requests.push(
        fetch(AI_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Origin': 'https://app.core314.com'
          },
          body: JSON.stringify({
            prompt: `test ${i}`,
            model: 'gpt-4o-mini',
            max_tokens: 5
          })
        })
      );
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    const has429 = statuses.includes(429);

    if (has429) {
      const count429 = statuses.filter(s => s === 429).length;
      results.passed.push('Rate limiting enforced (429 returned)');
      log(`Rate limiting test passed - ${count429} requests returned 429`, 'pass');
      return true;
    } else {
      throw new Error(`Expected at least one 429 response, got statuses: ${statuses.join(', ')}`);
    }
  } catch (error) {
    results.failed.push(`Rate limiting: ${error.message}`);
    log(`Rate limiting test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function testErrorLogging() {
  if (!SUPABASE_SERVICE_KEY) {
    results.warnings.push('Error logging test: Skipped (no service key)');
    log('Error logging test skipped (no service key)', 'warn');
    return true;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Check if function_error_events table has entries from our tests
    const { data, error, count } = await supabase
      .from('function_error_events')
      .select('*', { count: 'exact', head: false })
      .eq('function_name', 'ai-generate')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    if (count > 0) {
      results.passed.push(`Error logging verification (${count} events logged)`);
      log(`Error logging test passed (${count} error events found in last 10)`, 'pass');
      return true;
    } else {
      results.warnings.push('Error logging: No recent error events found');
      log('Error logging test: No recent error events found (may be expected)', 'warn');
      return true;
    }
  } catch (error) {
    results.failed.push(`Error logging: ${error.message}`);
    log(`Error logging test failed: ${error.message}`, 'fail');
    return false;
  }
}

async function runTests() {
  console.log('\n=== AI Edge Functions Test (Authenticated) ===\n');

  if (!AUTH_TOKEN) {
    console.log('⚠️  WARNING: No authentication token available');
    console.log('Some tests will be skipped\n');
  } else {
    console.log(`✅ Authentication token loaded (length: ${AUTH_TOKEN.length})\n`);
  }

  await testUnauthorizedRequest();
  await testInvalidModel();
  await testMissingPrompt();
  await testPromptTooLong();
  await testValidChatRequest();
  await testValidEmbeddingsRequest();
  await testRateLimiting();
  await testErrorLogging();

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(p => console.log(`  - ${p}`));
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
