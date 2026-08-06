// Unit tests for backend quick fixes (AUDIT-B1): trust proxy config (C-03).
// Uses a mock pool — no DB required. TokenBlocklist / ResetTokenCleanup only
// need a pool object at construction time (no queries run).
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../server');

const JWT = 'test-secret-that-is-long-enough-for-jwt';

function mockPool() {
  return { query: async () => ({ rows: [] }) };
}

test('server: app được cấu hình trust proxy để req.ip trả IP thật qua X-Forwarded-For', () => {
  process.env.JWT_SECRET = JWT;
  delete process.env.TRUST_PROXY;
  const app = buildApp({ pool: mockPool() });
  assert.equal(app.get('trust proxy'), 1);
});

test('server: env TRUST_PROXY override giá trị trust proxy', () => {
  process.env.JWT_SECRET = JWT;
  process.env.TRUST_PROXY = '0';
  const app = buildApp({ pool: mockPool() });
  assert.equal(app.get('trust proxy'), '0');
  delete process.env.TRUST_PROXY;
});
