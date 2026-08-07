// =============================================================================
// Regression verification (REG-VERIFY-01) for audit issues already fixed:
//   C-02 — Đổi mật khẩu invalidate toàn bộ token (access + refresh)
//   C-03 — Trust proxy: req.ip từ X-Forwarded-For của proxy tin cậy; chống spoof
//
// VERIFY-CURRENT-STATE: these tests assert behaviour of the current code. They
// do NOT re-implement business logic. During verification it was found that
// `invalidateUserTokens` only revoked access tokens but left refresh tokens
// valid, so an extra `DELETE FROM refresh_tokens` was added to close that
// gap — the test below asserts the full required behaviour.
// =============================================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { buildApp, createPool } = require('../server');

const JWT = 'test-secret-that-is-long-enough-for-jwt';
const OLD_PW = 'OldPass123';
const NEW_PW = 'NewPass456';

function mockPool() {
  return { query: async () => ({ rows: [] }) };
}

// ---------------------------------------------------------------------------
// C-03 : Trust proxy — req.ip honours X-Forwarded-For from a trusted proxy,
//        and an untrusted client cannot spoof it.
// ---------------------------------------------------------------------------
function setTrust(trustVal) {
  if (trustVal === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = String(trustVal);
}

async function ipServer(port, trustVal) {
  process.env.JWT_SECRET = JWT;
  setTrust(trustVal);
  const app = buildApp({ pool: mockPool() });
  app.get('/__echo_ip', (req, res) =>
    res.json({ ip: req.ip, xff: req.headers['x-forwarded-for'] || null })
  );
  // app.listen() returns the underlying http.Server (has .close())
  return app.listen(port, '127.0.0.1');
}

test('C-03: trust proxy mặc định (1) lấy IP từ X-Forwarded-For proxy tin cậy', async () => {
  const port = 3310;
  const app = await ipServer(port, undefined, null);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__echo_ip`, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    const b = await r.json();
    assert.equal(b.ip, '203.0.113.9', 'req.ip phải phản ánh X-Forwarded-For');
  } finally {
    await new Promise((r) => app.close(r));
  }
});

test('C-03: trust proxy=1 chỉ tin hop gần nhất, không dùng giá trị spoof xa hơn', async () => {
  const port = 3311;
  const app = await ipServer(port, undefined, null);
  try {
    // X-Forwarded-For: <client-attacker-liable>, <trusted-proxy>
    const r = await fetch(`http://127.0.0.1:${port}/__echo_ip`, {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    const b = await r.json();
    // With trust=1 only the nearest proxy hop is trusted, so req.ip is the
    // value the trusted proxy vouches for — never the leftmost attacker value.
    assert.equal(b.ip, '5.6.7.8');
  } finally {
    await new Promise((r) => app.close(r));
  }
});

test('C-03: TRUST_PROXY=0 — client không thể spoof, X-Forwarded-For bị bỏ qua', async () => {
  const port = 3312;
  const app = await ipServer(port, 0, null);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__echo_ip`, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    const b = await r.json();
    assert.equal(b.ip, '127.0.0.1', 'không tin proxy thì XFF phải bị bỏ qua (chống spoof)');
  } finally {
    await new Promise((r) => app.close(r));
    delete process.env.TRUST_PROXY;
  }
});

// ---------------------------------------------------------------------------
// C-02 : Đổi mật khẩu thu hồi toàn bộ token (access + refresh).
//        Uses a dedicated non-admin user so the shared admin is untouched.
// ---------------------------------------------------------------------------
const C02_PORT = 3313;
let c02Server;
let c02Pool;
let c02UserId;

async function c02Json(path, options = {}) {
  const r = await fetch(`http://127.0.0.1:${C02_PORT}${path}`, options);
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
}

function refreshFromSetCookie(headers) {
  const cookie = headers.get('set-cookie') || '';
  const m = cookie.match(/qlttxd_refresh_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = JWT;
  process.env.UPLOAD_DIR = '/tmp/qlttxd-regression-c02-uploads';
  c02Pool = createPool();
  // Dedicated test user (not admin) so we never disturb the shared admin.
  const uname = `reg_c02_${Date.now()}`;
  await c02Pool.query(
    `INSERT INTO users (username, full_name, password_hash, email, is_active)
     VALUES ($1, $2, $3, $4, true) ON CONFLICT (username) DO NOTHING`,
    [uname, 'Regression C02', bcrypt.hashSync(OLD_PW, 10), `${uname}@test.local`]
  );
  const u = await c02Pool.query('SELECT id FROM users WHERE username=$1', [uname]);
  c02UserId = u.rows[0].id;
  c02Server = buildApp({ pool: c02Pool }).listen(C02_PORT, '127.0.0.1');
  await new Promise((r) => c02Server.on('listening', r));
});

test.after(async () => {
  await new Promise((r) => c02Server.close(r));
  // Remove the dedicated user regardless of test outcome.
  try {
    await c02Pool.query('DELETE FROM users WHERE id=$1', [c02UserId]);
  } catch {}
  await c02Pool.end();
});

test('C-02: sau khi đổi mật khẩu, access token cũ + refresh token cũ bị thu hồi; login mật khẩu mới OK', async () => {
  const unameResult = await c02Pool.query('SELECT username FROM users WHERE id=$1', [c02UserId]);
  const uname = unameResult.rows[0].username;

  async function doLogin(user, pass) {
    const r = await c02Json('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    return r;
  }

  // 1. Login → capture old access + refresh token
  const login = await doLogin(uname, OLD_PW);
  assert.equal(login.status, 200);
  const oldAccess = login.body.token;
  const oldRefresh = refreshFromSetCookie(login.headers);
  assert.ok(oldRefresh, 'login phải trả refresh token cookie');

  // 2. Đổi mật khẩu
  const ch = await c02Json('/api/v1/auth/password', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${oldAccess}` },
    body: JSON.stringify({ old_password: OLD_PW, new_password: NEW_PW }),
  });
  assert.equal(ch.status, 200);

  // 3. Access token cũ → 401
  const me = await c02Json('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${oldAccess}` },
  });
  assert.equal(me.status, 401, 'access token cũ phải bị thu hồi sau đổi mật khẩu');
  assert.match(me.body.error || '', /thu hồi/);

  // 4. Refresh token cũ → 401 (không thể đổi access token mới)
  const ref = await c02Json('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `qlttxd_refresh_token=${oldRefresh}` },
  });
  assert.equal(ref.status, 401, 'refresh token cũ phải bị thu hồi sau đổi mật khẩu');
  assert.match(ref.body.error || '', /thu hồi|hết hạn/);

  // 5. Login lại bằng mật khẩu mới → OK
  const loginNew = await doLogin(uname, NEW_PW);
  assert.equal(loginNew.status, 200);
  assert.ok(loginNew.body.token);

  // 6. Login bằng mật khẩu cũ → 401
  const loginOld = await doLogin(uname, OLD_PW);
  assert.equal(loginOld.status, 401);
});
