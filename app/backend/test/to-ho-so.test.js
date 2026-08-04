'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3199;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, token, baoCaoId, hoSoId;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  const body = await r.json();
  token = body.token;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});

// --- Create a bao_cao first ---
test('tạo báo cáo để test chuyển hồ sơ', async () => {
  const form = new FormData();
  form.set('mo_ta', 'Báo cáo test chuyển hồ sơ');
  form.set('dia_chi', '123 Đường Test, Hà Nội');
  form.set('longitude', '105.8300');
  form.set('latitude', '21.0350');
  form.set('nguoi_gui_ten', 'Người test');
  form.set('nguoi_gui_sdt', '0900000001');
  const r = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.ok(body.data.id);
  assert.ok(body.data.ma_bao_cao);
  baoCaoId = body.data.id;
});

// --- Convert to ho_so ---
test('POST /api/v1/bao-cao/:id/to-ho-so tạo hồ sơ mới', async () => {
  const r = await fetch(`${base}/api/v1/bao-cao/${baoCaoId}/to-ho-so`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.ok(body.data.ma_ho_so, 'should return ma_ho_so');
  assert.match(body.data.ma_ho_so, /^HS-\d{4}-\d{6}$/, 'ma_ho_so format');
  assert.equal(body.data.trang_thai, 'cho_tiep_nhan');
  assert.ok(body.data.toa_do, 'should copy coordinates');
  assert.equal(Number(body.data.toa_do.lat).toFixed(3), '21.035');
  assert.equal(Number(body.data.toa_do.lng).toFixed(2), '105.83');
  hoSoId = body.data.id;
});

// --- Verify ho_so appears in GET /api/v1/ho-so ---
test('hồ sơ mới xuất hiện trong GET /api/v1/ho-so', async () => {
  const r = await fetch(`${base}/api/v1/ho-so?page=1&limit=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  const found = body.data.find(h => h.id === hoSoId);
  assert.ok(found, 'new ho_so should appear in list');
  assert.equal(found.ma_ho_so.match(/^HS-/)?.[0], 'HS-');
});

// --- 409 on duplicate conversion ---
test('POST /api/v1/bao-cao/:id/to-ho-so lần 2 trả 409', async () => {
  const r = await fetch(`${base}/api/v1/bao-cao/${baoCaoId}/to-ho-so`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.match(body.error, /đã được chuyển/);
  assert.ok(body.data.ma_ho_so, 'should return existing ho_so');
});

// --- 404 for nonexistent bao_cao ---
test('POST /api/v1/bao-cao/00000000-0000-0000-0000-000000000000/to-ho-so trả 404', async () => {
  const r = await fetch(`${base}/api/v1/bao-cao/00000000-0000-0000-0000-000000000000/to-ho-so`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  assert.equal(r.status, 404);
});

// --- 401 without token ---
test('POST /api/v1/bao-cao/:id/to-ho-so không có token trả 401', async () => {
  const r = await fetch(`${base}/api/v1/bao-cao/${baoCaoId}/to-ho-so`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(r.status, 401);
});

// --- GET /api/v1/bao-cao/:id ---
test('GET /api/v1/bao-cao/:id trả chi tiết báo cáo', async () => {
  const r = await fetch(`${base}/api/v1/bao-cao/${baoCaoId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body.data.ma_bao_cao, 'should have ma_bao_cao');
  assert.equal(body.data.mo_ta, 'Báo cáo test chuyển hồ sơ');
  assert.ok(Array.isArray(body.data.anh), 'anh should be array');
  assert.ok(body.data.ho_so, 'should have linked ho_so');
  assert.equal(body.data.ho_so.ma_ho_so.match(/^HS-/)?.[0], 'HS-');
});

// --- Audit log for create ho_so ---
test('audit log ghi nhận tạo ho_so từ bao-cao', async () => {
  const r = await fetch(`${base}/api/v1/admin/audit-log?bang=ho_so&hanh_dong=create&limit=10`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  const found = body.data.find(a => a.id_ban_ghi === hoSoId);
  assert.ok(found, 'audit log should record create ho_so');
  assert.equal(found.bang_bi_tac_dong, 'ho_so');
  assert.equal(found.hanh_dong, 'create');
});
