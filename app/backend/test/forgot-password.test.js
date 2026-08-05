// Set rate limit before any requires so it's picked up by buildApp()
process.env.RATE_LIMIT_MAX = '200';
// Enable dev_token in tests (no SMTP configured)
process.env.NODE_ENV = 'development';
process.env.QLTTXD_DEBUG_TOKENS = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3120;
const base = `http://127.0.0.1:${PORT}`;
let server;
let pool;
let token;
let userId;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-test-uploads';
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  // Login as admin to get user id
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  const body = await res.json();
  token = body.token;
  userId = body.user.id;

  // Ensure admin has email for forgot-password lookup
  await pool.query("UPDATE users SET email='admin@qlttxd.local' WHERE id=$1", [userId]);

  // Clean up any leftover reset tokens
  await pool.query('DELETE FROM reset_token');
});

test.after(async () => {
  // Clean up reset tokens
  await pool.query('DELETE FROM reset_token').catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  let body = {};
  try { body = await response.json(); } catch { /* non-JSON response */ }
  return { response, body };
}

// --- forgot-password endpoint ---

test('POST /api/v1/auth/forgot-password trả 400 nếu thiếu identifier', async () => {
  const { response, body } = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /bắt buộc/);
});

test('POST /api/v1/auth/forgot-password trả 200 cho user không tồn tại (chống enumerate)', async () => {
  const { response, body } = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'nonexistent-user-xyz' }),
  });
  assert.equal(response.status, 200);
  assert.ok(body.message);
  assert.equal(body.dev_token, undefined, 'dev_token must NOT be returned for non-existent user');
});

test('POST /api/v1/auth/forgot-password tạo token cho user hợp lệ', async () => {
  const { response, body } = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: TEST_ADMIN_USERNAME }),
  });
  assert.equal(response.status, 200);
  assert.ok(body.message);
  assert.ok(body.dev_token, 'dev_token should be returned in dev mode (no SMTP_HOST)');

  // Verify token was stored in DB
  const tokens = await pool.query('SELECT * FROM reset_token WHERE user_id=$1 AND used=false', [userId]);
  assert.ok(tokens.rows.length >= 1, 'Should have at least one unused reset token');
  assert.ok(tokens.rows[0].token_hash, 'Token hash should exist');
  assert.ok(tokens.rows[0].expires_at, 'Expiry should exist');
});

test('POST /api/v1/auth/forgot-password cũng hoạt động với email', async () => {
  const { response, body } = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@qlttxd.local' }),
  });
  assert.equal(response.status, 200);
  assert.ok(body.message);
  assert.ok(body.dev_token, 'dev_token should be returned via email lookup too');
});

test('E2E: forgot → dùng dev_token reset → đăng nhập', async () => {
  // Step 1: forgot-password → get dev_token
  const { body: forgotBody } = await json('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: TEST_ADMIN_USERNAME }),
  });
  assert.ok(forgotBody.dev_token, 'Should get dev_token');

  // Step 2: reset password with dev_token
  const newPassword = 'DevTokenReset1';
  const { response: resetRes, body: resetBody } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: forgotBody.dev_token, new_password: newPassword }),
  });
  assert.equal(resetRes.status, 200);
  assert.match(resetBody.message, /thành công/);

  // Step 3: login with new password
  const { response: loginRes, body: loginBody } = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: newPassword }),
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginBody.token, 'Should get JWT after dev_token reset');

  // Restore original password
  const bcrypt = require('bcryptjs');
  const originalHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [originalHash, userId]);
});

test('POST /api/v1/auth/forgot-password ghi audit log', async () => {
  const logs = await pool.query(
    "SELECT * FROM audit_log WHERE hanh_dong='forgot_password' AND nguoi_dung_id=$1 ORDER BY thoi_gian DESC LIMIT 1",
    [userId]
  );
  assert.ok(logs.rows.length >= 1, 'Should have forgot_password audit log entry');
});

// --- reset-password endpoint ---

test('POST /api/v1/auth/reset-password trả 400 nếu thiếu token', async () => {
  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ new_password: 'NewPass123' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /Token/);
});

test('POST /api/v1/auth/reset-password trả 400 nếu mật khẩu yếu', async () => {
  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'dummy', new_password: 'short' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /tối thiểu 8/);
});

test('POST /api/v1/auth/reset-password trả 400 nếu mật khẩu không có chữ số', async () => {
  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'dummy', new_password: 'abcdefgh' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /chữ và chữ số/);
});

test('POST /api/v1/auth/reset-password trả 400 cho token không hợp lệ', async () => {
  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'invalid-token-that-does-not-exist', new_password: 'NewPass123' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /không hợp lệ|hết hạn/);
});

test('Quy trình đầy đủ: forgot → reset → đăng nhập bằng mật khẩu mới', async () => {
  // Insert a known token directly (in production this would come via email)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    'INSERT INTO reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  // Reset password with the known token
  const newPassword = 'ResetPass99';
  const { response: resetRes, body: resetBody } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: rawToken, new_password: newPassword }),
  });
  assert.equal(resetRes.status, 200);
  assert.match(resetBody.message, /thành công/);

  // Verify the token is now marked as used
  const usedToken = await pool.query('SELECT used FROM reset_token WHERE token_hash=$1', [tokenHash]);
  assert.equal(usedToken.rows[0].used, true);

  // Login with new password
  const { response: loginRes, body: loginBody } = await json('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: newPassword }),
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginBody.token, 'Should get a new JWT token after password reset');

  // Restore original password for other tests (must happen before old-password check
  // due to concurrent task modifying server.js)
  const bcrypt = require('bcryptjs');
  const originalHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [originalHash, userId]);
});

test('Token đã hết hạn bị từ chối', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiredAt = new Date(Date.now() - 1000); // 1 second ago
  await pool.query(
    'INSERT INTO reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiredAt]
  );

  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: rawToken, new_password: 'NewPass99' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /hết hạn|không hợp lệ/);
});

test('Token đã dùng bị từ chối (không thể dùng lại)', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    'INSERT INTO reset_token (user_id, token_hash, expires_at, used) VALUES ($1, $2, $3, true)',
    [userId, tokenHash, expiresAt]
  );

  const { response, body } = await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: rawToken, new_password: 'NewPass99' }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /không hợp lệ|đã hết hạn/);
});

test('POST /api/v1/auth/reset-password ghi audit log', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    'INSERT INTO reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  await json('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: rawToken, new_password: 'AuditTest123' }),
  });

  const logs = await pool.query(
    "SELECT * FROM audit_log WHERE hanh_dong='reset_password' AND nguoi_dung_id=$1 ORDER BY thoi_gian DESC LIMIT 1",
    [userId]
  );
  assert.ok(logs.rows.length >= 1, 'Should have reset_password audit log entry');

  // Restore password
  const bcrypt = require('bcryptjs');
  const originalHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [originalHash, userId]);
});
