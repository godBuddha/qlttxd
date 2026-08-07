'use strict';

// Input validation consistency tests (BE-E6-03 / M-01)
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin } = require('./helpers/test-db');

const PORT = 3109;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, _token;

function json(path, options = {}) {
  return fetch(`${base}${path}`, options).then(r => r.json());
}

async function login() {
  if (_token) return _token;
  const b = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  _token = b.token;
  return _token;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-input-validation-test-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  await new Promise(r => server.on('listening', r));
  await login(); // warm up token cache
});

test.after(async () => {
  await new Promise(r => server.close(r));
  await pool.end();
});

// ── Auth: setup-admin input length & sanitization ──────────────

test('setup-admin rejects long username (>50 chars)', async () => {
  const body = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'a'.repeat(51),
      password: 'Password1',
      full_name: 'Test',
      email: 't@t.com',
    }),
  });
  assert.equal(body.error?.includes('3-50'), true, 'should reject long username');
});

test('setup-admin rejects <8 char password', async () => {
  const body = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'shortpw',
      password: 'abc1',
      full_name: 'Test',
      email: 't@t.com',
    }),
  });
  assert.equal(typeof body.error === 'string', true);
});

test('setup-admin requires alphanumeric password pattern', async () => {
  const body = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'nopattern',
      password: '12345678',
      full_name: 'Test',
      email: 't@t.com',
    }),
  });
  assert.ok(body.error?.includes('chứa cả chữ và chữ số'));
});

test('setup-admin rejects oversized full_name (>200 chars)', async () => {
  const body = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'longname',
      password: 'Password1',
      full_name: 'A'.repeat(201),
      email: 't@t.com',
    }),
  });
  assert.ok(body.error?.includes('200 ký tự'));
});

test('setup-admin accepts valid payload', async () => {
  // Already has admin from seed — expect 409
  const res = await fetch(`${base}/api/v1/auth/setup-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'anothershouldfail',
      password: 'Password1',
      full_name: 'Test',
      email: 't@t.com',
    }),
  });
  assert.equal(res.status, 409);
});

// ── Auth: login with input constraints ────────────────────────

test('login accepts valid credentials', async () => {
  const body = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.ok(typeof body.token === 'string');
});

test('login rejects username >200 chars', async () => {
  const body = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'x'.repeat(201), password: 'x' }),
  });
  assert.ok(body.error?.includes('hợp lệ') || body.error?.includes('bắt buộc'));
});

// ── Auth: forgot-password identifier guard ────────────────────

test('forgot-password rejects empty identifier', async () => {
  const body = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '   ' }),
  });
  assert.ok(body.error?.includes('bắt buộc'));
});

test('forgot-password rejects oversized identifier (>200)', async () => {
  const body = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'a'.repeat(201) }),
  });
  assert.ok(body.error?.includes('200 ký tự') || body.error?.includes('bắt buộc'));
});

// ── Ho-so: create payload validation ──────────────────────────

test('ho-so POST rejects user without auth', async () => {
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mo_ta: 'test' }),
  });
  assert.equal(res.status, 401);
});

test('ho-so POST validates NVP name required', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mo_ta: 'test', nguoi_vi_pham: { loai_chu_the: 'ca_nhan' } }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Tên người vi phạm là bắt buộc'));
});

test('ho-so POST validates NVP ten max length (>200)', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'X'.repeat(201),
        loai_chu_the: 'ca_nhan',
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('200 ký tự'));
});

test('ho-so POST validates NVP dia_chi max length (>1000)', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'Valid Name',
        loai_chu_the: 'ca_nhan',
        dia_chi: 'Y'.repeat(1001),
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('1000 ký tự'));
});

test('ho-so POST validates NVP nguoi_dai_dien max length (>200)', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'Valid Name',
        loai_chu_the: 'ca_nhan',
        nguoi_dai_dien: 'Z'.repeat(201),
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('200 ký tự'));
});

test('ho-so POST validates CMND format (not 9-12 digits)', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'Valid Name',
        loai_chu_the: 'ca_nhan',
        cmnd_cccd: '123',
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('CMND/CCCD phải 9-12'));
});

test('ho-so POST validates phone format (not 9-11 digits)', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'Valid Name',
        loai_chu_the: 'ca_nhan',
        sdt: '123',
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Số điện thoại phải 9-11'));
});

test('ho-so POST validates invalid email in NVP', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      nguoi_vi_pham: {
        ten: 'Valid Name',
        loai_chu_the: 'ca_nhan',
        email: 'not-an-email',
      },
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Email không hợp lệ'));
});

test('ho-so POST validates UUID for loai_vi_pham_id', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'test',
      loai_vi_pham_id: 'not-a-uuid',
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('UUID'));
});

// ── Ho-so: khac-phuc validation ───────────────────────────────

test('ho-so/:id/khac-phuc POST rejects missing bien_phap', async () => {
  // Need a ho_so first — use raw SQL to insert one quickly since all the
  // DB dependencies for POST /ho-so would require too many round trips.
  await pool.query(
    "INSERT INTO ho_so (ma_ho_so,trang_thai,nguoi_nop_id,mo_ta) VALUES ('TEST-KP','da_ra_quyet_dinh',(SELECT id FROM users WHERE username=$1 LIMIT 1),'kp-test')",
    [TEST_ADMIN_USERNAME]
  );
  const hs = (await pool.query("SELECT id FROM ho_so WHERE ma_ho_so='TEST-KP' LIMIT 1")).rows[0];
  await pool.query(
    "INSERT INTO quyet_dinh (ma_quyet_dinh,bien_ban_id,ho_so_id,nguoi_ky_id,so_tien_phat,can_cu_phap_ly,trang_thai) SELECT 'TEST-QD-DUMMY',NULL,$1,(SELECT id FROM users WHERE username=$2),0,'ccpl','draft'",
    [hs.id, TEST_ADMIN_USERNAME]
  );

  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so/${hs.id}/khac-phuc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Biện pháp là bắt buộc'));
});

test('ho-so/:id/khac-phuc POST rejects bien_phap >1000 chars', async () => {
  const hsRows = (await pool.query("SELECT id FROM ho_so WHERE ma_ho_so='TEST-KP' LIMIT 1")).rows;
  const hsId = hsRows[0].id;
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so/${hsId}/khac-phuc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bien_phap: 'B'.repeat(1001) }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('1000 ký tự'));
});

test('ho-so/:id/khac-phuc POST rejects mo_ta >5000 chars', async () => {
  const hsRows = (await pool.query("SELECT id FROM ho_so WHERE ma_ho_so='TEST-KP' LIMIT 1")).rows;
  const hsId = hsRows[0].id;
  const token = await login();
  const res = await fetch(`${base}/api/v1/ho-so/${hsId}/khac-phuc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bien_phap: 'fix', mo_ta: 'M'.repeat(5001) }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('5000 ký tự'));
});

// ── Bao-cao: optional field length guards ─────────────────────

test('bao-cao POST rejects nguoi_gui_ten >200 chars', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'Report',
      longitude: 105.85,
      latitude: 21.02,
      nguoi_gui_ten: 'T'.repeat(201),
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('200 ký tự'));
});

test('bao-cao POST rejects dia_chi >1000 chars', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'Report',
      longitude: 105.85,
      latitude: 21.02,
      dia_chi: 'D'.repeat(1001),
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('1000 ký tự'));
});

test('bao-cao POST validates coordinate required', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mo_ta: 'Report' }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Tọa độ'));
});

test('bao-cao POST validates reporter phone format', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'Report',
      longitude: 105.85,
      latitude: 21.02,
      nguoi_gui_sdt: 'badphone',
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Số điện thoại người gửi phải 9-11'));
});

test('bao-cao POST validates reporter email format', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/bao-cao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mo_ta: 'Report',
      longitude: 105.85,
      latitude: 21.02,
      nguoi_gui_email: 'bad-email',
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Email người gửi không hợp lệ'));
});

// ── Admin-users: create endpoint email/phone validation ───────

test('admin-users POST rejects invalid email format', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: 'newuser1',
      password: 'StrongPass1',
      full_name: 'New User',
      email: 'invalid-email',
      phone: '0123456789',
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Email không hợp lệ'));
});

test('admin-users POST rejects invalid phone format', async () => {
  const token = await login();
  const res = await fetch(`${base}/api/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: 'newuser2',
      password: 'StrongPass1',
      full_name: 'New User',
      email: 'n2@n.com',
      phone: '123',
    }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Số điện thoại phải 9-11'));
});

// ── Admin-users: PATCH email/phone validation ─────────────────

test('admin-users PATCH rejects invalid email when email is present', async () => {
  // Create a real user first via API so we have something to patch
  await pool.query(
    "INSERT INTO users (username,password_hash,full_name,email,phone,is_active) VALUES ('patchtest','hashed','Patch Me','patch@test.com','0987654321',true)"
  );
  const userId = (await pool.query("SELECT id FROM users WHERE username='patchtest'")).rows[0].id;

  const token = await login();
  const res = await fetch(`${base}/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Email không hợp lệ'));
});

test('admin-users PATCH rejects invalid phone when phone is present', async () => {
  const userId = (await pool.query("SELECT id FROM users WHERE username='patchtest'")).rows[0].id;

  const token = await login();
  const res = await fetch(`${base}/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ phone: 'bad' }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Số điện thoại phải 9-11'));
});

test('admin-users PATCH allows partial update without email/phone validation', async () => {
  const userId = (await pool.query("SELECT id FROM users WHERE username='patchtest'")).rows[0].id;

  const token = await login();
  const res = await fetch(`${base}/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ full_name: 'Updated Name' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `PATCH should succeed with partial update, got ${res.status}`);
});

// ── Auth: reset-password validation ───────────────────────────

test('reset-password rejects missing token', async () => {
  const body = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: 'NewPass1' }),
  });
  assert.ok(body.error?.includes('Token là bắt buộc'));
});

test('reset-password rejects weak new password', async () => {
  const body = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'some-token', new_password: 'weak' }),
  });
  assert.ok(body.error?.includes('Mật khẩu phải tối thiểu 8 ký tự'));
});

// ── Ho-so: status transition validation ───────────────────────

test('ho-so/trang-thai rejects invalid state value', async () => {
  const token = await login();
  // Find any existing ho_so
  const hsRow = (await pool.query("SELECT id FROM ho_so LIMIT 1")).rows[0];
  if (!hsRow) {
    // Insert one we can use
    const created = await pool.query(
      "INSERT INTO ho_so (ma_ho_so,trang_thai,nguoi_nop_id,mo_ta) VALUES ('ST-AUTH','cho_tiep_nhan',(SELECT id FROM users WHERE username=$1 LIMIT 1),'status-test') RETURNING id",
      [TEST_ADMIN_USERNAME]
    );
    const res = await fetch(`${base}/api/v1/ho-so/${created.rows[0].id}/trang-thai`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trang_thai: 'INVALID_STATE' }),
    });
    const body = await res.json();
    assert.ok(body.error?.includes('Trạng thái hồ sơ không hợp lệ'));
    return;
  }
  const res = await fetch(`${base}/api/v1/ho-so/${hsRow.id}/trang-thai`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ trang_thai: 'INVALID_STATE' }),
  });
  const body = await res.json();
  assert.ok(body.error?.includes('Trạng thái hồ sơ không hợp lệ'));
});
