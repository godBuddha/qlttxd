'use strict';

// M-14: dependency-aware health — liveness vs readiness.
//  - /health/live  : process sống, luôn 200, không phụ thuộc dependency.
//  - /health/ready : DB + storage dependency thật. 200 ready / 503 not-ready.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildApp, createPool } = require('../server');
const { ensureTestAdmin } = require('./helpers/test-db');
const authRoutes = require('../routes/auth');
const { liveness, readiness, storageCheck } = require('../utils/health');

const PORT = 3116;
const base = `http://127.0.0.1:${PORT}`;
let server, pool;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.UPLOAD_DIR = '/tmp/qlttxd-health-uploads';
  pool = createPool();
  await ensureTestAdmin(pool);
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('GET /health/live luôn 200, độc lập dependency (M-14)', async () => {
  const r = await fetch(`${base}/health/live`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
  assert.ok(typeof b.uptime === 'number' && b.uptime >= 0);
  assert.ok(typeof b.version === 'string' && b.version.length > 0);
  // Liveness KHÔNG chứa secrets/connection info
  assert.ok(!('checks' in b));
  assert.ok(!('db' in b));
  assert.ok(!('error' in b));
});

test('GET /health/ready trả ready khi DB + storage khả dụng (M-14)', async () => {
  const r = await fetch(`${base}/health/ready`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ready');
  assert.equal(b.checks.db.ok, true);
  assert.equal(b.checks.storage.ok, true);
  // Không lộ secrets/connection strings
  assert.ok(!('error' in b.checks.db));
  assert.ok(!('error' in b.checks.storage));
});

// Ứng dụng với pool giả (query luôn fail) → mô phỏng DB down.
function appWithFakePool() {
  const fakePool = {
    _queryCalls: 0,
    async query() {
      this._queryCalls += 1;
      throw new Error('ECONNREFUSED 127.0.0.1:5432');
    },
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };
  const fakeTokenBlocklist = { add: async () => {}, has: async () => false };
  const noAuth = (_req, _res, next) => next();
  const noAuthorize = () => noAuth;
  const app = express();
  app.use(authRoutes({ pool: fakePool, tokenBlocklist: fakeTokenBlocklist, authenticate: noAuth, authorize: noAuthorize }));
  return { app, fakePool };
}

test('GET /health/ready trả 503 not-ready khi DB down (M-14)', async () => {
  const { app, fakePool } = appWithFakePool();
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => srv.once('listening', resolve));
  const { port } = srv.address();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health/ready`);
    assert.equal(r.status, 503);
    const b = await r.json();
    assert.equal(b.status, 'not_ready');
    assert.equal(b.checks.db.ok, false);
    // Không lộ connection string / username / password
    assert.ok(!('error' in b.checks.db) || !/ECONNREFUSED 127\.0\.0\.1/.test(b.checks.db.error || ''));
    assert.ok(fakePool._queryCalls >= 1, 'readiness phải thật sự gọi DB');
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});

test('GET /health/live vẫn 200 khi DB down (tách liveness) (M-14)', async () => {
  const { app } = appWithFakePool();
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => srv.once('listening', resolve));
  const { port } = srv.address();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health/live`);
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.status, 'ok');
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});

test('unit: readiness() true khi cả DB và storage ok', async () => {
  const okPool = { query: async () => ({ rows: [{ ok: true }] }) };
  const res = await readiness(okPool, { storageOverrides: { ok: true } });
  assert.equal(res.ready, true);
  assert.equal(res.checks.db.ok, true);
  assert.equal(res.checks.storage.ok, true);
});

test('unit: readiness() false khi DB down, cho dù storage ok', async () => {
  const badPool = { query: async () => { throw new Error('down'); } };
  const res = await readiness(badPool, { storageOverrides: { ok: true } });
  assert.equal(res.ready, false);
  assert.equal(res.checks.db.ok, false);
  assert.equal(res.checks.storage.ok, true);
});

test('unit: storageCheck() ghi/đọc/xoá probe trong upload dir', async () => {
  const res = await storageCheck('/tmp/qlttxd-health-uploads');
  assert.equal(res.ok, true);
  // Probe đã được xoá sau khi kiểm tra
  const fs = require('node:fs');
  const leftover = fs.readdirSync('/tmp/qlttxd-health-uploads').filter((f) => f.endsWith('.probe'));
  assert.equal(leftover.length, 0);
});

test('unit: liveness() không phụ thuộc pool/dependency', () => {
  const l = liveness();
  assert.equal(l.status, 'ok');
  assert.ok(typeof l.uptime === 'number');
});
