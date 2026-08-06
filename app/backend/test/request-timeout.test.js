'use strict';

// M-13: request timeout middleware — unit test via a standalone express app
// using the exported requestTimeout() with a short timeout so the test is fast.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { requestTimeout } = require('../server');

async function startApp(timeoutMs) {
  const app = express();
  app.use(requestTimeout(timeoutMs));
  // Handler cố tình không trả lời → bị timeout middleware chặn
  app.get('/slow', (_req, _res) => {});
  app.get('/fast', (_req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}` };
}

test('request timeout trả 408 khi handler treo (M-13)', async () => {
  const { server, base } = await startApp(200);
  try {
    const r = await fetch(`${base}/slow`, { signal: AbortSignal.timeout(5000) });
    assert.equal(r.status, 408);
    const body = await r.json();
    assert.match(body.error, /thời gian chờ/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('request nhanh không bị ảnh hưởng bởi timeout middleware (M-13)', async () => {
  const { server, base } = await startApp(30000);
  try {
    const r = await fetch(`${base}/fast`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
