#!/usr/bin/env ts-node
/**
 * Run Integrity Checks
 * Calls the run_integrity_checks() function and logs results
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygvkegcstaowikessigx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runIntegrityChecks() {
  console.log('🔍 Running integrity checks...\n');

  try {
    const { data, error } = await supabase.rpc('run_integrity_checks');

    if (error) {
      console.error('❌ Error running integrity checks:', error);
      return { success: false, error };
    }

    console.log('✅ Integrity checks completed\n');
    console.log('📊 Results:');
    console.log('─'.repeat(80));

    let totalAnomalies = 0;
    const results: any[] = [];

    if (data && Array.isArray(data)) {
      data.forEach((check: any) => {
        console.log(`\n${check.check_name}:`);
        console.log(`  Anomalies found: ${check.anomaly_count}`);
        console.log(`  Description: ${check.details.description}`);
        
        totalAnomalies += check.anomaly_count;
        results.push(check);
      });
    }

    console.log('\n' + '─'.repeat(80));
    console.log(`\nTotal anomalies found: ${totalAnomalies}`);

    const { data: anomalies, error: anomaliesError } = await supabase
      .from('integrity_anomalies')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!anomaliesError && anomalies && anomalies.length > 0) {
      console.log('\n📋 Recent Unresolved Anomalies (last 10):');
      console.log('─'.repeat(80));
      anomalies.forEach((anomaly: any, index: number) => {
        console.log(`\n${index + 1}. ${anomaly.check_name} [${anomaly.severity}]`);
        console.log(`   User ID: ${anomaly.user_id}`);
        console.log(`   Created: ${new Date(anomaly.created_at).toISOString()}`);
        console.log(`   Details: ${JSON.stringify(anomaly.details, null, 2)}`);
      });
    }

    const outputPath = path.join(__dirname, '../../Phase69_Integrity_Check_Results.json');
    const output = {
      timestamp: new Date().toISOString(),
      total_anomalies: totalAnomalies,
      checks: results,
      recent_anomalies: anomalies || [],
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n📝 Results written to ${outputPath}`);

    return { success: true, totalAnomalies, results };
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return { success: false, error };
  }
}

runIntegrityChecks()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Integrity check completed successfully');
      process.exit(0);
    } else {
      console.log('\n❌ Integrity check failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
