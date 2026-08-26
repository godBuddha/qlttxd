'use strict';

// DEF-009 regression: case_handler KHÔNG được tự đóng hồ sơ (da_dong) bỏ qua
// chuỗi khắc phục/duyệt (docs/03-dac-ta-nghiep-vu.md UC-06). Leader vẫn được
// chuyển da_dong từ trạng thái thuộc quyền.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin, cleanupNonAdminUsers } = require('./helpers/test-db');

const PORT = 3112;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let handlerToken;
let leaderToken;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json().catch(() => ({})) };
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

async function createUser(userData) {
  const result = await json('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Auth-Token': adminToken },
    body: JSON.stringify(userData),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
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
  process.env.UPLOAD_DIR = '/tmp/qlttxd-def009-uploads';
  delete process.env.CORS_ORIGIN;
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  adminToken = await setupAdmin();
  await cleanupNonAdminUsers(pool);

  // Đảm bảo ma trận role_state_permissions đúng như migration 008 (idempotent)
  const handlerRole = (await pool.query("SELECT id FROM roles WHERE code='case_handler'")).rows[0];
  await pool.query('DELETE FROM role_state_permissions WHERE role_id=$1', [handlerRole.id]);
  await pool.query(
    `INSERT INTO role_state_permissions (role_id, state_code)
     SELECT $1, s.code FROM workflow_states s
     WHERE s.code IN ('da_tiep_nhan','dang_khac_phuc','da_khac_phuc','da_lap_bien_ban')`,
    [handlerRole.id]
  );

  // DEF-009: leader cần case.update để PATCH trạng thái (seed hiện hành không
  // cấp — bổ sung idempotent, đúng nghiệp vụ UC-06: leader quyết định đóng hồ sơ).
  await pool.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.code='leader' AND p.code='case.update'
    ON CONFLICT DO NOTHING
  `);

  await createUser({
    username: 'handler.def009',
    password: 'Test@2026',
    full_name: 'Thụ lý DEF-009',
    email: 'handler009@example.com',
    roles: ['case_handler'],
  });
  await createUser({
    username: 'leader.def009',
    password: 'Test@2026',
    full_name: 'Lãnh đạo DEF-009',
    email: 'leader009@example.com',
    roles: ['leader'],
  });
  handlerToken = await login('handler.def009');
  leaderToken = await login('leader.def009');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function createHoSo(trangThai) {
  const r = await pool.query(
    `INSERT INTO ho_so (ma_ho_so, trang_thai, nguoi_nop_id, dia_chi, mo_ta)
     VALUES ($1, $2, NULL, 'Test DEF-009', 'hồ sơ test RBAC') RETURNING id`,
    [`HS-DEF009-${Date.now()}-${Math.floor(Math.random() * 1000)}`, trangThai]
  );
  return r.rows[0].id;
}

async function patchState(token, hoSoId, nextState) {
  return json(`/api/v1/ho-so/${hoSoId}/trang-thai`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ trang_thai: nextState }),
  });
}

test('DEF-009: case_handler bị chặn chuyển da_dong từ cho_tiep_nhan (403)', async () => {
  const id = await createHoSo('cho_tiep_nhan');
  const res = await patchState(handlerToken, id, 'da_dong');
  assert.ok(
    res.response.status === 403 || res.response.status === 400,
    `expected 403/400, got ${res.response.status}`
  );
});

test('DEF-009: case_handler bị chặn chuyển da_dong từ da_tiep_nhan (403/400)', async () => {
  const id = await createHoSo('da_tiep_nhan');
  const res = await patchState(handlerToken, id, 'da_dong');
  // Bị chặn bởi một trong hai lớp: transition guard (400 — không có
  // da_tiep_nhan→da_dong trong workflow_transitions) hoặc role/state guard
  // (403 — ma trận DEF-009 không cấp da_dong cho case_handler).
  assert.ok(
    res.response.status === 403 || res.response.status === 400,
    `expected 403/400, got ${res.response.status}`
  );
});

test('DEF-009: case_handler vẫn làm được chuyển thuộc quyền (cho_tiep_nhan → da_tiep_nhan, 200)', async () => {
  const id = await createHoSo('cho_tiep_nhan');
  const res = await patchState(handlerToken, id, 'da_tiep_nhan');
  assert.equal(res.response.status, 200);
  assert.equal(res.body.data.trang_thai, 'da_tiep_nhan');
});

test('DEF-009: leader vẫn đóng hồ sơ thuộc quyền (da_khac_phuc → da_dong, 200)', async () => {
  const id = await createHoSo('da_khac_phuc');
  const res = await patchState(leaderToken, id, 'da_dong');
  assert.equal(res.response.status, 200);
  assert.equal(res.body.data.trang_thai, 'da_dong');
});
