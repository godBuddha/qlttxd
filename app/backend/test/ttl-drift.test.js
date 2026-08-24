'use strict';

// HC-01 (Settings Center Wave 0) — TTL drift regression test.
//
// JWT refresh token được ký với expiresIn = cfg('auth','jwt_refresh_ttl','7d'),
// trong khi refresh_tokens.expires_at trước đây hardcode "now() + interval '7 days'".
// Test này đảm bảo expires_at trong DB bám theo TTL cấu hình (±5s cho thời gian request).

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { ensureTestAdmin } = require('./helpers/test-db');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 0;
let server;
let pool;

async function login(username = TEST_ADMIN_USERNAME, password = TEST_ADMIN_PASSWORD) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  return { response, body };
}

/** Khoảng cách (giây) giữa expires_at của refresh token mới nhất và bây giờ */
async function latestRefreshTokenTtlSeconds(userId) {
  const r = await pool.query(
    `SELECT EXTRACT(EPOCH FROM (expires_at - now()))::int AS secs
       FROM refresh_tokens WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  assert.ok(r.rows[0], 'refresh_tokens phải có row sau login');
  return Number(r.rows[0].secs);
}

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-ttl-drift-test-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
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

test('login → refresh_tokens.expires_at ≈ now + TTL mặc định (7d = 604800s)', async () => {
  const { response } = await login();
  assert.equal(response.status, 200);

  // JWT refresh cookie cũng phải cùng TTL
  const setCookie = response.headers.get('set-cookie') || '';
  const maxAgeMatch = setCookie.match(/Max-Age=(\d+)/);
  if (maxAgeMatch) {
    assert.equal(Number(maxAgeMatch[1]), 604800, 'cookie Max-Age phải là 7 ngày');
  }

  const ttlSecs = await latestRefreshTokenTtlSeconds(
    (await pool.query('SELECT id FROM users WHERE username=$1', [TEST_ADMIN_USERNAME])).rows[0].id
  );
  assert.ok(
    Math.abs(ttlSecs - 604800) <= 5,
    `expires_at lệch ${(ttlSecs - 604800).toFixed(0)}s so với TTL 604800s (cho phép ±5s)`
  );
});

test('đổi TTL qua config cache (CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL=1h) → DB row theo TTL mới', async () => {
  // getSync() đọc env CONFIG_GLOBAL_<CAT>_<KEY> làm sync-fallback khi cache miss,
  // nên test này mô phỏng đúng đường dẫn admin đổi jwt_refresh_ttl trong Settings Center.
  process.env.CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL = '"1h"';
  try {
    // Pool mới + app mới để tránh cache đã nạp sẵn giá trị cũ từ DB seed.
    await new Promise((resolve) => server.close(resolve));
    server = null;
    const freshPool = createPool();
    server = buildApp({ pool: freshPool }).listen(PORT, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.on('listening', resolve);
      server.on('error', reject);
    });

    const { response } = await login();
    assert.equal(response.status, 200);

    const adminId = (
      await freshPool.query('SELECT id FROM users WHERE username=$1', [TEST_ADMIN_USERNAME])
    ).rows[0].id;
    const r = await freshPool.query(
      `SELECT EXTRACT(EPOCH FROM (expires_at - now()))::int AS secs
         FROM refresh_tokens WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [adminId]
    );
    const ttlSecs = Number(r.rows[0].secs);
    assert.ok(
      Math.abs(ttlSecs - 3600) <= 5,
      `expires_at lệch ${(ttlSecs - 3600).toFixed(0)}s so với TTL 3600s (1h), cho phép ±5s`
    );
  } finally {
    delete process.env.CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL;
  }
});

test('refresh flow → row mới cũng bám TTL cấu hình', async () => {
  const { response: loginRes, body } = await login();
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const refreshTokenCookie = setCookie
    .split(';')
    .find((c) => c.trim().startsWith('qlttxd_refresh_token='));
  assert.ok(refreshTokenCookie, 'login phải cấp refresh token cookie');

  const cookieValue = refreshTokenCookie.split('=').slice(1).join('=');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `qlttxd_refresh_token=${cookieValue}` },
  });
  assert.equal(response.status, 200);
  assert.ok(body.token || response.ok, 'refresh phải thành công');

  const adminId = (
    await pool.query('SELECT id FROM users WHERE username=$1', [TEST_ADMIN_USERNAME])
  ).rows[0].id;
  const ttlSecs = await latestRefreshTokenTtlSeconds(adminId);
  assert.ok(
    Math.abs(ttlSecs - 604800) <= 5,
    `row refresh sau rotate lệch ${(ttlSecs - 604800).toFixed(0)}s so với 604800s`
  );
});
