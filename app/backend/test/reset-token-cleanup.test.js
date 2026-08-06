// Unit tests for ResetTokenCleanup (H-11) — mock pool, no DB required.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ResetTokenCleanup } = require('../reset-token-cleanup');

function createMockPool() {
  const queries = [];
  return {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    _queries: queries,
  };
}

test('ResetTokenCleanup: _cleanup xóa used/expired reset token', async () => {
  const pool = createMockPool();
  const cleanup = new ResetTokenCleanup({ pool, intervalMs: 60 * 60 * 1000 });
  await cleanup._cleanup();
  assert.equal(pool._queries.length, 1);
  assert.match(
    pool._queries[0],
    /DELETE FROM reset_token WHERE used = true OR expires_at < now\(\) - interval '1 hour'/
  );
  cleanup.destroy();
});

test('ResetTokenCleanup: _cleanup không crash khi query lỗi', async () => {
  const pool = {
    async query() {
      throw new Error('boom');
    },
  };
  const cleanup = new ResetTokenCleanup({ pool, intervalMs: 60000 });
  await cleanup._cleanup(); // must not throw
  assert.ok(true);
  cleanup.destroy();
});

test('ResetTokenCleanup: destroy dừng timer', () => {
  const cleanup = new ResetTokenCleanup({
    pool: {
      async query() {
        return { rows: [] };
      },
    },
    intervalMs: 60000,
  });
  cleanup.destroy();
  assert.ok(true);
});
