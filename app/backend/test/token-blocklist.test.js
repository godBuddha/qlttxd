const test = require('node:test');
const assert = require('node:assert/strict');
const { TokenBlocklist } = require('../token-blocklist');

/** Minimal mock pool that simulates token_blocklist queries using an in-memory Map. */
function createMockPool() {
  const store = new Map(); // jti -> expiresAt (Date)
  return {
    async query(sql, params) {
      // INSERT INTO token_blocklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT ...
      if (sql.startsWith('INSERT')) {
        const [jti, expiresAt] = params;
        store.set(jti, new Date(expiresAt));
        return { rows: [] };
      }
      // SELECT 1 FROM token_blocklist WHERE jti = $1 AND expires_at > now()
      if (sql.startsWith('SELECT')) {
        const [jti] = params;
        const exp = store.get(jti);
        if (exp && exp > new Date()) return { rows: [{ '?column?': 1 }] };
        return { rows: [] };
      }
      // DELETE FROM token_blocklist WHERE expires_at < now()
      if (sql.startsWith('DELETE')) {
        const now = new Date();
        for (const [jti, exp] of store) {
          if (exp < now) store.delete(jti);
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
    _store: store,
  };
}

test('TokenBlocklist: add + has co ban', async () => {
  const pool = createMockPool();
  const bl = new TokenBlocklist({ pool });
  await bl.add('jti-1');
  assert.equal(await bl.has('jti-1'), true);
  assert.equal(await bl.has('jti-2'), false);
  bl.destroy();
});

test('TokenBlocklist: has tra false sau TTL het han', async () => {
  const pool = createMockPool();
  const bl = new TokenBlocklist({ pool, ttlMs: 50 }); // 50ms TTL
  await bl.add('jti-expire');
  assert.equal(await bl.has('jti-expire'), true);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(await bl.has('jti-expire'), false);
  bl.destroy();
});

test('TokenBlocklist: cleanup don het entry het han', async () => {
  const pool = createMockPool();
  const bl = new TokenBlocklist({ pool, ttlMs: 30 }); // 30ms TTL
  await bl.add('jti-a');
  await bl.add('jti-b');
  assert.equal(pool._store.size, 2);
  await new Promise((r) => setTimeout(r, 50));
  await bl._cleanup();
  assert.equal(pool._store.size, 0);
  bl.destroy();
});

test('TokenBlocklist: add(null/undefined) khong crash', async () => {
  const pool = createMockPool();
  const bl = new TokenBlocklist({ pool });
  await bl.add(null);
  await bl.add(undefined);
  await bl.add('');
  assert.equal(await bl.has(null), false);
  assert.equal(await bl.has(undefined), false);
  assert.equal(pool._store.size, 0);
  bl.destroy();
});

test('TokenBlocklist: destroy dung timer', async () => {
  const pool = createMockPool();
  const bl = new TokenBlocklist({ pool });
  await bl.add('jti-x');
  bl.destroy();
  // After destroy, the timer is cleared; entries remain in DB but cleanup stops
  assert.equal(pool._store.size, 1);
});
