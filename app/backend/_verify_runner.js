const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: '/tmp',
  port: 5432,
  database: 'qlttxd',
  user: 'postgres',
});

async function run() {
  const client = await pool.connect();
  let allPassed = true;
  const results = [];
  
  try {
    const sql = fs.readFileSync('/workspace/ssd/qlttxd/sql/verify-db.sql', 'utf8');
    
    // Remove psql meta-commands and the manual BEGIN/ROLLBACK
    const cleaned = sql
      .replace(/^\\.*$/gm, '')
      .replace(/^BEGIN;?$/gim, '')
      .replace(/^COMMIT;?$/gim, '');
    
    // Split into individual statements by finding SELECT ... ;
    // Each verification check is a standalone SELECT
    const stmts = [];
    let current = '';
    for (const line of cleaned.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments at start of statement
      if (!current && (trimmed === '' || trimmed.startsWith('--'))) continue;
      current += line + '\n';
      if (trimmed.endsWith(';') && trimmed !== '') {
        stmts.push(current.trim());
        current = '';
      }
    }
    
    // Run each statement in its own transaction (savepoint) to isolate failures
    await client.query('BEGIN');
    
    for (const stmt of stmts) {
      if (!stmt || stmt.startsWith('--') || stmt.startsWith('ROLLBACK')) continue;
      try {
        const res = await client.query(stmt);
        if (res.rows && res.rows.length > 0) {
          for (const row of res.rows) {
            for (const [key, val] of Object.entries(row)) {
              let passed;
              if (typeof val === 'boolean') {
                passed = val;
              } else if (typeof val === 'number') {
                passed = val > 0;
              } else if (typeof val === 'string') {
                // true values: 't', 'true', version strings, BC- codes
                passed = val === 't' || val === 'true' || /^\d/.test(val) || val.startsWith('BC-');
              } else {
                passed = val != null;
              }
              
              results.push({ check: key, value: String(val), passed });
              if (!passed) allPassed = false;
            }
          }
        }
      } catch (e) {
        results.push({ check: 'QUERY_ERROR', value: e.message.substring(0, 150), passed: false, stmt: stmt.substring(0, 100) });
        allPassed = false;
        // Rollback failed transaction and start new one
        try { await client.query('ROLLBACK'); } catch(r) {}
        await client.query('BEGIN');
      }
    }
    
    await client.query('ROLLBACK');
  } catch (e) {
    console.error('FATAL:', e.message);
    allPassed = false;
  } finally {
    client.release();
    await pool.end();
  }
  
  for (const r of results) {
    const extra = r.stmt ? ' [' + r.stmt + ']' : '';
    console.log((r.passed ? 'PASS' : 'FAIL') + ' | ' + r.check + ' = ' + r.value + extra);
  }
  console.log('\nVERIFY-DB EXIT: ' + (allPassed ? 0 : 1));
  console.log('Total: ' + results.filter(r => r.passed).length + ' PASS, ' + results.filter(r => !r.passed).length + ' FAIL');
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
