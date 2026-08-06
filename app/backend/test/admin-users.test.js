const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin, cleanupNonAdminUsers } = require('./helpers/test-db');

const PORT = 3104;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let citizenUserId;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

async function setupAdmin() {
  // Try setup-admin first; if admin already exists (409), fall back to login
  const setup = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: TEST_ADMIN_PASSWORD,
      full_name: 'Quản trị viên hệ thống',
      email: 'admin@qlttxd.local',
      phone: '0901000001',
    }),
  });
  if (setup.response.status === 201) return setup.body.token;
  // Admin already exists — login instead
  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  return login.body.token;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-admin-users-test-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  adminToken = await setupAdmin();
  // Clean up non-admin users from previous test runs (keep admin)
  await cleanupNonAdminUsers(pool);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('không token → 401', async () => {
  const result = await json('/api/v1/admin/users');
  assert.equal(result.response.status, 401);
});

test('token sai → 401', async () => {
  const result = await json('/api/v1/admin/users', {
    headers: { 'X-Auth-Token': 'invalid-token' },
  });
  assert.equal(result.response.status, 401);
});

test('tạo user mới với role citizen', async () => {
  const result = await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({
      username: 'citizen.nga',
      password: 'Citizen@2026',
      full_name: 'Nguyễn Thị Nga',
      email: 'nga@example.com',
      phone: '0901000005',
      roles: ['citizen'],
    }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.username, 'citizen.nga');
  assert.deepEqual(result.body.data.roles, ['citizen']);
  citizenUserId = result.body.data.id;
});

test('user mới có thể đăng nhập', async () => {
  const result = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen.nga', password: 'Citizen@2026' }),
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.body.token);
  assert.deepEqual(result.body.user.roles, ['citizen']);
});

test('user citizen không thể truy cập admin endpoints → 403', async () => {
  // Login as citizen
  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen.nga', password: 'Citizen@2026' }),
  });
  const citizenToken = login.body.token;

  const result = await json('/api/v1/admin/users', {
    headers: { 'X-Auth-Token': citizenToken },
  });
  assert.equal(result.response.status, 403);
});

test('admin có thể sửa user', async () => {
  const result = await json(`/api/v1/admin/users/${citizenUserId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({
      full_name: 'Nguyễn Thị Nga (updated)',
      roles: ['citizen', 'case_handler'],
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.full_name, 'Nguyễn Thị Nga (updated)');
  assert.ok(result.body.data.roles.includes('case_handler'));
});

test('admin có thể khóa user', async () => {
  const result = await json(`/api/v1/admin/users/${citizenUserId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.is_active, false);
});

test('user bị khóa không thể đăng nhập', async () => {
  const result = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen.nga', password: 'Citizen@2026' }),
  });
  assert.equal(result.response.status, 401);
});

test('admin có thể mở khóa user', async () => {
  const result = await json(`/api/v1/admin/users/${citizenUserId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.is_active, true);
});

test('danh sách users trả về đúng', async () => {
  const result = await json('/api/v1/admin/users', {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
  assert.ok(result.body.data.length >= 2); // admin + citizen
  // Verify no password_hash in response
  for (const user of result.body.data) {
    assert.equal(user.password_hash, undefined);
  }
});

test('không thể khóa admin cuối cùng', async () => {
  // Get admin user id
  const users = await json('/api/v1/admin/users', {
    headers: { 'X-Auth-Token': adminToken },
  });
  const adminUser = users.body.data.find((u) => u.roles?.includes('admin'));

  const result = await json(`/api/v1/admin/users/${adminUser.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /cuối cùng/);
});
