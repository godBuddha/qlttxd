const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3107;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let leaderToken;
let createdQuanHuyenId;
let createdPhuongXaId;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

async function setupAdmin() {
  const setup = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: TEST_ADMIN_PASSWORD,
      full_name: 'Quản trị viên hệ thống',
      email: 'admin@qlttxd.local',
      phone: '0901000001'
    })
  });
  if (setup.response.status === 201) return setup.body.token;
  const login = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
  });
  return login.body.token;
}

const VALID_MULTI = { type: 'MultiPolygon', coordinates: [[[[105.81, 21.02], [105.82, 21.02], [105.82, 21.03], [105.81, 21.03], [105.81, 21.02]]]] };
const INVALID_POLYGON = { type: 'Polygon', coordinates: [[[105.81, 21.02], [105.82, 21.02], [105.82, 21.03], [105.81, 21.03], [105.81, 21.02]]] };

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-admin-locations-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  adminToken = await setupAdmin();

  // Clean up existing test users to avoid collision with other test files
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'leader.loc%' OR username LIKE 'citizen.loc%')");
  await pool.query("DELETE FROM users WHERE username LIKE 'leader.loc%' OR username LIKE 'citizen.loc%'");

  // Create leader user for 403 tests
  const leaderRes = await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ username: 'leader.loc', password: 'Leader@2026', full_name: 'Lãnh đạo test', email: 'leader.loc@test.local', phone: '0902000001', roles: ['leader'] })
  });
  // Login leader
  const leaderLogin = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'leader.loc', password: 'Leader@2026' })
  });
  leaderToken = leaderLogin.body.token;

  // Create citizen
  await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ username: 'citizen.loc', password: 'Citizen@2026', full_name: 'Công dân test', email: 'citizen.loc@test.local', phone: '0903000001', roles: ['citizen'] })
  });

  // Clean up existing test data
  await pool.query("DELETE FROM audit_log WHERE bang_bi_tac_dong IN ('quan_huyen','phuong_xa') AND chi_tiet->>'ma' LIKE 'TEST-%'");
  await pool.query("DELETE FROM phuong_xa WHERE ma LIKE 'TEST-%'");
  await pool.query("DELETE FROM quan_huyen WHERE ma LIKE 'TEST-%'");
});

test.after(async () => {
  // Clean up test users
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'leader.loc%' OR username LIKE 'citizen.loc%')");
  await pool.query("DELETE FROM users WHERE username LIKE 'leader.loc%' OR username LIKE 'citizen.loc%'");
  // Clean up test data
  await pool.query("DELETE FROM audit_log WHERE bang_bi_tac_dong IN ('quan_huyen','phuong_xa') AND chi_tiet->>'ma' LIKE 'TEST-%'");
  await pool.query("DELETE FROM phuong_xa WHERE ma LIKE 'TEST-%'");
  await pool.query("DELETE FROM quan_huyen WHERE ma LIKE 'TEST-%'");
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// === Auth & RBAC ===

test('GET quan-huyen không token → 401', async () => {
  const result = await json('/api/v1/admin/quan-huyen');
  assert.equal(result.response.status, 401);
});

test('POST quan-huyen token sai → 401', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': 'invalid-token' },
    body: JSON.stringify({ ma: 'TEST-01', ten: 'Test' })
  });
  assert.equal(result.response.status, 401);
});

test('GET quan-huyen leader → 403', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    headers: { 'X-Auth-Token': leaderToken }
  });
  assert.equal(result.response.status, 403);
});

test('GET quan-huyen citizen → 403', async () => {
  const citizenLogin = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'citizen.loc', password: 'Citizen@2026' })
  });
  const result = await json('/api/v1/admin/quan-huyen', {
    headers: { 'X-Auth-Token': citizenLogin.body.token }
  });
  assert.equal(result.response.status, 403);
});

// === CRUD quan-huyen ===

test('GET quan-huyen admin → 200 + danh sách', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
});

test('POST tạo quận mới → 201', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-01', ten: 'Quận Test 01', boundary: VALID_MULTI })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.ma, 'TEST-01');
  assert.equal(result.body.data.ten, 'Quận Test 01');
  assert.ok(result.body.data.id);
  createdQuanHuyenId = result.body.data.id;
});

test('POST trùng mã → 409', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-01', ten: 'Quận trùng' })
  });
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /đã tồn tại/);
});

test('POST thiếu ma → 400', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ten: 'Quận thiếu mã' })
  });
  assert.equal(result.response.status, 400);
});

test('POST boundary sai kiểu → 400', async () => {
  const result = await json('/api/v1/admin/quan-huyen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-BAD', ten: 'Quận sai boundary', boundary: INVALID_POLYGON })
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /MULTIPOLYGON/);
});

test('PATCH sửa quận → 200', async () => {
  const result = await json(`/api/v1/admin/quan-huyen/${createdQuanHuyenId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ten: 'Quận Test 01 (sửa)' })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.ten, 'Quận Test 01 (sửa)');
});

test('PATCH quận không tồn tại → 404', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const result = await json(`/api/v1/admin/quan-huyen/${fakeId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ten: 'Không tồn tại' })
  });
  assert.equal(result.response.status, 404);
});

// === CRUD phuong-xa ===

test('POST tạo phường mới → 201', async () => {
  const result = await json('/api/v1/admin/phuong-xa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-0101', ten: 'Phường Test 0101', quan_huyen_id: createdQuanHuyenId, boundary: VALID_MULTI })
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.ma, 'TEST-0101');
  assert.equal(result.body.data.quan_huyen_id, createdQuanHuyenId);
  assert.ok(result.body.data.id);
  createdPhuongXaId = result.body.data.id;
});

test('POST phường thiếu quan_huyen_id → 400', async () => {
  const result = await json('/api/v1/admin/phuong-xa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-0102', ten: 'Phường thiếu quận' })
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /quan_huyen_id/);
});

test('POST phường quan_huyen_id không tồn tại → 404', async () => {
  const result = await json('/api/v1/admin/phuong-xa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-0103', ten: 'Phường quận không tồn tại', quan_huyen_id: '00000000-0000-0000-0000-000000000000' })
  });
  assert.equal(result.response.status, 404);
});

test('POST phường trùng mã → 409', async () => {
  const result = await json('/api/v1/admin/phuong-xa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ma: 'TEST-0101', ten: 'Phường trùng', quan_huyen_id: createdQuanHuyenId })
  });
  assert.equal(result.response.status, 409);
});

test('GET phuong-xa filter by quan_huyen_id → 200', async () => {
  const result = await json(`/api/v1/admin/phuong-xa?quan_huyen_id=${createdQuanHuyenId}`, {
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
  assert.ok(result.body.data.length >= 1);
  assert.equal(result.body.data[0].quan_huyen_id, createdQuanHuyenId);
});

test('PATCH sửa phường → 200', async () => {
  const result = await json(`/api/v1/admin/phuong-xa/${createdPhuongXaId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify({ ten: 'Phường Test 0101 (sửa)' })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.ten, 'Phường Test 0101 (sửa)');
});

// === Guard 409 xóa quận còn phường con ===

test('DELETE quận còn phường con → 409', async () => {
  const result = await json(`/api/v1/admin/quan-huyen/${createdQuanHuyenId}`, {
    method: 'DELETE',
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /phường\/xã/);
});

test('DELETE phường → 200', async () => {
  const result = await json(`/api/v1/admin/phuong-xa/${createdPhuongXaId}`, {
    method: 'DELETE',
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 200);
});

test('DELETE quận sau khi xóa phường → 200', async () => {
  const result = await json(`/api/v1/admin/quan-huyen/${createdQuanHuyenId}`, {
    method: 'DELETE',
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 200);
});

test('DELETE quận không tồn tại → 404', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const result = await json(`/api/v1/admin/quan-huyen/${fakeId}`, {
    method: 'DELETE',
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 404);
});

// === Audit log ===

test('audit_log có bản ghi thay đổi địa điểm', async () => {
  const result = await pool.query(
    `SELECT * FROM audit_log WHERE bang_bi_tac_dong IN ('quan_huyen','phuong_xa') AND chi_tiet->>'ma' LIKE 'TEST-%' ORDER BY thoi_gian DESC LIMIT 10`
  );
  assert.ok(result.rows.length >= 4, `Expected at least 4 audit records, got ${result.rows.length}`);
  const actions = result.rows.map(r => r.hanh_dong);
  assert.ok(actions.includes('create'));
  assert.ok(actions.includes('delete'));
});

// === GET danh-muc công khai không vỡ ===

test('GET /api/v1/danh-muc/quan-huyen công khai → 200', async () => {
  const result = await json('/api/v1/danh-muc/quan-huyen');
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
});

test('GET /api/v1/danh-muc/phuong-xa công khai → 200', async () => {
  const result = await json('/api/v1/danh-muc/phuong-xa');
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data));
});
