'use strict';

/**
 * FIX-BATCH-2 tests — new endpoints:
 *   PUT /config/workflow/states/:code (DEF-001 — đổi label)
 *   PUT /config/security/mime-types/:id (DEF-002/011 — toggle is_active)
 * Port 3130 — must not collide with other test files (run with --test-concurrency=1).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin, cleanupNonAdminUsers } = require('./helpers/test-db');

const PORT = 3130;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let nonAdminToken;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

function authHeaders(token) {
  return { 'content-type': 'application/json', 'X-Auth-Token': token };
}

async function login(username, password) {
  const r = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return r.body.token;
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

  adminToken = await login(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
  await cleanupNonAdminUsers(pool);

  // create a regular user (no config permissions)
  await pool.query(
    `INSERT INTO users (username, email, phone, full_name, password_hash, is_active)
     VALUES ('fixbatch2_user', 'fixbatch2@qlttxd.local', '0901000031', 'Test User', $1, true)
     ON CONFLICT (username) DO NOTHING`,
    [require('bcryptjs').hashSync(TEST_ADMIN_PASSWORD, 10)]
  );
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT u.id, r.id FROM users u, roles r
     WHERE u.username='fixbatch2_user' AND r.code='can_bo'
     ON CONFLICT DO NOTHING`
  );
  nonAdminToken = await login('fixbatch2_user', TEST_ADMIN_PASSWORD);
});

test.after(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE username='fixbatch2_user'`);
    // restore seeded labels/is_active mutated by happy-path tests
    await pool.query(`UPDATE workflow_states SET label='Chờ tiếp nhận' WHERE code='cho_tiep_nhan'`);
    await pool.query(`UPDATE allowed_mime_types SET is_active=true WHERE mime_type='image/gif'`);
  } catch (_) {}
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// ═══════════════════════════════════════════════
// FIX 1 — PUT /config/workflow/states/:code
// ═══════════════════════════════════════════════

test('PUT workflow/states/:code — 200 đổi label thành công (shape giống GET)', async () => {
  const { response, body } = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ ten_hien_thi: 'Đang chờ xử lý (sửa)' }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.code, 'cho_tiep_nhan');
  assert.equal(body.data.label, 'Đang chờ xử lý (sửa)');
  for (const key of ['id', 'code', 'label', 'is_terminal', 'sort_order']) {
    assert.ok(key in body.data, `missing key ${key}`);
  }
  // GET trả về label mới
  const g = await json('/api/v1/config/workflow/states', { headers: authHeaders(adminToken) });
  const row = g.body.data.find((s) => s.code === 'cho_tiep_nhan');
  assert.equal(row.label, 'Đang chờ xử lý (sửa)');
});

test('PUT workflow/states/:code — 403 user thường', async () => {
  const { response } = await json('/api/v1/config/workflow/states/cho_tiep_nhan', {
    method: 'PUT',
    headers: authHeaders(nonAdminToken),
    body: JSON.stringify({ ten_hien_thi: 'X' }),
  });
  assert.equal(response.status, 403);
});

test('PUT workflow/states/:code — 404 code không tồn tại', async () => {
  const { response } = await json('/api/v1/config/workflow/states/khong ton tai', {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ ten_hien_thi: 'X' }),
  });
  assert.equal(response.status, 404);
});

test('PUT workflow/states/:code — 400 thiếu/empty/too long', async () => {
  const h = authHeaders(adminToken);
  let r = await json('/api/v1/config/workflow/states/cho_tiep_nhan', { method: 'PUT', headers: h, body: JSON.stringify({}) });
  assert.equal(r.response.status, 400);
  r = await json('/api/v1/config/workflow/states/cho_tiep_nhan', { method: 'PUT', headers: h, body: JSON.stringify({ ten_hien_thi: '   ' }) });
  assert.equal(r.response.status, 400);
  r = await json('/api/v1/config/workflow/states/cho_tiep_nhan', { method: 'PUT', headers: h, body: JSON.stringify({ ten_hien_thi: 'x'.repeat(201) }) });
  assert.equal(r.response.status, 400);
});

// ═══════════════════════════════════════════════
// FIX 2 — PUT /config/security/mime-types/:id
// ═══════════════════════════════════════════════

async function getMimeId() {
  const r = await pool.query(`SELECT id FROM allowed_mime_types WHERE mime_type='image/gif' LIMIT 1`);
  return r.rows[0].id;
}

test('PUT security/mime-types/:id — 200 toggle is_active', async () => {
  const id = await getMimeId();
  const { response, body } = await json(`/api/v1/config/security/mime-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.is_active, false);
  assert.equal(body.data.mime_type, 'image/gif');

  const back = await json(`/api/v1/config/security/mime-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(back.response.status, 200);
  assert.equal(back.body.data.is_active, true);
});

test('PUT security/mime-types/:id — 403 user thường', async () => {
  const id = await getMimeId();
  const { response } = await json(`/api/v1/config/security/mime-types/${id}`, {
    method: 'PUT',
    headers: authHeaders(nonAdminToken),
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(response.status, 403);
});

test('PUT security/mime-types/:id — 404 id không tồn tại', async () => {
  const { response } = await json('/api/v1/config/security/mime-types/00000000-0000-4000-a000-00000000ffff', {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(response.status, 404);
});

test('PUT security/mime-types/:id — 400 thiếu/sai kiểu is_active + ID sai định dạng', async () => {
  const id = await getMimeId();
  const h = authHeaders(adminToken);
  let r = await json(`/api/v1/config/security/mime-types/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({}) });
  assert.equal(r.response.status, 400);
  r = await json(`/api/v1/config/security/mime-types/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ is_active: 'yes' }) });
  assert.equal(r.response.status, 400);
  r = await json('/api/v1/config/security/mime-types/not-a-uuid', { method: 'PUT', headers: h, body: JSON.stringify({ is_active: true }) });
  assert.equal(r.response.status, 400);
});
