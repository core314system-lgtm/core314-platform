#!/usr/bin/env node

/**
 * Script to instrument all Edge Functions with Sentry monitoring
 * Adds withSentry wrapper and breadcrumb helpers to all functions
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FUNCTIONS_DIR = join(__dirname, '../core314-app/supabase/functions');
const SHARED_DIR = join(FUNCTIONS_DIR, '_shared');

// Get all function directories (excluding _shared)
const functionDirs = readdirSync(FUNCTIONS_DIR)
  .filter(name => {
    const path = join(FUNCTIONS_DIR, name);
    return statSync(path).isDirectory() && name !== '_shared';
  })
  .sort();

console.log(`Found ${functionDirs.length} Edge Functions to instrument\n`);

let instrumentedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const funcName of functionDirs) {
  const indexPath = join(FUNCTIONS_DIR, funcName, 'index.ts');
  
  try {
    let content = readFileSync(indexPath, 'utf-8');
    
    // Check if already instrumented
    if (content.includes('withSentry') || content.includes('../_shared/sentry')) {
      console.log(`⏭️  ${funcName} - Already instrumented`);
      skippedCount++;
      continue;
    }
    
    // Check if it uses serve() from Deno
    if (!content.includes('serve(')) {
      console.log(`⚠️  ${funcName} - No serve() found, skipping`);
      skippedCount++;
      continue;
    }
    
    // Add import for Sentry utilities at the top (after other imports)
    const importRegex = /^(import .+;\n)+/m;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const lastImportIndex = importMatch[0].lastIndexOf('\n');
      const beforeImports = content.substring(0, importMatch.index + lastImportIndex + 1);
      const afterImports = content.substring(importMatch.index + lastImportIndex + 1);
      
      content = beforeImports + 
        `import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";\n` +
        afterImports;
    } else {
      // No imports found, add at the beginning
      content = `import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";\n\n` + content;
    }
    
    // Find and wrap the serve() handler
    // Pattern: serve(async (req) => { ... })
    // or: serve((req) => { ... })
    const serveRegex = /serve\(\s*(async\s*)?\(req(?::\s*Request)?\)\s*=>\s*\{/;
    const serveMatch = content.match(serveRegex);
    
    if (!serveMatch) {
      console.log(`⚠️  ${funcName} - Could not find serve() pattern, skipping`);
      skippedCount++;
      continue;
    }
    
    // Replace serve() with withSentry wrapper
    const isAsync = serveMatch[1] ? 'async ' : '';
    content = content.replace(
      serveRegex,
      `serve(withSentry(${isAsync}(req) => {\n  const testResponse = await handleSentryTest(req);\n  if (testResponse) return testResponse;\n`
    );
    
    // Find the closing of the serve handler and add closing parenthesis for withSentry
    // This is tricky - we need to find the matching closing brace
    // For now, we'll add it before the final });
    const lastClosingRegex = /\}\);?\s*$/;
    content = content.replace(lastClosingRegex, '}), { name: "' + funcName + '" }));');
    
    // Add breadcrumbs for common operations
    // OpenAI calls
    content = content.replace(
      /fetch\("https:\/\/api\.openai\.com\/v1\/([^"]+)"/g,
      (match, endpoint) => {
        return `(breadcrumb.openai("${endpoint}", undefined, body?.model), fetch("https://api.openai.com/v1/${endpoint}"`;
      }
    );
    
    // Stripe calls
    content = content.replace(
      /fetch\("https:\/\/api\.stripe\.com\/v1\/([^"]+)"/g,
      (match, endpoint) => {
        return `(breadcrumb.stripe("${endpoint}"), fetch("https://api.stripe.com/v1/${endpoint}"`;
      }
    );
    
    // Supabase queries (basic detection)
    if (content.includes('supabase.from(')) {
      // Add breadcrumb before first supabase query
      content = content.replace(
        /const \{ data.*\} = await supabase\.from\(/,
        (match) => {
          return `breadcrumb.supabase("query");\n  ${match}`;
        }
      );
    }
    
    // Write the instrumented content
    writeFileSync(indexPath, content, 'utf-8');
    console.log(`✅ ${funcName} - Instrumented successfully`);
    instrumentedCount++;
    
  } catch (error) {
    console.error(`❌ ${funcName} - Error: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Summary:`);
console.log(`  ✅ Instrumented: ${instrumentedCount}`);
console.log(`  ⏭️  Skipped: ${skippedCount}`);
console.log(`  ❌ Errors: ${errorCount}`);
console.log(`  📊 Total: ${functionDirs.length}`);
console.log(`${'='.repeat(60)}\n`);

if (instrumentedCount > 0) {
  console.log(`✨ Successfully instrumented ${instrumentedCount} Edge Functions with Sentry monitoring!`);
}
