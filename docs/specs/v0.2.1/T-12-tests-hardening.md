# SPEC T-12: Tests Phase B — Hardening

> Task: qa | Priority: P1 | Dependency: T-02, T-03

## Mục tiêu

Tests cho rate limit, helmet headers, health endpoint.

## Files thay đổi

1. `app/backend/test/hardening.test.js` — NEW

## Chi tiết

```js
// test/hardening.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3103;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, token;

test.before(async () => {
  // Setup same as other tests
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
  server.close();
  await pool.end();
});

test('health endpoint có DB ping + uptime', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
  assert.equal(b.db, 'connected');
  assert.ok(typeof b.uptime === 'number');
  assert.ok(b.version);
});

test('helmet headers có trong response', async () => {
  const r = await fetch(`${base}/health`);
  assert.ok(r.headers.get('x-content-type-options'));
  assert.ok(r.headers.get('x-frame-options'));
  assert.ok(r.headers.get('referrer-policy'));
});

test('rate limit trả 429 khi vượt ngưỡng login', async () => {
  // Gửi 11 request login liên tiếp
  for (let i = 0; i < 11; i++) {
    await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
    });
  }
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
  });
  assert.equal(r.status, 429);
});
```

## Acceptance Criteria

- [ ] Health test pass (DB connected, uptime, version)
- [ ] Helmet headers test pass
- [ ] Rate limit 429 test pass
- [ ] Test file `test/hardening.test.js` tồn tại
- [ ] `npm test` — tất cả test pass (bao gồm test mới)
