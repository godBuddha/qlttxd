const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');

// Self-contained OpenAPI / Swagger UI test. The /docs endpoints touch no DB,
// so this runs without a live PostgreSQL (unlike the integration suites).
let server;
let pool;
let base;

test.before(async () => {
  process.env.PGHOST = '/tmp';
  process.env.PGPORT = '5432';
  process.env.PGDATABASE = 'qlttxd';
  process.env.PGUSER = 'postgres';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  pool = createPool();
  server = buildApp({ pool }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('GET /api/v1/docs trả OpenAPI spec với version = 0.3.2', async () => {
  const res = await fetch(`${base}/api/v1/docs`);
  assert.equal(res.status, 200);
  assert.ok((res.headers.get('content-type') || '').includes('application/json'));
  const spec = await res.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.version, '0.3.2');
  assert.equal(spec.info.title, 'QLTTXD API');
});

test('GET /api/docs trả Swagger UI (HTML), giữ nguyên /api/v1/docs JSON', async () => {
  const res = await fetch(`${base}/api/docs`);
  assert.equal(res.status, 200);
  assert.ok((res.headers.get('content-type') || '').includes('text/html'));
  const html = await res.text();
  assert.ok(html.includes('id="swagger-ui"'));
  // Assets served locally (same-origin), not from a CDN
  assert.ok(html.includes('/api/docs/assets/swagger-ui-bundle.js'));
  assert.ok(html.includes('/api/docs/assets/swagger-ui.css'));
});

test('Swagger UI assets & init script được serve từ same-origin', async () => {
  const css = await fetch(`${base}/api/docs/assets/swagger-ui.css`);
  assert.equal(css.status, 200);
  assert.ok((css.headers.get('content-type') || '').includes('css'));

  const bundle = await fetch(`${base}/api/docs/assets/swagger-ui-bundle.js`);
  assert.equal(bundle.status, 200);
  assert.ok((bundle.headers.get('content-type') || '').includes('javascript'));

  const init = await fetch(`${base}/api/docs/swagger-init.js`);
  assert.equal(init.status, 200);
  const initBody = await init.text();
  assert.ok(initBody.includes('/api/v1/docs'));
});

test('Swagger UI endpoint giữ nguyên CSP script-src nghiêm ngặt (không unsafe-inline)', async () => {
  const res = await fetch(`${base}/api/docs`);
  const csp = res.headers.get('content-security-policy') || '';
  assert.ok(csp);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'script-src phải không chứa unsafe-inline');
});
