'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3198;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, token;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  // Login to get token
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

// --- CSV export ---

test('GET /api/v1/thong-ke/xuat?loai=csv trả CSV hợp lệ', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=csv`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.ok(r.headers.get('content-disposition')?.includes('.csv'), 'should have .csv filename');

  const text = await r.text();
  // CSV may be empty (just BOM) if no data exists — that's still valid
  const clean = text.replace(/^\ufeff/, '');
  if (clean.trim()) {
    assert.ok(clean.includes('ma_ho_so'), 'CSV with data should contain ma_ho_so header column');
  }
});

// --- PDF export ---

test('GET /api/v1/thong-ke/xuat?loai=pdf trả PDF hợp lệ', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=pdf`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /attachment; filename="bao-cao-.*\.pdf"/);

  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 0, 'PDF should not be empty');
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
});

// --- Invalid loai ---

test('GET /api/v1/thong-ke/xuat?loai=xyz trả 400', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=xyz`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.match(body.error, /csv và pdf/);
});

// --- 401 khi chưa đăng nhập ---

test('GET /api/v1/thong-ke/xuat không có token trả 401', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=pdf`);
  assert.equal(r.status, 401);
});

// --- Audit log ---

test('GET /api/v1/admin/audit-log trả audit log', async () => {
  const r = await fetch(`${base}/api/v1/admin/audit-log`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(Array.isArray(b.data), 'data should be an array');
  assert.ok(typeof b.page === 'number', 'page should be a number');
});

// --- Password change ---

test('PATCH /api/v1/auth/password đổi mật khẩu', async () => {
  // Đổi sang mật khẩu mới
  const r = await fetch(`${base}/api/v1/auth/password`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ old_password: TEST_ADMIN_PASSWORD, new_password: 'NewPass123' }),
  });
  assert.equal(r.status, 200);

  // Login với mật khẩu mới
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: 'NewPass123' }),
  });
  assert.equal(login.status, 200);

  // Đổi lại mật khẩu cũ
  const b = await login.json();
  token = b.token; // update global token for subsequent tests
  await fetch(`${base}/api/v1/auth/password`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ old_password: 'NewPass123', new_password: TEST_ADMIN_PASSWORD }),
  });
});

// --- ho-so/:id trả khac_phuc[] ---

test('GET /api/v1/ho-so/:id trả khac_phuc[]', async () => {
  // Cần có ho-so trong DB
  const list = await fetch(`${base}/api/v1/ho-so?page=1&limit=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const lb = await list.json();
  if (lb.data?.length > 0) {
    const r = await fetch(`${base}/api/v1/ho-so/${lb.data[0].id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.ok(Array.isArray(b.data.khac_phuc), 'khac_phuc should be an array');
  }
});
