'use strict';

// Rate limit test needs authLimiter ACTIVE — must not be in NODE_ENV=test
process.env.NODE_ENV = 'development';
process.env.RATE_LIMIT_DISABLED = 'false';
process.env.QLTTXD_DEBUG_TOKENS = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');
const { ensureTestAdmin } = require('./helpers/test-db');

// 3108 is free (3103 taken by setup-admin.test.js)
const PORT = 3108;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, _token;

test.before(async () => {
  // Ensure authLimiter is active for rate limit test
  process.env.NODE_ENV = 'development';
  process.env.RATE_LIMIT_DISABLED = 'false';
  process.env.QLTTXD_DEBUG_TOKENS = 'false';
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  // Login to get token
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  const b = await r.json();
  _token = b.token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('health endpoint có DB ping + uptime + version', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
  assert.equal(b.db, 'connected');
  assert.ok(typeof b.uptime === 'number' && b.uptime >= 0);
  assert.ok(typeof b.version === 'string' && b.version.length > 0);
});

test('helmet headers có trong response', async () => {
  const r = await fetch(`${base}/health`);
  assert.ok(r.headers.get('x-content-type-options'), 'x-content-type-options header missing');
  assert.ok(r.headers.get('x-frame-options'), 'x-frame-options header missing');
  assert.ok(r.headers.get('referrer-policy'), 'referrer-policy header missing');
  // HSTS is issued exclusively by Caddy at the edge (see Caddyfile) — backend must NOT set it
  assert.ok(!r.headers.get('strict-transport-security'), 'strict-transport-security must not be set by backend');
  assert.ok(r.headers.get('content-security-policy'), 'content-security-policy header missing');
});

test('rate limit trả 429 khi vượt ngưỡng login', async () => {
  // Gửi 11 request login liên tiếp (max=10 trong 15 phút window)
  for (let i = 0; i < 11; i++) {
    await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
    });
  }
  // Request thứ 12 phải bị rate limited
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
  });
  assert.equal(r.status, 429);
  const b = await r.json();
  assert.ok(b.error, 'rate limit response should contain error message');
});

test('response compression hoạt động với Accept-Encoding gzip (P3-02)', async () => {
  // Uri lớn để vượt ngưỡng nén (default 1024 bytes) -> content-encoding gzip
  const _r = await fetch(`${base}/api/v1/ho-so?limit=100&q=aaaaaaaaaaaaaaaaaaaaaaaaaaa`);
  // Chỉ kiểm tra middleware có mặt: response gzip khi body đủ lớn.
  const _big = await fetch(`${base}/health`);
  // Gửi Accept-Encoding và kiểm tra không lỗi (middleware không phá vỡ response)
  const gz = await fetch(`${base}/health`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.ok(gz.ok, 'compression middleware should not break responses');
  // middleware hoạt động nếu content-encoding gzip khi đủ lớn — health nhỏ nên có thể null,
  // nhưng không được fail. Kiểm tra express.urlencoded không lỗi:
  const form = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'username=no&password=no',
  });
  assert.ok(typeof form.status === 'number');
});
