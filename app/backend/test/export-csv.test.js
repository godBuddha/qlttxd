const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3110;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let adminToken;
let leaderToken;
let citizenToken;
let statsOnlyToken; // has report.statistics but NOT case.view

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

async function raw(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, text: await response.text(), headers: response.headers };
}

async function setupAdmin() {
  const setup = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin', password: TEST_ADMIN_PASSWORD,
      full_name: 'Quản trị viên hệ thống', email: 'admin@qlttxd.local', phone: '0901000001'
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

let testCaseId;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-export-csv-uploads';
  delete process.env.CORS_ORIGIN;
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  adminToken = await setupAdmin();

  // Clean up test data from previous runs (ho_so references users via nguoi_xu_ly_id)
  await pool.query("UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id IN (SELECT id FROM users WHERE username != 'admin')");
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')");
  await pool.query("DELETE FROM users WHERE username != 'admin'");

  // Clean up test roles from previous runs
  await pool.query("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code LIKE 'test_%')");
  await pool.query("DELETE FROM roles WHERE code LIKE 'test_%'");

  // Create test users
  await createUser({ username: 'leader.csv', password: 'Test@2026', full_name: 'Lãnh đạo CSV', email: 'leader@csv.local', roles: ['leader'] }, adminToken);
  await createUser({ username: 'citizen.csv', password: 'Test@2026', full_name: 'Công dân CSV', email: 'citizen@csv.local', roles: ['citizen'] }, adminToken);

  leaderToken = await login('leader.csv');
  citizenToken = await login('citizen.csv');

  // Create a test role with ONLY report.statistics (no case.view) for PII masking test
  const statsPerm = await pool.query("SELECT id FROM permissions WHERE code='report.statistics'");
  const statsPermId = statsPerm.rows[0].id;
  const roleResult = await pool.query(
    "INSERT INTO roles (code, name, description) VALUES ('test_stats_only', 'Stats Only Test', 'Test role for CSV export PII masking') RETURNING id"
  );
  const roleId = roleResult.rows[0].id;
  await pool.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)", [roleId, statsPermId]);
  await createUser({ username: 'stats.csv', password: 'Test@2026', full_name: 'Thống kê CSV', email: 'stats@csv.local', roles: ['test_stats_only'] }, adminToken);
  statsOnlyToken = await login('stats.csv');

  // Create a report + case with PII data so CSV has content
  const headers = { authorization: `Bearer ${adminToken}` };
  const form = new FormData();
  form.set('mo_ta', 'Kiểm thử export CSV');
  form.set('dia_chi', 'Phường test CSV');
  form.set('longitude', '105.8200');
  form.set('latitude', '21.0330');
  form.set('nguoi_gui_ten', 'Người test CSV');
  form.set('nguoi_gui_sdt', '0912345678');
  const report = await json('/api/v1/bao-cao', { method: 'POST', headers, body: form });
  assert.equal(report.response.status, 201);

  const categories = await json('/api/v1/danh-muc/loai-vi-pham');
  const types = await json(`/api/v1/danh-muc/hanh-vi?loai_vi_pham_id=${categories.body.data[0].id}`);
  const created = await json('/api/v1/ho-so', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      bao_cao_id: report.body.data.id,
      loai_vi_pham_id: categories.body.data[0].id,
      hanh_vi_id: types.body.data[0].id,
      nguoi_vi_pham: { loai_chu_the: 'ca_nhan', ten: 'Nguyễn Văn A', sdt: '0987654321', email: 'nguyenvana@test.com' },
      mo_ta: 'Hồ sơ kiểm thử CSV export',
    }),
  });
  assert.equal(created.response.status, 201);
  testCaseId = created.body.data.id;
});

test.after(async () => {
  if (testCaseId) await pool.query('DELETE FROM ho_so WHERE id=$1', [testCaseId]).catch(() => {});
  await pool.query("UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id IN (SELECT id FROM users WHERE username != 'admin')").catch(() => {});
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')").catch(() => {});
  await pool.query("DELETE FROM users WHERE username != 'admin'").catch(() => {});
  await pool.query("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code LIKE 'test_%')").catch(() => {});
  await pool.query("DELETE FROM roles WHERE code LIKE 'test_%'").catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// --- RBAC ---

test('CSV export: 401 khi chưa đăng nhập', async () => {
  const { response } = await raw('/api/v1/thong-ke/xuat?loai=csv');
  assert.equal(response.status, 401);
});

test('CSV export: 403 khi công dân không có report.statistics', async () => {
  const { response } = await raw('/api/v1/thong-ke/xuat?loai=csv', {
    headers: { authorization: `Bearer ${citizenToken}` }
  });
  assert.equal(response.status, 403);
});

test('CSV export: 200 khi leader có report.statistics', async () => {
  const { response, text } = await raw('/api/v1/thong-ke/xuat?loai=csv', {
    headers: { authorization: `Bearer ${leaderToken}` }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  assert.match(response.headers.get('content-disposition'), /attachment; filename="bao-cao-/);
  assert.ok(text.includes('ma_ho_so'), 'CSV should contain ma_ho_so header column');
});

// --- CSV format ---

test('CSV export: admin nhận CSV với header đúng và có dữ liệu', async () => {
  const { response, text } = await raw('/api/v1/thong-ke/xuat?loai=csv', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  const clean = text.replace(/^\ufeff/, '');
  const lines = clean.split('\n').filter(l => l.trim());
  assert.ok(lines.length >= 2, `CSV should have header + at least 1 data row, got ${lines.length} lines`);
  const headers = lines[0].split(',');
  assert.ok(headers.includes('ma_ho_so'), 'should have ma_ho_so column');
  assert.ok(headers.includes('trang_thai'), 'should have trang_thai column');
  assert.ok(headers.includes('nguoi_vi_pham_ten'), 'should have nguoi_vi_pham_ten column');
  assert.ok(headers.includes('nguoi_vi_pham_sdt'), 'should have nguoi_vi_pham_sdt column');
  assert.ok(headers.includes('nguoi_vi_pham_email'), 'should have nguoi_vi_pham_email column');
  assert.ok(headers.includes('quan_huyen'), 'should have quan_huyen column');
  assert.ok(headers.includes('phuong_xa'), 'should have phuong_xa column');
});

// --- PII masking ---

test('CSV export: PII bị che cho user chỉ có report.statistics (không có case.view)', async () => {
  // statsOnlyToken has report.statistics but NOT case.view
  const { text: statsCsv } = await raw('/api/v1/thong-ke/xuat?loai=csv', {
    headers: { authorization: `Bearer ${statsOnlyToken}` }
  });
  // PII should be masked: phone '0987654321' → '******4321' (mask replaces all but last 4)
  // The mask function: s.replace(/.(?=.{4})/g, '*') means replace every char that has 4+ chars after it
  // '0987654321' has 10 chars → first 6 get masked → '******4321'
  assert.ok(!statsCsv.includes('0987654321'), 'should not contain raw phone');
  // Email 'nguyenvana@test.com' (18 chars) → first 14 masked → '**************t.com'
  assert.ok(!statsCsv.includes('nguyenvana@test.com'), 'should not contain raw email');
});

test('CSV export: admin thấy PII đầy đủ (có case.view)', async () => {
  const { text } = await raw('/api/v1/thong-ke/xuat?loai=csv', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.ok(text.includes('0987654321'), 'admin should see raw phone number');
  assert.ok(text.includes('nguyenvana@test.com'), 'admin should see raw email');
});

// --- Invalid loai ---

test('CSV export: 400 khi loai không phải csv', async () => {
  const { response, body } = await json('/api/v1/thong-ke/xuat?loai=xlsx', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /Loại xuất không hợp lệ/);
});

// --- Filter ---

test('CSV export: filter theo trang_thai không crash', async () => {
  const { response } = await raw('/api/v1/thong-ke/xuat?loai=csv&trang_thai=cho_tiep_nhan', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
});

test('CSV export: filter theo quan_huyen_id không crash', async () => {
  const { response } = await raw('/api/v1/thong-ke/xuat?loai=csv&quan_huyen_id=00000000-0000-0000-0000-000000000000', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);
});

test('CSV export: filter theo ngày không crash', async () => {
  const { response } = await raw('/api/v1/thong-ke/xuat?loai=csv&tu_ngay=2025-01-01&den_ngay=2025-12-31', {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);
});
