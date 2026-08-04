const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3106;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

async function ensureAdmin() {
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
  assert.equal(login.response.status, 200);
  return login.body.token;
}

async function login(username = TEST_ADMIN_USERNAME, password = TEST_ADMIN_PASSWORD) {
  const result = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.body.token);
  return result.body.token;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-blocklist-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  // Ensure admin exists for all tests
  await ensureAdmin();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('token có JTI sau khi login', async () => {
  const jwt = require('jsonwebtoken');
  const token = await login();
  const decoded = jwt.decode(token);
  assert.ok(decoded.jti, 'JWT phải có trường jti');
  assert.match(decoded.jti, /^[0-9a-f-]{36}$/, 'JTI phải là UUID');
});

test('logout thành công và token bị revoke', async () => {
  const token = await login();

  // Dùng token để truy cập protected route - phải OK
  const me1 = await json('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(me1.response.status, 200);

  // Logout
  const logout = await json('/api/v1/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.message, 'Đăng xuất thành công');

  // Dùng token cũ sau logout → phải 401
  const me2 = await json('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(me2.response.status, 401);
  assert.match(me2.body.error, /thu hồi/);
});

test('token mới login vẫn hoạt động sau khi token cũ bị revoke', async () => {
  const token1 = await login();

  // Logout token1
  await json('/api/v1/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token1}`, 'content-type': 'application/json' },
  });

  // Login token2
  const token2 = await login();
  assert.notEqual(token1, token2, 'Hai lần login phải tạo token khác nhau');

  // token2 hoạt động bình thường
  const me = await json('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${token2}` },
  });
  assert.equal(me.response.status, 200);

  // token1 vẫn bị block
  const blocked = await json('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${token1}` },
  });
  assert.equal(blocked.response.status, 401);
});
