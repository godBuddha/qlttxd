'use strict';

/**
 * Wave 1 (Settings Center) tests — migration 007 keys + new endpoints:
 *   PUT /config/bulk, POST /config/import?dryRun, POST /config/test-smtp,
 *   POST /audit/purge-now.
 * Port 3122 — must not collide with other test files (run with --test-concurrency=1).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin, cleanupNonAdminUsers } = require('./helpers/test-db');

const PORT = 3122;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

function authHeaders(extra = {}) {
  return { 'content-type': 'application/json', 'X-Auth-Token': adminToken, ...extra };
}

async function dbValue(category, key) {
  const r = await pool.query(
    `SELECT value FROM system_config WHERE scope='global' AND scope_id='00000000-0000-4000-a000-000000000000'::uuid AND category=$1 AND key=$2`,
    [category, key]
  );
  return r.rows.length ? r.rows[0].value : undefined;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.RATE_LIMIT_DISABLED = 'true';
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-wave1-test-uploads';

  // HC-03 regression guard: legacy env overrides must be ignored now.
  delete process.env.MAX_UPLOAD_MB;
  delete process.env.AUDIT_RETENTION_DAYS;
  delete process.env.AUDIT_BATCH_SIZE;
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.REQUEST_TIMEOUT_MS;

  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  // login (admin already ensured)
  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  adminToken = login.body.token;
  await cleanupNonAdminUsers(pool);
});

test.after(async () => {
  // restore mutated config values to migration-005/007 seeds so later suites see defaults
  try {
    const S = `'00000000-0000-4000-a000-000000000000'::uuid`;
    await pool.query(`UPDATE system_config SET value='false'::jsonb WHERE scope='global' AND scope_id=${S} AND category='smtp' AND key='enabled'`);
    await pool.query(`UPDATE system_config SET value='false'::jsonb WHERE scope='global' AND scope_id=${S} AND category='features' AND key='manual_audit_purge'`);
    await pool.query(`UPDATE system_config SET value='15'::jsonb WHERE scope='global' AND scope_id=${S} AND category='bell' AND key='dropdown_limit'`);
    await pool.query(`UPDATE system_config SET value='10'::jsonb WHERE scope='global' AND scope_id=${S} AND category='upload' AND key='max_mb'`);
    await pool.query(`UPDATE system_config SET value='21.0285'::jsonb WHERE scope='global' AND scope_id=${S} AND category='ui' AND key='home_lat'`);
    await pool.query(`UPDATE system_config SET value='105.8542'::jsonb WHERE scope='global' AND scope_id=${S} AND category='ui' AND key='home_lng'`);
    await pool.query(`DELETE FROM system_config WHERE category='wave1_test'`);
  } catch (_) {}
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// ═══════════════════════════════════════════════
// MIGRATION 007 — seeded keys present
// ═══════════════════════════════════════════════

test('Migration 007 — smtp + features có đủ >= 6 key', async () => {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM system_config WHERE category IN ('smtp','features')`
  );
  assert.ok(r.rows[0].n >= 6, `expected >=6 keys, got ${r.rows[0].n}`);
});

test('Migration 007 — security.hsts_max_age is_readonly=true', async () => {
  const r = await pool.query(
    `SELECT is_readonly FROM system_config WHERE category='security' AND key='hsts_max_age'`
  );
  assert.equal(r.rows[0].is_readonly, true);
});

test('Migration 007 — config_schema có cột schema_version', async () => {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='config_schema' AND column_name='schema_version'`
  );
  assert.ok(r.rows.length === 1);
});

test('SMTP channel mặc định enabled=false', async () => {
  assert.equal(await dbValue('smtp', 'enabled'), false);
});

// ═══════════════════════════════════════════════
// PUT /config/bulk
// ═══════════════════════════════════════════════

test('PUT /config/bulk — 3 items hợp lệ → updated=3', async () => {
  const result = await json('/api/v1/config/bulk', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      items: [
        { category: 'ui', key: 'home_lat', value: 21.5 },
        { category: 'ui', key: 'home_lng', value: 106.2 },
        { category: 'upload', key: 'max_mb', value: 15 },
      ],
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.updated, 3);
  assert.equal(result.body.items.length, 3);
  assert.deepEqual(await dbValue('upload', 'max_mb'), 15);
});

test('PUT /config/bulk — item sai category → rollback toàn bộ', async () => {
  // capture pre-state of a valid item to prove it was NOT written
  const before = await dbValue('ui', 'home_lat');

  const result = await json('/api/v1/config/bulk', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      items: [
        { category: 'ui', key: 'home_lat', value: 10.0 },        // valid
        { category: 'khong_ton_tai', key: 'abc', value: 1 },     // invalid category
      ],
    }),
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.index, 1);

  // nothing was written
  assert.deepEqual(await dbValue('ui', 'home_lat'), before);
});

test('PUT /config/bulk — không tồn tại trong DB → 404 + rollback', async () => {
  const result = await json('/api/v1/config/bulk', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      items: [
        { category: 'upload', key: 'max_mb', value: 20 },
        { category: 'ui', key: 'khong_co_key_nay', value: 1 },
      ],
    }),
  });
  assert.equal(result.response.status, 404);
  assert.deepEqual(await dbValue('upload', 'max_mb'), 15); // unchanged from earlier bulk write
});

test('PUT /config/bulk — readonly item → 400', async () => {
  const result = await json('/api/v1/config/bulk', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items: [{ category: 'security', key: 'hsts_max_age', value: 999 }] }),
  });
  assert.equal(result.response.status, 400);
});

test('PUT /config/bulk — quá 50 items → 400', async () => {
  const items = Array.from({ length: 51 }, (_, i) => ({ category: 'ui', key: 'language', value: String(i) }));
  const result = await json('/api/v1/config/bulk', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  assert.equal(result.response.status, 400);
});

test('PUT /config/bulk — không token → 401; thiếu quyền → 403', async () => {
  const noToken = await fetch(`${base}/api/v1/config/bulk`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ category: 'ui', key: 'theme', value: '"dark"' }] }),
  });
  assert.equal(noToken.status, 401);

  // citizen has no config permissions
  await json('/api/v1/auth/register-citizen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'wave1_citizen',
      password: 'MatKhau@123',
      full_name: 'Wave1 Citizen',
      email: 'wave1-citizen@example.com',
      phone: '0901000999',
    }),
  }).catch(() => {});
  const citizenLogin = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'wave1_citizen', password: 'MatKhau@123' }),
  });
  if (citizenLogin.body.token) {
    const forbidden = await fetch(`${base}/api/v1/config/bulk`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'X-Auth-Token': citizenLogin.body.token },
      body: JSON.stringify({ items: [{ category: 'ui', key: 'theme', value: '"dark"' }] }),
    });
    assert.equal(forbidden.status, 403);
  }
});

// ═══════════════════════════════════════════════
// POST /config/import?dry_run=
// ═══════════════════════════════════════════════

test('import dryRun=true — KHÔNG đổi DB, trả diff đúng', async () => {
  // reset to a known seed value first so the diff classification is deterministic
  await pool.query(
    `UPDATE system_config SET value='15'::jsonb WHERE scope='global' AND scope_id='00000000-0000-4000-a000-000000000000'::uuid AND category='bell' AND key='dropdown_limit'`
  );

  const result = await json('/api/v1/config/import?dry_run=true', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      items: [
        { id: null, category: 'bell', key: 'dropdown_limit', value: 25 },  // would_update
        { category: 'bell', key: 'dropdown_limit', value: 15 },            // unchanged
        { category: 'khong_ton_tai', key: 'x', value: 1 },                 // invalid
        { category: 'bell', key: 'khong_co_key', value: 2 },               // not found
      ],
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.dry_run, true);
  const d = result.body.data;
  assert.equal(d.would_update.length, 1);
  assert.equal(d.would_update[0].key, 'dropdown_limit');
  assert.equal(d.would_update[0].old_value, 15);
  assert.equal(d.would_update[0].new_value, 25);
  assert.equal(d.invalid.length, 2);
  assert.deepEqual(d.unchanged, [{ category: 'bell', key: 'dropdown_limit' }]);

  // DB untouched by dry-run
  assert.deepEqual(await dbValue('bell', 'dropdown_limit'), 15);
});

test('import dryRun=false — ghi item hợp lệ, bỏ qua invalid', async () => {
  const result = await json('/api/v1/config/import?dry_run=false', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      items: [
        { category: 'bell', key: 'dropdown_limit', value: 25 },
        { category: 'khong_ton_tai', key: 'x', value: 1 },
      ],
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.imported, 1);
  assert.equal(result.body.data.skipped, 1);
  assert.deepEqual(await dbValue('bell', 'dropdown_limit'), 25);
});

test('import dryRun=false — history được ghi cho item đã import', async () => {
  const hist = await json('/api/v1/config/history?category=bell&key=dropdown_limit&limit=5', {
    headers: authHeaders(),
  });
  assert.equal(hist.response.status, 200);
  assert.ok(hist.body.total >= 1);
});

// ═══════════════════════════════════════════════
// POST /config/test-smtp
// ═══════════════════════════════════════════════

test('test-smtp — smtp.enabled=false → 400 "Kênh email đang tắt"', async () => {
  const result = await json('/api/v1/config/test-smtp', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ to: 'someone@example.com' }),
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error, 'Kênh email đang tắt');
});

test('test-smtp — to không hợp lệ → 400', async () => {
  // enable first so the request reaches the validation path in order
  await pool.query(
    `UPDATE system_config SET value='true'::jsonb WHERE category='smtp' AND key='enabled'`
  );
  try {
    const badEmail = await json('/api/v1/config/test-smtp', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ to: 'not-an-email' }),
    });
    assert.equal(badEmail.response.status, 400);
  } finally {
    await pool.query(
      `UPDATE system_config SET value='false'::jsonb WHERE category='smtp' AND key='enabled'`
    );
  }
});

// ═══════════════════════════════════════════════
// POST /audit/purge-now
// ═══════════════════════════════════════════════

test('purge-now — flag manual_audit_purge=false → 403', async () => {
  const result = await json('/api/v1/audit/purge-now', {
    method: 'POST',
    headers: authHeaders(),
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error, 'Tính năng chưa được bật');
});

test('purge-now — flag=true nhưng không có bản ghi quá hạn → ok, deleted=0 (an toàn trên DB thật)', async () => {
  await pool.query(
    `UPDATE system_config SET value='true'::jsonb WHERE category='features' AND key='manual_audit_purge'`
  );
  try {
    const result = await json('/api/v1/audit/purge-now', {
      method: 'POST',
      headers: authHeaders(),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.deleted, 0);
  } finally {
    await pool.query(
      `UPDATE system_config SET value='false'::jsonb WHERE category='features' AND key='manual_audit_purge'`
    );
  }
});
