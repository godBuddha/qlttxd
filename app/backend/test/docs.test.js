const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { version: PKG_VERSION } = require('../package.json');

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

test('GET /api/v1/docs trả OpenAPI spec với version đồng bộ package.json', async () => {
  const res = await fetch(`${base}/api/v1/docs`);
  assert.equal(res.status, 200);
  assert.ok((res.headers.get('content-type') || '').includes('application/json'));
  const spec = await res.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.version, PKG_VERSION);
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

// H-06: spec parse hợp lệ + cover đủ nhóm endpoint chính, không lộ secret trong spec
test('OpenAPI spec cover đủ nhóm endpoint chính (health, auth, ho-so, bao-cao, thong-ke, thong-bao, attachments, admin)', async () => {
  const res = await fetch(`${base}/api/v1/docs`);
  const spec = await res.json();
  const paths = Object.keys(spec.paths);

  // health: live + ready
  assert.ok(paths.includes('/health/live'), 'thiếu /health/live');
  assert.ok(paths.includes('/health/ready'), 'thiếu /health/ready');

  // auth
  assert.ok(paths.includes('/auth/login'), 'thiếu /auth/login');
  assert.ok(paths.includes('/auth/me'), 'thiếu /auth/me');

  // ho-so
  assert.ok(paths.includes('/ho-so'), 'thiếu /ho-so');
  assert.ok(paths.includes('/ho-so/{id}/trang-thai'), 'thiếu /ho-so/{id}/trang-thai');

  // bao-cao
  assert.ok(paths.includes('/bao-cao'), 'thiếu /bao-cao');

  // thong-ke
  assert.ok(paths.includes('/thong-ke/tong-quan'), 'thiếu /thong-ke/tong-quan');

  // thong-bao
  assert.ok(paths.includes('/thong-bao'), 'thiếu /thong-bao');
  assert.ok(paths.includes('/thong-bao/stream'), 'thiếu /thong-bao/stream');

  // attachments
  assert.ok(paths.includes('/attachments/{filename}/view'), 'thiếu /attachments/{filename}/view');

  // admin
  assert.ok(paths.includes('/admin/users'), 'thiếu /admin/users');
  assert.ok(paths.includes('/admin/roles'), 'thiếu /admin/roles');

  // Mọi path có ít nhất 1 operation
  for (const p of paths) {
    const ops = Object.keys(spec.paths[p]).filter((k) =>
      ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(k)
    );
    assert.ok(ops.length > 0, `path ${p} không có operation hợp lệ`);
  }
});

test('OpenAPI spec không chứa secret/credential (token/password/secret example)', async () => {
  const res = await fetch(`${base}/api/v1/docs`);
  const raw = await res.text();
  // Không được có ví dụ giá trị cụ thể của token/password/secret bên ngoài schema mô tả
  assert.ok(!/"(token|password|secret)"\s*:\s*"[^"{}]*[A-Za-z0-9]{8,}/.test(raw),
    'spec không được chứa example value của token/password/secret');
  // Không được xuất hiện chuỗi bí mật điển hình ("giá trị thật" của credential)
  assert.ok(!/test-secret-that-is-long-enough|JWT_SECRET\s*[:=]/i.test(raw),
    'spec không được lộ chuỗi bí mật');
});
