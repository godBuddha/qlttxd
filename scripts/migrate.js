#!/usr/bin/env node
'use strict';

/**
 * QLTTXD database migration runner.
 *
 * Reads .sql files from sql/migrations/ in lexical (filename) order and applies
 * each pending migration exactly once. Applied versions are tracked in a
 * `schema_migrations` table (id TEXT PRIMARY KEY = filename, applied_at
 * TIMESTAMPTZ). Already-applied migrations are skipped, so the script is
 * idempotent: re-running it applies nothing new.
 *
 * Connection uses the same env vars as the application:
 *   PGHOST (default /tmp), PGPORT (default 5432), PGDATABASE (default postgres),
 *   PGUSER (default postgres), PGPASSWORD (default none).
 *
 * Usage:
 *   node scripts/migrate.js                  # default database (PGDATABASE)
 *   node scripts/migrate.js <database>       # override database name
 */

const fs = require('node:fs');
const path = require('node:path');

// Resolve the `pg` module from the backend's node_modules so it works even when
// invoked from the repo root (the top-level package.json has no pg dependency).
const here = __dirname;
const candidates = [
  path.join(here, '..', 'app', 'backend', 'node_modules', 'pg'),
  path.join(here, '..', 'node_modules', 'pg'),
];
let pg = null;
for (const c of candidates) {
  try {
    pg = require(c);
    break;
  } catch {
    /* try next */
  }
}
if (!pg) {
  console.error('ERROR: cannot find the "pg" module. Run `npm install` in app/backend.');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'sql', 'migrations');

function parseEnv(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function buildConfig(dbOverride) {
  return {
    host: parseEnv('PGHOST', '/tmp'),
    port: parseInt(parseEnv('PGPORT', '5432'), 10),
    database: dbOverride || parseEnv('PGDATABASE', 'postgres'),
    user: parseEnv('PGUSER', 'postgres'),
    password: parseEnv('PGPASSWORD', null),
  };
}

/** Return migration files (.sql) sorted by filename, skipping hidden/legacy dirs. */
function listMigrationFiles() {
  const entries = fs.readdirSync(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith('.sql') && !f.startsWith('.')).sort();
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

async function main() {
  const dbOverride = process.argv[2];
  const config = buildConfig(dbOverride);

  let files;
  try {
    files = listMigrationFiles();
  } catch (e) {
    console.error(`ERROR: cannot read migrations dir ${MIGRATIONS_DIR}: ${e.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(`No migration files found in ${MIGRATIONS_DIR}`);
    return;
  }

  const { Client } = pg;
  const client = new Client(config);

  let appliedCount = 0;
  let skippedCount = 0;

  try {
    await client.connect();
    await ensureTrackingTable(client);
    const done = await appliedVersions(client);

    for (const file of files) {
      if (done.has(file)) {
        console.log(`SKIP    ${file} (already applied)`);
        skippedCount += 1;
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`APPLIED ${file}`);
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED  ${file}: ${err.message}`);
        process.exitCode = 1;
        // Stop on first failure to keep the DB in a consistent state.
        break;
      }
    }

    console.log('');
    console.log(
      `Done: ${appliedCount} applied, ${skippedCount} skipped, ` +
        `${files.length - appliedCount - skippedCount} failed.`
    );
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
