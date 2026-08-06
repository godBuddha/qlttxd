const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3105;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let citizenRoleId;

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
  process.env.UPLOAD_DIR = '/tmp/qlttxd-admin-roles-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  adminToken = await setupAdmin();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('lấy danh sách roles', async () => {
  const result = await json('/api/v1/admin/roles', {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
  assert.ok(result.body.data.length >= 5); // citizen, case_handler, verifier, leader, admin
  const citizenRole = result.body.data.find((r) => r.code === 'citizen');
  assert.ok(citizenRole);
  citizenRoleId = citizenRole.id;
  assert.ok(Array.isArray(citizenRole.permissions));
});

test('lấy danh sách permissions nhóm theo module', async () => {
  const result = await json('/api/v1/admin/permissions', {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
  // Should have modules: report, case, gis, admin
  const modules = result.body.data.map((m) => m.module);
  assert.ok(modules.includes('report'));
  assert.ok(modules.includes('case'));
  assert.ok(modules.includes('admin'));
});

test('sửa quyền role citizen → thêm case.view', async () => {
  // Get all permissions
  const perms = await json('/api/v1/admin/permissions', {
    headers: { 'X-Auth-Token': adminToken },
  });
  const allPerms = perms.body.data.flatMap((m) => m.permissions);
  const caseViewPerm = allPerms.find((p) => p.code === 'case.view');
  const reportCreatePerm = allPerms.find((p) => p.code === 'report.create');
  const reportViewOwnPerm = allPerms.find((p) => p.code === 'report.view_own');

  // Update citizen role to have case.view + report.create + report.view_own
  const result = await json(`/api/v1/admin/roles/${citizenRoleId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({
      permission_ids: [reportCreatePerm.id, reportViewOwnPerm.id, caseViewPerm.id],
    }),
  });
  assert.equal(result.response.status, 200);
  const permCodes = result.body.data.permissions.map((p) => p.code);
  assert.ok(permCodes.includes('case.view'));
  assert.ok(permCodes.includes('report.create'));
  assert.ok(permCodes.includes('report.view_own'));
});

test('user với role citizen giờ có quyền case.view', async () => {
  // Create a citizen user
  const createResult = await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({
      username: 'citizen.test',
      password: 'Citizen@2026',
      full_name: 'Test Citizen',
      email: 'citizen@test.com',
      roles: ['citizen'],
    }),
  });
  assert.equal(createResult.response.status, 201);

  // Login as citizen
  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen.test', password: 'Citizen@2026' }),
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.body.user.permissions.includes('case.view'));
});

test('không thể sửa role không tồn tại → 404', async () => {
  const result = await json(
    '/api/v1/admin/roles/00000000-0000-0000-0000-000000000000/permissions',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
      body: JSON.stringify({ permission_ids: [] }),
    }
  );
  assert.equal(result.response.status, 404);
});

test('permission_ids không hợp lệ → 400', async () => {
  const result = await json(`/api/v1/admin/roles/${citizenRoleId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ permission_ids: 'not-an-array' }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /không hợp lệ/);
});
