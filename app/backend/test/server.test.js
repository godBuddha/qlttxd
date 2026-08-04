const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3101;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let token;
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
  return { response, body: await response.json() };
}

test('GET /health trả {status, db, uptime, version}', async () => {
  const { response, body } = await json('/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'connected');
  assert.ok(typeof body.uptime === 'number' && body.uptime >= 0);
  assert.ok(typeof body.version === 'string' && body.version.length > 0);
});

test('setup admin và đăng nhập', async () => {
  // Setup admin; if already exists (409), fall back to login
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
  if (setup.response.status === 201) {
    assert.ok(setup.body.token);
    token = setup.body.token;
    assert.ok(setup.body.user.permissions.includes('case.update'));
  } else {
    // Admin already exists — login instead
    const login = await json('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.body.token);
    token = login.body.token;
  }
});

test('đăng nhập đúng và sai tuân thủ RBAC', async () => {
  const bad = await json('/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'sai-mat-khau' }),
  });
  assert.equal(bad.response.status, 401);

  const good = await json('/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(good.response.status, 200);
  assert.ok(good.body.token);
  assert.ok(good.body.user.permissions.includes('case.update'));
  token = good.body.token;
});

test('tạo báo cáo, hồ sơ và chuyển trạng thái', async () => {
  const headers = { authorization: `Bearer ${token}` };
  const form = new FormData();
  form.set('mo_ta', 'Kiểm thử báo cáo có tọa độ PostGIS');
  form.set('dia_chi', 'Phường Trúc Bạch, Ba Đình');
  form.set('longitude', '105.8200');
  form.set('latitude', '21.0330');
  form.set('nguoi_gui_ten', 'Người kiểm thử');
  form.set('nguoi_gui_sdt', '0900000000');
  const report = await json('/api/v1/bao-cao', { method: 'POST', headers, body: form });
  assert.equal(report.response.status, 201);
  assert.match(report.body.data.ma_bao_cao, /^BC-\d{4}-\d{6}$/);
  assert.deepEqual(report.body.data.toa_do, { lat: 21.033, lng: 105.82 });

  const categories = await json('/api/v1/danh-muc/loai-vi-pham');
  const types = await json(`/api/v1/danh-muc/hanh-vi?loai_vi_pham_id=${categories.body.data[0].id}`);
  const created = await json('/api/v1/ho-so', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      bao_cao_id: report.body.data.id,
      loai_vi_pham_id: categories.body.data[0].id,
      hanh_vi_id: types.body.data[0].id,
      nguoi_vi_pham: { loai_chu_the: 'ca_nhan', ten: 'Người vi phạm kiểm thử' },
      mo_ta: 'Tạo hồ sơ từ báo cáo kiểm thử',
    }),
  });
  assert.equal(created.response.status, 201);
  assert.match(created.body.data.ma_ho_so, /^HS-\d{4}-\d{6}$/);
  createdCaseId = created.body.data.id;

  const changed = await json(`/api/v1/ho-so/${createdCaseId}/trang-thai`, {
    method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ trang_thai: 'cho_xac_minh' }),
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.data.trang_thai, 'cho_xac_minh');

  for (const trang_thai of ['dang_xac_minh', 'cho_lap_bien_ban']) {
    const step = await json(`/api/v1/ho-so/${createdCaseId}/trang-thai`, {
      method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ trang_thai }),
    });
    assert.equal(step.response.status, 200);
  }
});

test('luồng biên bản, quyết định, khắc phục và thống kê', async () => {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  let result = await json(`/api/v1/ho-so/${createdCaseId}/bien-ban`, {
    method: 'POST', headers, body: JSON.stringify({ noi_dung: 'Biên bản kiểm thử' }),
  });
  assert.equal(result.response.status, 201);
  const bienBanId = result.body.data.id;

  result = await json(`/api/v1/ho-so/${createdCaseId}/trang-thai`, {
    method: 'PATCH', headers, body: JSON.stringify({ trang_thai: 'cho_ra_quyet_dinh' }),
  });
  assert.equal(result.response.status, 200);

  result = await json(`/api/v1/ho-so/${createdCaseId}/quyet-dinh`, {
    method: 'POST', headers, body: JSON.stringify({ bien_ban_id: bienBanId, nhom_cong_trinh: 1 }),
  });
  assert.equal(result.response.status, 201);
  assert.ok(Number(result.body.data.so_tien_phat) > 0);
  assert.equal(result.body.data.trang_thai, 'draft', 'quyết định mới tạo phải ở trạng thái nháp');

  // Ban hành quyết định (draft → da_ban_hanh)
  result = await json(`/api/v1/ho-so/${createdCaseId}/quyet-dinh/ban-hanh`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.trang_thai, 'da_ban_hanh');
  assert.ok(result.body.data.ngay_ban_hanh, 'ngày ban hành phải được set');

  result = await json(`/api/v1/ho-so/${createdCaseId}/khac-phuc`, {
    method: 'POST', headers, body: JSON.stringify({ bien_phap: 'Khắc phục theo kiểm thử' }),
  });
  assert.equal(result.response.status, 201);
  const khacPhucId = result.body.data.id;

  result = await json(`/api/v1/khac-phuc/${khacPhucId}`, {
    method: 'PATCH', headers, body: JSON.stringify({ trang_thai: 'da_thuc_hien' }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.trang_thai, 'da_thuc_hien');

  result = await json('/api/v1/thong-ke/tong-quan', { headers });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.data.theo_trang_thai));
});
