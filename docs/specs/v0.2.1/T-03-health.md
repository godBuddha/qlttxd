# SPEC T-03: Health Endpoint Mở rộng

> Task: coder (backend) | Priority: P1 | Dependency: T-01

## Mục tiêu
Health endpoint trả thêm DB ping + uptime + version.

## Files thay đổi
1. `app/backend/server.js` — sửa `/health`

## Chi tiết

```js
const startTime = Date.now();

app.get('/health', async (_req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      db: dbResult.rows[0]?.ok === 1 ? 'connected' : 'error',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '0.2.1'
    });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});
```

## Acceptance Criteria
- [ ] `/health` trả `{ status, db, uptime, version }`
- [ ] DB không kết nối được → 503
- [ ] Test pass
