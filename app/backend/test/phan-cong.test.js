const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3112;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let handlerId;
let createdCaseId;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  let body = {};
  try { body = await response.json(); } catch { /* may not return JSON */ }
  return { response, body };
}

test('setup: login admin', async () => {
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
  if (setup.response.status === 201) {
    adminToken = setup.body.token;
  } else {
    const login = await json('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
    });
    assert.equal(login.response.status, 200);
    adminToken = login.body.token;
  }
  assert.ok(adminToken);
});

test('setup: create handler user with case_handler role', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const create = await json('/api/v1/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: 'handler_test',
      password: 'Handler@2026',
      full_name: 'Cán bộ xử lý kiểm thử',
      email: 'handler@qlttxd.local',
      phone: '0902000001',
      roles: ['case_handler'],
    }),
  });
  assert.equal(create.response.status, 201);
  handlerId = create.body.data.id;
  assert.ok(handlerId);
});

test('setup: create a case to assign', async () => {
  const headers = { authorization: `Bearer ${adminToken}` };
  // Create a report first
  const form = new FormData();
  form.set('mo_ta', 'Kiểm thử phân công cán bộ');
  form.set('dia_chi', 'Phường test');
  form.set('longitude', '105.8200');
  form.set('latitude', '21.0330');
  form.set('nguoi_gui_ten', 'Người test');
  form.set('nguoi_gui_sdt', '0900000000');
  const report = await json('/api/v1/bao-cao', { method: 'POST', headers, body: form });
  assert.equal(report.response.status, 201);

  const categories = await json('/api/v1/danh-muc/loai-vi-pham');
  const types = await json(`/api/v1/danh-muc/hanh-vi?loai_vi_pham_id=${categories.body.data[0].id}`);
  const created = await json('/api/v1/ho-so', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      bao_cao_id: report.body.data.id,
      loai_vi_pham_id: categories.body.data[0].id,
      hanh_vi_id: types.body.data[0].id,
      nguoi_vi_pham: { loai_chu_the: 'ca_nhan', ten: 'Người vi phạm test' },
      mo_ta: 'Hồ sơ kiểm thử phân công',
    }),
  });
  assert.equal(created.response.status, 201);
  createdCaseId = created.body.data.id;
  assert.ok(createdCaseId);
});

test('GET /api/v1/danh-muc/can-bo returns handler list', async () => {
  const headers = { authorization: `Bearer ${adminToken}` };
  const result = await json('/api/v1/danh-muc/can-bo', { headers });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
  const found = result.body.data.find((u) => u.id === handlerId);
  assert.ok(found, 'handler user should be in can-bo list');
  assert.equal(found.full_name, 'Cán bộ xử lý kiểm thử');
});

test('PUT /api/v1/ho-so/:id/phan-cong without token → 401', async () => {
  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ can_bo_id: handlerId }),
  });
  assert.equal(result.response.status, 401);
});

test('PUT /api/v1/ho-so/:id/phan-cong with valid handler → 200 + audit', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ can_bo_id: handlerId }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.nguoi_xu_ly_id, handlerId);
  assert.equal(result.body.data.nguoi_xu_ly_ten, 'Cán bộ xử lý kiểm thử');

  // Verify audit log
  const audit = await json(`/api/v1/admin/audit-log?hanh_dong=case.assign`, { headers });
  assert.equal(audit.response.status, 200);
  const found = audit.body.data.find((a) => a.id_ban_ghi === createdCaseId);
  assert.ok(found, 'audit log should have case.assign entry');
  assert.equal(found.hanh_dong, 'case.assign');
});

test('GET /api/v1/ho-so/:id returns nguoi_xu_ly info', async () => {
  const headers = { authorization: `Bearer ${adminToken}` };
  const result = await json(`/api/v1/ho-so/${createdCaseId}`, { headers });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.nguoi_xu_ly_id, handlerId);
  assert.ok(result.body.data.nguoi_xu_ly);
  assert.equal(result.body.data.nguoi_xu_ly.full_name, 'Cán bộ xử lý kiểm thử');
});

test('PUT /api/v1/ho-so/:id/phan-cong missing can_bo_id → 400', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /can_bo_id/);
});

test('PUT /api/v1/ho-so/:id/phan-cong with invalid UUID → 400', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ can_bo_id: 'not-a-uuid' }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /không hợp lệ/);
});

test('PUT /api/v1/ho-so/:id/phan-cong with non-handler user → 400', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  // Admin user doesn't have case_handler role
  const adminInfo = await json('/api/v1/auth/me', { headers });
  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ can_bo_id: adminInfo.body.user.id }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /vai trò xử lý/);
});

test('PUT /api/v1/ho-so/:id/phan-cong with non-existent case → 404', async () => {
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const result = await json(`/api/v1/ho-so/00000000-0000-0000-0000-000000000000/phan-cong`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ can_bo_id: handlerId }),
  });
  assert.equal(result.response.status, 404);
});

test('PUT /api/v1/ho-so/:id/phan-cong citizen cannot assign → 403', async () => {
  // Create a citizen user
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const create = await json('/api/v1/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: 'citizen_test',
      password: 'Citizen@2026',
      full_name: 'Công dân kiểm thử',
      email: 'citizen@qlttxd.local',
      phone: '0903000001',
      roles: ['citizen'],
    }),
  });
  assert.equal(create.response.status, 201);

  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen_test', password: 'Citizen@2026' }),
  });
  assert.equal(login.response.status, 200);
  const citizenToken = login.body.token;

  const result = await json(`/api/v1/ho-so/${createdCaseId}/phan-cong`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${citizenToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ can_bo_id: handlerId }),
  });
  assert.equal(result.response.status, 403);
});
