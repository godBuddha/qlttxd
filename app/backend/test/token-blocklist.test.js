const test = require('node:test');
const assert = require('node:assert/strict');
const { TokenBlocklist } = require('../token-blocklist');

test('TokenBlocklist: add + has cơ bản', () => {
  const bl = new TokenBlocklist();
  bl.add('jti-1');
  assert.equal(bl.has('jti-1'), true);
  assert.equal(bl.has('jti-2'), false);
  assert.equal(bl.size, 1);
  bl.destroy();
});

test('TokenBlocklist: has trả false sau TTL hết hạn', async () => {
  const bl = new TokenBlocklist(50); // 50ms TTL
  bl.add('jti-expire');
  assert.equal(bl.has('jti-expire'), true);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(bl.has('jti-expire'), false);
  assert.equal(bl.size, 0); // expired entry cleaned up on has()
  bl.destroy();
});

test('TokenBlocklist: cleanup dọn hết entry hết hạn', async () => {
  const bl = new TokenBlocklist(30); // 30ms TTL
  bl.add('jti-a');
  bl.add('jti-b');
  assert.equal(bl.size, 2);
  await new Promise((r) => setTimeout(r, 50));
  bl._cleanup();
  assert.equal(bl.size, 0);
  bl.destroy();
});

test('TokenBlocklist: add(null/undefined) không crash', () => {
  const bl = new TokenBlocklist();
  bl.add(null);
  bl.add(undefined);
  bl.add('');
  assert.equal(bl.size, 0);
  assert.equal(bl.has(null), false);
  assert.equal(bl.has(undefined), false);
  bl.destroy();
});

test('TokenBlocklist: destroy xóa hết và dừng timer', () => {
  const bl = new TokenBlocklist();
  bl.add('jti-x');
  bl.destroy();
  assert.equal(bl.size, 0);
});
