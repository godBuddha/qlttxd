# SPEC T-13: Tests Phase C — Reporting + API Gaps

> Task: qa | Priority: P1 | Dependency: T-04, T-05, T-06

## Mục tiêu
Tests cho CSV/PDF export, audit log, password change.

## Files thay đổi
1. `app/backend/test/reporting.test.js` — NEW

## Chi tiết

```js
// test/reporting.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, createPool } = require('../server');
const { TEST_ADMIN_PASSWORD, TEST_ADMIN_USERNAME } = require('./test-config');

const PORT = 3104;
const base = `http://127.0.0.1:${PORT}`;
let server, pool, token;

test.before(async () => {
  pool = createPool();
  server = buildApp({ pool }).listen(PORT, '127.0.0.1');
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD })
  });
  token = (await r.json()).token;
});

test.after(async () => { server.close(); await pool.end(); });

const headers = () => ({ authorization: `Bearer ${token}` });

test('GET /api/v1/thong-ke/xuat?loai=csv trả CSV', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=csv`, { headers: headers() });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-type').includes('text/csv'));
  const text = await r.text();
  assert.ok(text.includes('ma_ho_so')); // header row
});

test('GET /api/v1/thong-ke/xuat?loai=pdf trả PDF', async () => {
  const r = await fetch(`${base}/api/v1/thong-ke/xuat?loai=pdf`, { headers: headers() });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-type').includes('application/pdf'));
});

test('GET /api/v1/admin/audit-log trả audit log', async () => {
  const r = await fetch(`${base}/api/v1/admin/audit-log`, { headers: headers() });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(Array.isArray(b.data));
  assert.ok(typeof b.page === 'number');
});

test('PATCH /api/v1/auth/password đổi mật khẩu', async () => {
  // Đổi sang mật khẩu mới
  const r = await fetch(`${base}/api/v1/auth/password`, {
    method: 'PATCH', headers: { ...headers(), 'content-type': 'application/json' },
    body: JSON.stringify({ old_password: TEST_ADMIN_PASSWORD, new_password: 'NewPass123' })
  });
  assert.equal(r.status, 200);

  // Login với mật khẩu mới
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: 'NewPass123' })
  });
  assert.equal(login.status, 200);

  // Đổi lại mật khẩu cũ
  const b = await login.json();
  await fetch(`${base}/api/v1/auth/password`, {
    method: 'PATCH', headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ old_password: 'NewPass123', new_password: TEST_ADMIN_PASSWORD })
  });
});

test('GET /api/v1/ho-so/:id trả khac_phuc[]', async () => {
  // Cần có ho-so trong DB
  const list = await fetch(`${base}/api/v1/ho-so?page=1&limit=1`, { headers: headers() });
  const lb = await list.json();
  if (lb.data?.length > 0) {
    const r = await fetch(`${base}/api/v1/ho-so/${lb.data[0].id}`, { headers: headers() });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.ok(Array.isArray(b.data.khac_phuc));
  }
});
```

## Acceptance Criteria
- [ ] CSV export test pass
- [ ] PDF export test pass
- [ ] Audit log test pass
- [ ] Password change test pass
- [ ] ho-so/:id khac_phuc test pass
- [ ] `npm test` — tất cả test pass
