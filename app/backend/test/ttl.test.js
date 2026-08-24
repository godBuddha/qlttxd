'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ttlToSeconds } = require('../utils/ttl');

test('ttlToSeconds: hợp lệ — từng đơn vị', () => {
  assert.equal(ttlToSeconds('45s'), 45);
  assert.equal(ttlToSeconds('30m'), 1800);
  assert.equal(ttlToSeconds('12h'), 43200);
  assert.equal(ttlToSeconds('7d'), 604800);
});

test('ttlToSeconds: giá trị biên giới', () => {
  assert.equal(ttlToSeconds('0s'), 0);
  assert.equal(ttlToSeconds('0d'), 0);
  assert.equal(ttlToSeconds('1s'), 1);
  assert.equal(ttlToSeconds('1m'), 60);
  assert.equal(ttlToSeconds('1h'), 3600);
  assert.equal(ttlToSeconds('1d'), 86400);
  // Số nhiều chữ số
  assert.equal(ttlToSeconds('365d'), 31536000);
});

test('ttlToSeconds: trả về số nguyên (integer)', () => {
  const v = ttlToSeconds('90s');
  assert.ok(Number.isInteger(v));
  assert.equal(v, 90);
});

test('ttlToSeconds: sai định dạng → throw Error rõ ràng', () => {
  for (const bad of ['7', 'd', '7w', '7 days', '7D', '1.5h', '-5m', '+3h', '', '7dd', 'abc', ' 7d', '7d ']) {
    assert.throws(() => ttlToSeconds(bad), Error, `expected throw for '${bad}'`);
  }
  assert.throws(() => ttlToSeconds(null), Error);
  assert.throws(() => ttlToSeconds(undefined), Error);
  assert.throws(() => ttlToSeconds(604800), Error);
});

test('ttlToSeconds: thông báo lỗi nêu rõ định dạng mong đợi', () => {
  try {
    ttlToSeconds('nope');
    assert.fail('expected error');
  } catch (e) {
    assert.match(e.message, /Invalid TTL/);
    assert.match(e.message, /<number><s\|m\|d>/);
  }
});
