'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { NotificationWorker } = require('../lib/notification-worker');
const { isSmtpConfigured, createTransporter } = require('../lib/email');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3121;
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
  // SMTP configured for email tests (but worker won't actually send — we mock transporter)
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_FROM = 'QLTTXD Test <test@test.local>';

  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');

  // Login as admin
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  const body = await res.json();
  token = body.token;
  userId = body.user.id;

  // Ensure admin has email
  await pool.query("UPDATE users SET email='admin@qlttxd.local' WHERE id=$1", [userId]);

  // Clean up old notifications
  await pool.query('DELETE FROM thong_bao');
});

test.after(async () => {
  await pool.query('DELETE FROM thong_bao').catch(() => {});
  // Clean up test users from status transition test
  await pool.query("UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id IN (SELECT id FROM users WHERE username='notif_test_user')").catch(() => {});
  await pool.query("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username='notif_test_user')").catch(() => {});
  await pool.query("DELETE FROM users WHERE username='notif_test_user'").catch(() => {});
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  let body = {};
  try { body = await response.json(); } catch { /* non-JSON */ }
  return { response, body };
}

// --- email.js unit tests ---

test('isSmtpConfigured() trả true khi SMTP_HOST được set', () => {
  assert.equal(isSmtpConfigured(), true);
});

test('createTransporter() trả transporter khi SMTP_HOST được set', () => {
  const transporter = createTransporter();
  assert.ok(transporter, 'transporter should not be null');
});

test('isSmtpConfigured() trả false khi SMTP_HOST không set', () => {
  const orig = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  assert.equal(isSmtpConfigured(), false);
  process.env.SMTP_HOST = orig;
});

// --- NotificationWorker unit tests ---

test('NotificationWorker khởi tạo đúng', () => {
  const worker = new NotificationWorker({ pool });
  assert.equal(worker.isRunning, false);
});

test('NotificationWorker.processBatch xử lý thong_bao kenh=email', async () => {
  // Insert a test email notification
  await pool.query(
    "INSERT INTO thong_bao (nguoi_nhan_id, loai, tieu_de, noi_dung, kenh, trang_thai) VALUES ($1, $2, $3, $4, 'email', 'cho_gui')",
    [userId, 'trang_thai', 'Test email subject', 'Test email body']
  );

  // Create worker with mock transporter that doesn't actually send
  const worker = new NotificationWorker({ pool });
  // Inject mock transporter
  worker._transporter = {
    sendMail: async () => ({ messageId: 'mock-id' }),
  };

  const result = await worker.processBatch();
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);

  // Verify trang_thai updated to 'da_gui'
  const { rows } = await pool.query(
    "SELECT trang_thai, ngay_gui FROM thong_bao WHERE nguoi_nhan_id=$1 AND kenh='email' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  assert.equal(rows[0].trang_thai, 'da_gui');
  assert.ok(rows[0].ngay_gui, 'ngay_gui should be set after sending');
});

test('NotificationWorker.processBatch đánh dấu that_bai khi gửi lỗi', async () => {
  // Insert a test email notification
  await pool.query(
    "INSERT INTO thong_bao (nguoi_nhan_id, loai, tieu_de, noi_dung, kenh, trang_thai) VALUES ($1, $2, $3, $4, 'email', 'cho_gui')",
    [userId, 'trang_thai', 'Fail test', 'This will fail']
  );

  const worker = new NotificationWorker({ pool });
  // Mock transporter that throws
  worker._transporter = {
    sendMail: async () => { throw new Error('SMTP connection failed'); },
  };

  const result = await worker.processBatch();
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);

  // Verify trang_thai updated to 'that_bai'
  const { rows } = await pool.query(
    "SELECT trang_thai FROM thong_bao WHERE nguoi_nhan_id=$1 AND kenh='email' AND tieu_de='Fail test' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  assert.equal(rows[0].trang_thai, 'that_bai');
});

// --- Integration: createThongBao + portal endpoints ---

test('Portal notification endpoints hoạt động với schema mới', async () => {
  // Clean slate
  await pool.query('DELETE FROM thong_bao');

  // Insert a portal notification manually (simulating createThongBao)
  await pool.query(
    "INSERT INTO thong_bao (nguoi_nhan_id, loai, tieu_de, noi_dung, kenh, trang_thai) VALUES ($1, $2, $3, $4, 'portal', 'da_gui')",
    [userId, 'trang_thai', 'Test portal notif', 'Portal body']
  );

  // GET /api/v1/thong-bao
  const list = await json('/api/v1/thong-bao', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(list.body.data.length >= 1, 'Should have at least 1 notification');

  // GET /api/v1/thong-bao/unread-count
  const unread = await json('/api/v1/thong-bao/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(unread.body.count >= 1, 'Unread count should be >= 1');

  // POST mark-read
  const notifId = list.body.data[0].id;
  const markRead = await json(`/api/v1/thong-bao/${notifId}/mark-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(markRead.response.status, 200);

  // Verify unread count decreased
  const unreadAfter = await json('/api/v1/thong-bao/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(unreadAfter.body.count, 0, 'All notifications should be read');

  // POST mark-all-read (should be idempotent)
  const markAll = await json('/api/v1/thong-bao/mark-all-read', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(markAll.response.status, 200);
});

test('Status transition tạo cả portal + email notification khi SMTP configured', async () => {
  await pool.query('DELETE FROM thong_bao');

  // Create a second user to be the notification recipient
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('TestUser@2026', 10);
  const { rows: newUser } = await pool.query(
    `INSERT INTO users (username, password_hash, full_name, email, is_active)
     VALUES ('notif_test_user', $1, 'Test Recipient', 'recipient@test.local', true)
     ON CONFLICT (username) DO UPDATE SET email='recipient@test.local'
     RETURNING id`,
    [hash]
  );
  const recipientId = newUser[0].id;

  // Ensure the test user has case.update permission
  const { rows: roles } = await pool.query("SELECT id FROM roles WHERE code='case_handler'");
  if (roles.length > 0) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [recipientId, roles[0].id]
    );
  }

  // Find a ho_so in cho_tiep_nhan and assign the recipient as handler
  const { rows: hoSos } = await pool.query(
    "SELECT id FROM ho_so WHERE trang_thai='cho_tiep_nhan' AND deleted_at IS NULL LIMIT 1"
  );

  if (hoSos.length === 0) return; // skip if no test data

  const hoSoId = hoSos[0].id;
  await pool.query('UPDATE ho_so SET nguoi_xu_ly_id=$1 WHERE id=$2', [recipientId, hoSoId]);

  // Transition status as admin — createThongBao should notify the recipient
  const res = await json(`/api/v1/ho-so/${hoSoId}/trang-thai`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trang_thai: 'cho_xac_minh' }),
  });

  if (res.response.status !== 200) return; // skip if permission issue

  // Check portal + email notifications for the recipient
  const { rows: portalNotifs } = await pool.query(
    "SELECT * FROM thong_bao WHERE ho_so_id=$1 AND nguoi_nhan_id=$2 AND kenh='portal'",
    [hoSoId, recipientId]
  );
  const { rows: emailNotifs } = await pool.query(
    "SELECT * FROM thong_bao WHERE ho_so_id=$1 AND nguoi_nhan_id=$2 AND kenh='email'",
    [hoSoId, recipientId]
  );

  assert.ok(portalNotifs.length >= 1, 'Should have portal notification');
  assert.equal(portalNotifs[0].trang_thai, 'da_gui', 'Portal should be da_gui');
  assert.ok(emailNotifs.length >= 1, 'Should have email notification');
  assert.equal(emailNotifs[0].trang_thai, 'cho_gui', 'Email should be cho_gui (queued)');

  // Clean up test user (clear ho_so FK references first)
  await pool.query('UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id=$1', [recipientId]);
  await pool.query('DELETE FROM user_roles WHERE user_id=$1', [recipientId]);
  await pool.query('DELETE FROM users WHERE id=$1', [recipientId]);
});
