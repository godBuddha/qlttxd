const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3102;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let citizenToken;
let handlerToken;
let verifierToken;
let leaderToken;

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

async function createUser(userData, adminTok) {
  const result = await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminTok },
    body: JSON.stringify(userData)
  });
  return result.body.data;
}

async function login(username, password = 'Test@2026') {
  const result = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.response.status, 200);
  return result.body.token;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-security-review-uploads';
  delete process.env.CORS_ORIGIN;
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  // Setup admin (create or login)
  adminToken = await setupAdmin();

  // Clean up test users from previous test runs (keep admin)
  // First clear FK references from tables without ON DELETE CASCADE
  const nuke = "IN (SELECT id FROM users WHERE username != 'admin')";
  await pool.query(`UPDATE ho_so SET nguoi_nop_id = NULL WHERE nguoi_nop_id ${nuke}`);
  await pool.query(`UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id ${nuke}`);
  await pool.query(`UPDATE bao_cao_vi_pham SET nguoi_gui_id = NULL WHERE nguoi_gui_id ${nuke}`);
  await pool.query(`UPDATE khac_phuc SET nguoi_theo_doi_id = NULL WHERE nguoi_theo_doi_id ${nuke}`);
  await pool.query(`UPDATE audit_log SET nguoi_dung_id = NULL WHERE nguoi_dung_id ${nuke}`);
  await pool.query(`DELETE FROM quyet_dinh WHERE nguoi_ky_id ${nuke}`);
  await pool.query(`DELETE FROM bien_ban WHERE nguoi_lap_id ${nuke}`);
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')");
  await pool.query("DELETE FROM users WHERE username != 'admin'");

  // Reset citizen role permissions to original (remove case.view if added by admin-roles test)
  const citizenRole = await pool.query("SELECT id FROM roles WHERE code='citizen'");
  if (citizenRole.rows[0]) {
    await pool.query("DELETE FROM role_permissions WHERE role_id=$1", [citizenRole.rows[0].id]);
    const reportCreate = await pool.query("SELECT id FROM permissions WHERE code='report.create'");
    const reportViewOwn = await pool.query("SELECT id FROM permissions WHERE code='report.view_own'");
    const permIds = [reportCreate.rows[0]?.id, reportViewOwn.rows[0]?.id].filter(Boolean);
    if (permIds.length) {
      await pool.query("INSERT INTO role_permissions (role_id, permission_id) SELECT $1, unnest($2::uuid[])", [citizenRole.rows[0].id, permIds]);
    }
  }

  // Create test users via admin API
  await createUser({ username: 'citizen.nga', password: 'Test@2026', full_name: 'Nguyễn Thị Nga', email: 'nga@example.com', roles: ['citizen'] }, adminToken);
  await createUser({ username: 'handler.hn', password: 'Test@2026', full_name: 'Cán bộ thụ lý', email: 'handler@example.com', roles: ['case_handler'] }, adminToken);
  await createUser({ username: 'verifier.hn', password: 'Test@2026', full_name: 'Cán bộ xác minh', email: 'verifier@example.com', roles: ['verifier'] }, adminToken);
  await createUser({ username: 'leader.hn', password: 'Test@2026', full_name: 'Lãnh đạo', email: 'leader@example.com', roles: ['leader'] }, adminToken);

  // Login all users
  citizenToken = await login('citizen.nga');
  handlerToken = await login('handler.hn');
  verifierToken = await login('verifier.hn');
  leaderToken = await login('leader.hn');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('ma trận auth/RBAC: protected 401, công dân 403, quản trị 200', async () => {
  const unauthenticated = await json('/api/v1/thong-ke/tong-quan');
  assert.equal(unauthenticated.response.status, 401);

  const forbidden = await json('/api/v1/thong-ke/tong-quan', { headers: { authorization: `Bearer ${citizenToken}` } });
  assert.equal(forbidden.response.status, 403);

  const allowed = await json('/api/v1/thong-ke/tong-quan', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(allowed.response.status, 200);
  assert.ok(Array.isArray(allowed.body.data.theo_trang_thai));
});

test('ma trận 5 vai trò: quyền nghiệp vụ server-side trả đúng 200/403', async () => {
  const cases = [
    [citizenToken, '/api/v1/bao-cao', 200],
    [citizenToken, '/api/v1/ho-so', 403],
    [handlerToken, '/api/v1/ho-so', 200],
    [handlerToken, '/api/v1/thong-ke/tong-quan', 403],
    [verifierToken, '/api/v1/ho-so', 200],
    [verifierToken, '/api/v1/thong-ke/tong-quan', 403],
    [leaderToken, '/api/v1/ho-so', 200],
    [leaderToken, '/api/v1/thong-ke/tong-quan', 200],
    [adminToken, '/api/v1/ho-so', 200],
  ];
  for (const [token, path, expected] of cases) {
    const result = await json(path, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(result.response.status, expected, path);
  }
});

test('upload giả MIME bị từ chối bằng magic-byte và CORS không mở mặc định', async () => {
  const form = new FormData();
  form.set('mo_ta', 'Tệp không phải ảnh');
  form.set('latitude', '21.0330');
  form.set('longitude', '105.8200');
  form.set('anh', new Blob(['not-an-image'], { type: 'image/png' }), 'evidence.png');
  const result = await json('/api/v1/bao-cao', {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, origin: 'https://attacker.invalid' },
    body: form,
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /chữ ký nội dung/);
  assert.equal(result.response.headers.get('access-control-allow-origin'), null);
});

test('JWT_SECRET fallback khi chưa cấu hình', () => {
  const old = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  // With Phase 2 fallback, buildApp no longer throws — it uses a random secret
  assert.doesNotThrow(() => buildApp({ pool }));
  // Verify fallback generated a secret
  assert.ok(process.env.JWT_SECRET);
  assert.ok(process.env.JWT_SECRET.length >= 32);
  process.env.JWT_SECRET = old;
});

test('X-Auth-Token header cũng hoạt động', async () => {
  const result = await json('/api/v1/thong-ke/tong-quan', {
    headers: { 'X-Auth-Token': adminToken }
  });
  assert.equal(result.response.status, 200);
});
