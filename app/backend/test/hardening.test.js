'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

// 3108 is free (3103 taken by setup-admin.test.js)
const PORT = 3108;
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
  const b = await r.json();
  token = b.token;
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
  assert.ok(r.headers.get('strict-transport-security'), 'strict-transport-security header missing');
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
