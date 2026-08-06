process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD } = require('./test-config');

const PORT = 0;
let server;
let pool;

async function json(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  return { response, body: await response.json() };
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-setup-admin-test-uploads';
  pool = createPool();
  // Clean ALL data so setup-admin tests see needsSetup=true
  // Must cascade: reports reference users, so delete reports first
  await pool.query('DELETE FROM khac_phuc');
  await pool.query('DELETE FROM quyet_dinh');
  await pool.query('DELETE FROM bien_ban');
  await pool.query('DELETE FROM ho_so');
  await pool.query('DELETE FROM bao_cao_vi_pham');
  await pool.query('DELETE FROM user_roles');
  await pool.query('DELETE FROM audit_log');
  try {
    await pool.query('DELETE FROM token_blocklist');
  } catch {
    /* table may not exist */
  }
  await pool.query('DELETE FROM users');
  await new Promise((resolve, reject) => {
    server = buildApp({ pool }).listen(PORT, '127.0.0.1');
    server.on('listening', resolve);
    server.on('error', reject);
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('needsSetup=true khi chưa có admin', async () => {
  const result = await json('/api/v1/auth/setup-status');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.needsSetup, true);
});

test('tạo admin đầu tiên thành công + auto-login', async () => {
  const result = await json('/api/v1/auth/setup-admin', {
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
  console.error(
    '[DEBUG] setup-admin response:',
    result.response.status,
    JSON.stringify(result.body)
  );
  console.error(
    '[DEBUG] setup-admin response:',
    result.response.status,
    JSON.stringify(result.body)
  );
  assert.equal(result.response.status, 201);
  assert.ok(result.body.token);
  assert.equal(result.body.user.username, 'admin');
  assert.deepEqual(result.body.user.roles, ['admin']);
  assert.ok(result.body.user.permissions.includes('admin.users'));
});

test('gọi lần 2 → 409 (admin đã tồn tại)', async () => {
  const result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin2',
      password: TEST_ADMIN_PASSWORD,
      full_name: 'Admin khác',
      email: 'admin2@qlttxd.local',
    }),
  });
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /đã tồn tại/);
});

test('needsSetup=false sau khi đã có admin', async () => {
  const result = await json('/api/v1/auth/setup-status');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.needsSetup, false);
});

test('password yếu → 400', async () => {
  // Too short
  let result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'test',
      password: 'short',
      full_name: 'Test User',
      email: 'test@test.com',
    }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /8 ký tự/);

  // No number
  result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'test',
      password: 'NoNumberHere',
      full_name: 'Test User',
      email: 'test@test.com',
    }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /chữ số/);

  // No letter
  result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'test',
      password: '12345678',
      full_name: 'Test User',
      email: 'test@test.com',
    }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /chữ/);
});

test('thiếu full_name → 400', async () => {
  const result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'test',
      password: 'Valid@2026',
      email: 'test@test.com',
    }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /Họ tên/);
});

test('thiếu cả email và phone → 400', async () => {
  const result = await json('/api/v1/auth/setup-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'test',
      password: 'Valid@2026',
      full_name: 'Test User',
    }),
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /Email hoặc số điện thoại/);
});
