#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BANNED_PATTERNS = [
  /VITE_OPENAI_API_KEY/g,
  /VITE_SUPABASE_SERVICE_ROLE_KEY/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /service_role/g,
];

const PATTERN_NAMES = [
  'VITE_OPENAI_API_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'OpenAI API key (sk-...)',
  'service_role',
];

function scanDirectory(dir) {
  const findings = [];
  
  function scan(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        for (let i = 0; i < BANNED_PATTERNS.length; i++) {
          const matches = content.match(BANNED_PATTERNS[i]);
          if (matches) {
            findings.push({
              file: path.relative(dir, fullPath),
              pattern: PATTERN_NAMES[i],
              count: matches.length,
            });
          }
        }
      }
    }
  }
  
  scan(dir);
  return findings;
}

const distPath = process.argv[2] || 'dist';

if (!fs.existsSync(distPath)) {
  console.error(`❌ Error: Directory '${distPath}' does not exist`);
  process.exit(1);
}

console.log(`🔍 Scanning ${distPath}/ for exposed secrets...`);
const findings = scanDirectory(distPath);

if (findings.length === 0) {
  console.log('✅ No secrets found in bundle - build is clean!');
  process.exit(0);
} else {
  console.error('❌ SECURITY VIOLATION: Secrets found in bundle!');
  for (const finding of findings) {
    console.error(`   File: ${finding.file}`);
    console.error(`   Pattern: ${finding.pattern}`);
    console.error(`   Occurrences: ${finding.count}`);
  }
  process.exit(1);
}
