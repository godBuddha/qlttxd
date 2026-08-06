// Unit tests for UserTokensCleanup (#9) — mock pool, no DB required.
const test = require('node:test');
const assert = require('node:assert/strict');
const { UserTokensCleanup } = require('../user-tokens-cleanup');

function createMockPool() {
  const queries = [];
  return {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
    _queries: queries,
  };
}

test('UserTokensCleanup: _cleanup xóa user_tokens cũ hơn 30 ngày', async () => {
  const pool = createMockPool();
  const cleanup = new UserTokensCleanup({ pool, intervalMs: 60 * 60 * 1000 });
  await cleanup._cleanup();
  assert.equal(pool._queries.length, 1);
  assert.match(pool._queries[0].sql, /DELETE FROM user_tokens WHERE created_at < now\(\)/);
  assert.equal(pool._queries[0].params[0], 30);
  cleanup.destroy();
});

test('UserTokensCleanup: _cleanup không crash khi query lỗi', async () => {
  const pool = {
    async query() {
      throw new Error('boom');
    },
  };
  const cleanup = new UserTokensCleanup({ pool, intervalMs: 60000 });
  await cleanup._cleanup(); // must not throw
  assert.ok(true);
  cleanup.destroy();
});

test('UserTokensCleanup: destroy dừng timer', () => {
  const cleanup = new UserTokensCleanup({
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
