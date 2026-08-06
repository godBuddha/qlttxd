'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin } = require('./helpers/test-db');

const PORT = 3114;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let caseId;
let bienBanId;
let quyetDinhId;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

async function raw(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, buffer: await response.arrayBuffer(), headers: response.headers };
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

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  adminToken = await setupAdmin();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// Setup: create a case with bien_ban and quyet_dinh for export tests
test('Setup: create case with bien_ban + quyet_dinh', async () => {
  // Create offender
  const nvp = await pool.query(
    "INSERT INTO nguoi_vi_pham (loai_chu_the, ten, cmnd_cccd, dia_chi) VALUES ('ca_nhan', 'Nguyễn Văn A', '012345678901', '123 Test Street') RETURNING id"
  );
  const nvpId = nvp.rows[0].id;

  // Get a hanh_vi_id
  const hv = await pool.query('SELECT id FROM hanh_vi_vi_pham LIMIT 1');
  const hanhViId = hv.rows[0].id;

  // Get loai_vi_pham_id
  const lvp = await pool.query('SELECT id FROM loai_vi_pham LIMIT 1');
  const loaiVpId = lvp.rows[0].id;

  // Create ho_so directly in DB
  const hs = await pool.query(
    `INSERT INTO ho_so (ma_ho_so, loai_vi_pham_id, hanh_vi_id, nguoi_vi_pham_id, trang_thai, dia_chi, mo_ta, thoi_gian_xay_ra, muc_phat_du_kien)
     VALUES ('HS-TEST-DOCX-001', $1, $2, $3, 'cho_lap_bien_ban', '456 Test Ave', 'Vi phạm xây dựng không phép', '2026-01-15', 15000000)
     RETURNING id`,
    [loaiVpId, hanhViId, nvpId]
  );
  caseId = hs.rows[0].id;

  // Create bien_ban
  const bb = await pool.query(
    `INSERT INTO bien_ban (ma_bien_ban, ho_so_id, nguoi_lap_id, nguoi_vi_pham_id, hanh_vi_id, noi_dung, muc_phat_du_kien)
     VALUES ('BB-TEST-DOCX-001', $1, $2, $3, $4, 'Xây dựng không phép', 15000000)
     RETURNING id`,
    [
      caseId,
      adminToken
        ? (await json('/api/v1/auth/me', { headers: { 'X-Auth-Token': adminToken } })).body.user.id
        : null,
      nvpId,
      hanhViId,
    ]
  );
  bienBanId = bb.rows[0].id;

  // Update ho_so state
  await pool.query("UPDATE ho_so SET trang_thai='cho_ra_quyet_dinh' WHERE id=$1", [caseId]);

  // Create quyet_dinh
  const qd = await pool.query(
    `INSERT INTO quyet_dinh (ma_quyet_dinh, bien_ban_id, ho_so_id, nguoi_ky_id, so_tien_phat, can_cu_phap_ly, ngay_ban_hanh, trang_thai)
     VALUES ('QD-TEST-DOCX-001', $1, $2, $3, 15000000, 'Điều 16 NĐ 16/2022/NĐ-CP', '2026-01-20', 'da_ban_hanh')
     RETURNING id`,
    [
      bienBanId,
      caseId,
      (await json('/api/v1/auth/me', { headers: { 'X-Auth-Token': adminToken } })).body.user.id,
    ]
  );
  quyetDinhId = qd.rows[0].id;

  assert.ok(caseId);
  assert.ok(bienBanId);
  assert.ok(quyetDinhId);
});

test('GET /api/v1/ho-so/:id/xuat-bien-ban.docx trả file DOCX hợp lệ', async () => {
  const { response, buffer } = await raw(`/api/v1/ho-so/${caseId}/xuat-bien-ban.docx`, {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(response.status, 200);
  // Verify Content-Type is DOCX
  const ct = response.headers.get('content-type');
  assert.ok(ct.includes('wordprocessingml'), `Expected DOCX content-type, got: ${ct}`);
  // Verify it's a valid ZIP (DOCX is a ZIP file)
  const bytes = new Uint8Array(buffer.slice(0, 4));
  assert.equal(bytes[0], 0x50, 'ZIP magic byte P');
  assert.equal(bytes[1], 0x4b, 'ZIP magic byte K');
  assert.ok(buffer.byteLength > 100, `DOCX file too small: ${buffer.byteLength} bytes`);
});

test('GET /api/v1/ho-so/:id/xuat-quyet-dinh.docx trả file DOCX hợp lệ', async () => {
  const { response, buffer } = await raw(`/api/v1/ho-so/${caseId}/xuat-quyet-dinh.docx`, {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(response.status, 200);
  const ct = response.headers.get('content-type');
  assert.ok(ct.includes('wordprocessingml'), `Expected DOCX content-type, got: ${ct}`);
  const bytes = new Uint8Array(buffer.slice(0, 4));
  assert.equal(bytes[0], 0x50, 'ZIP magic byte P');
  assert.equal(bytes[1], 0x4b, 'ZIP magic byte K');
  assert.ok(buffer.byteLength > 100, `DOCX file too small: ${buffer.byteLength} bytes`);
});

test('GET xuat-bien-ban.docx không có biên bản → 400', async () => {
  // Create a case without bien_ban
  const hs = await pool.query(
    `INSERT INTO ho_so (ma_ho_so, trang_thai, dia_chi, mo_ta) VALUES ('HS-NO-BB-001', 'cho_tiep_nhan', 'Test', 'Test') RETURNING id`
  );
  const { response, body } = await json(`/api/v1/ho-so/${hs.rows[0].id}/xuat-bien-ban.docx`, {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(response.status, 400);
  assert.ok(body.error.includes('chưa có biên bản'));
});

test('GET xuat-quyet-dinh.docx không có quyết định → 400', async () => {
  const hs = await pool.query(
    `INSERT INTO ho_so (ma_ho_so, trang_thai, dia_chi, mo_ta) VALUES ('HS-NO-QD-001', 'cho_tiep_nhan', 'Test', 'Test') RETURNING id`
  );
  const { response, body } = await json(`/api/v1/ho-so/${hs.rows[0].id}/xuat-quyet-dinh.docx`, {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(response.status, 400);
  assert.ok(body.error.includes('chưa có quyết định'));
});

test('GET xuat-bien-ban.docx hồ sơ không tồn tại → 404', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { response } = await raw(`/api/v1/ho-so/${fakeId}/xuat-bien-ban.docx`, {
    headers: { 'X-Auth-Token': adminToken },
  });
  assert.equal(response.status, 404);
});

test('GET xuat-bien-ban.docx không có token → 401', async () => {
  const { response } = await raw(`/api/v1/ho-so/${caseId}/xuat-bien-ban.docx`);
  assert.equal(response.status, 401);
});
