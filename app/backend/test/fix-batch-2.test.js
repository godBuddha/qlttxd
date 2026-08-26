'use strict';

/**
 * FIX-BATCH-2 tests — PUT /config/workflow/states/:code (DEF-001) and
 * PUT /config/security/mime-types/:id (DEF-002/011).
 * Port 3127 — must not collide with other test files (run with --test-concurrency=1).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin, cleanupNonAdminUsers } = require('./helpers/test-db');

const PORT = 3127;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json().catch(() => ({})) };
}

function authHeaders(extra = {}) {
  return { 'content-type': 'application/json', 'X-Auth-Token': adminToken, ...extra };
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.RATE_LIMIT_DISABLED = 'true';
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-fixbatch2-test-uploads';

  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  adminToken = login.body.token;
  await cleanupNonAdminUsers(pool);
});

test.after(async () => {
  // Restore seeded state so later suites see defaults
  try {
    await pool.query(`UPDATE workflow_states SET label='Chờ tiếp nhận' WHERE code='cho_tiep_nhan'`);
    await pool.query(`UPDATE allowed_mime_types SET is_active=true`);
  } catch (_) {}
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// ═══════════════════════════════════════════════
// PUT /config/workflow/states/:code (DEF-001)
// ═══════════════════════════════════════════════

test('PUT workflow/states/:code — 200 đổi label, trả shape GET', async () => {
  const { body } = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ ten_hien_thi: 'Chờ tiếp nhận (sửa)' }),
  });
  assert.equal(body.data.code, 'cho_tiep_nhan');
  assert.equal(body.data.label, 'Chờ tiếp nhận (sửa)');
  assert.equal(typeof body.data.is_terminal, 'boolean');
  assert.equal(typeof body.data.sort_order, 'number');

  // GET shape khớp bản ghi vừa cập nhật
  const get = await json('/api/v1/config/workflow/states', { headers: authHeaders() });
  const row = get.body.data.find((s) => s.code === 'cho_tiep_nhan');
  assert.equal(row.label, 'Chờ tiếp nhận (sửa)');
});

test('PUT workflow/states/:code — 400 rỗng / không phải chuỗi / quá dài', async () => {
  for (const bad of ['', '   ', null, undefined, 123, 'x'.repeat(201)]) {
    const payload = bad === undefined ? {} : { ten_hien_thi: bad };
    const r = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(r.response.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
});

test('PUT workflow/states/:code — 404 khi code không tồn tại', async () => {
  const r = await json('/api/v1/config/workflow/states/khong ton tai', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ ten_hien_thi: 'X' }),
  });
  assert.equal(r.response.status, 404);
});

// ═══════════════════════════════════════════════
// PUT /config/security/mime-types/:id (DEF-002/011)
// ═══════════════════════════════════════════════

async function getOneMimeId() {
  const r = await pool.query(`SELECT id FROM allowed_mime_types ORDER BY mime_type LIMIT 1`);
  return r.rows[0].id;
}

test('PUT mime-types/:id — 200 bật/tắt is_active', async () => {
  const id = await getOneMimeId();
  const off = await json(`/api/v1/config/security/mime-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(off.response.status, 200);
  assert.equal(off.body.data.is_active, false);
  assert.equal(off.body.data.id, id);

  const dbRow = await pool.query(`SELECT is_active FROM allowed_mime_types WHERE id=$1`, [id]);
  assert.equal(dbRow.rows[0].is_active, false);

  const on = await json(`/api/v1/config/security/mime-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(on.body.data.is_active, true);
});

test('PUT mime-types/:id — 400 thiếu/không boolean; ID sai định dạng → 400', async () => {
  const id = await getOneMimeId();
  for (const bad of [undefined, null, 'true', 1]) {
    const payload = bad === undefined ? {} : { is_active: bad };
    const r = await json(`/api/v1/config/security/mime-types/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(r.response.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
  const badId = await json('/api/v1/config/security/mime-types/khong-phai-uuid', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(badId.response.status, 400);
});

test('PUT mime-types/:id — 404 khi UUID không tồn tại', async () => {
  const r = await json('/api/v1/config/security/mime-types/00000000-0000-4000-a000-000000000001', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(r.response.status, 404);
});

// ═══════════════════════════════════════════════
// Phân quyền — citizen không có quyền config → 403
// ═══════════════════════════════════════════════

test('Cả 2 PUT — không token → 401; citizen → 403', async () => {
  const noTokenWf = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ten_hien_thi: 'X' }),
  });
  assert.equal(noTokenWf.response.status, 401);

  await json('/api/v1/auth/register-citizen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'fixbatch2_citizen',
      password: 'MatKhau@123',
      full_name: 'FixBatch2 Citizen',
      email: 'fixbatch2-citizen@example.com',
      phone: '0901000998',
    }),
  }).catch(() => {});
  const citizenLogin = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'fixbatch2_citizen', password: 'MatKhau@123' }),
  });
  if (citizenLogin.body.token) {
    const h = { 'content-type': 'application/json', 'X-Auth-Token': citizenLogin.body.token };
    const wf = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
      method: 'PUT', headers: h, body: JSON.stringify({ ten_hien_thi: 'X' }),
    });
    assert.equal(wf.response.status, 403);

    const id = await getOneMimeId();
    const mime = await json(`/api/v1/config/security/mime-types/${id}`, {
      method: 'PUT', headers: h, body: JSON.stringify({ is_active: false }),
    });
    assert.equal(mime.response.status, 403);
  }
});
