'use strict';

// Shared test configuration — single source of truth for test credentials.
// Password must match the seed convention (Qlttxd@2026) so that when tests
// run sequentially and share the same database, the admin created by the first
// test file can be reused by later files via login fallback.

const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Qlttxd@2026';
const TEST_ADMIN_USERNAME = 'admin';

module.exports = { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME };
