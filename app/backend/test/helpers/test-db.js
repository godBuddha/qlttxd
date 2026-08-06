'use strict';

// Shared DB test helpers — guarantee an order-independent, known-good baseline
// for the shared test database.
//
// All backend test files share ONE PostgreSQL database (PGDATABASE=qlttxd).
// Because `node --test` runs each file in its own process, environment
// variables never leak between files — but DATABASE STATE does. Any file that
// mutates shared rows (e.g. reporting changes the admin password, or
// setup-admin deletes all users) could otherwise poison every later file.
//
// `ensureTestAdmin(pool)` makes the shared 'admin' account idempotently
// correct (exists, active, has the admin role, password == TEST_ADMIN_PASSWORD).
// Call it from each test file's `before()` right after `pool = createPool()`
// and BEFORE any login/setup, so the admin is always in a known-good state
// regardless of which files ran first.

const bcrypt = require('bcryptjs');
const { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } = require('../test-config');

/**
 * Verify (and if needed reset) the shared admin account to a known-good state:
 *   - exists (created if missing)
 *   - is_active = true
 *   - password_hash matches TEST_ADMIN_PASSWORD (restored if a prior test
 *     changed it, e.g. the password-change test in reporting.test.js)
 *   - has the 'admin' role
 * Returns the admin user id. Idempotent — safe to run on every test file.
 */
async function ensureTestAdmin(pool) {
  const passwordHash = bcrypt.hashSync(TEST_ADMIN_PASSWORD, 10);

  // 1. Create the admin user if it doesn't exist (satisfies chk_contact: needs
  //    email or phone; email/phone unique).
  await pool.query(
    `INSERT INTO users (username, email, phone, full_name, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (username) DO NOTHING`,
    [
      TEST_ADMIN_USERNAME,
      'admin@qlttxd.local',
      '0901000001',
      'Quản trị viên hệ thống',
      passwordHash,
    ]
  );

  // 2. Force the password back to the shared test password so a prior file
  //    that changed it can't break login for this file.
  await pool.query(`UPDATE users SET password_hash = $1 WHERE username = $2`, [
    passwordHash,
    TEST_ADMIN_USERNAME,
  ]);

  // 3. Ensure the admin role is assigned.
  const role = await pool.query(`SELECT id FROM roles WHERE code = 'admin'`);
  const user = await pool.query(`SELECT id FROM users WHERE username = $1`, [TEST_ADMIN_USERNAME]);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2
     )`,
    [user.rows[0].id, role.rows[0].id]
  );

  return user.rows[0].id;
}

/**
 * Restore the admin password to TEST_ADMIN_PASSWORD without requiring a valid
 * token (used by teardown hooks so a password-change test can never leave the
 * shared admin account corrupted for later files).
 */
async function resetAdminPassword(pool) {
  const passwordHash = bcrypt.hashSync(TEST_ADMIN_PASSWORD, 10);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE username = $2`, [
    passwordHash,
    TEST_ADMIN_USERNAME,
  ]);
}

/**
 * Delete all non-admin (test) users after first clearing every FK reference to
 * them. Handles ALL tables that reference users(id) without ON DELETE CASCADE
 * (notably tep_dinh_kem.nguoi_tai_id, which earlier cleanups missed). Safe to
 * run repeatedly; idempotent for an already-clean DB.
 */
async function cleanupNonAdminUsers(pool) {
  await pool.query(
    "UPDATE ho_so SET nguoi_nop_id = NULL WHERE nguoi_nop_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "UPDATE ho_so SET nguoi_xu_ly_id = NULL WHERE nguoi_xu_ly_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "UPDATE bao_cao_vi_pham SET nguoi_gui_id = NULL WHERE nguoi_gui_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "UPDATE khac_phuc SET nguoi_theo_doi_id = NULL WHERE nguoi_theo_doi_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "UPDATE audit_log SET nguoi_dung_id = NULL WHERE nguoi_dung_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "DELETE FROM quyet_dinh WHERE nguoi_ky_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "DELETE FROM bien_ban WHERE nguoi_lap_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "UPDATE tep_dinh_kem SET nguoi_tai_id = NULL WHERE nguoi_tai_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query(
    "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')"
  );
  await pool.query("DELETE FROM users WHERE username != 'admin'");
}

module.exports = {
  ensureTestAdmin,
  resetAdminPassword,
  cleanupNonAdminUsers,
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
};
