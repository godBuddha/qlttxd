# SPEC T-02: Hardening — Helmet + Rate Limit

> Task: coder (backend) | Priority: P0 | Dependency: T-01

## Mục tiêu

Install và cấu hình `helmet` + `express-rate-limit` trong server.js.

## Files thay đổi

1. `app/backend/package.json` — thêm dependencies
2. `app/backend/server.js` — thêm middleware

## Chi tiết

### 1. Install

```bash
cd /workspace/ssd/qlttxd/app/backend
npm install helmet express-rate-limit
```

### 2. `server.js` — thêm middleware SAU `express.json()`

```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers (thay thế header thủ công)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'data:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

// Rate limit cho login/auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // 10 request/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/setup-admin', authLimiter);
```

### 3. Xóa header thủ công cũ (dòng 95-100)

Xóa block `res.set({ 'Content-Security-Policy': ... })` vì helmet đã xử lý.

## Acceptance Criteria

- [ ] `npm ls helmet express-rate-limit` — OK
- [ ] Response headers có: `content-security-policy`, `strict-transport-security`, `x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`
- [ ] Login rate limit: gửi 11 request trong 15 phút → request thứ 11 trả 429
- [ ] Map OSM vẫn hoạt động (img-src cho phép tile OSM)
- [ ] 70 test cũ vẫn PASS

## Test

```bash
cd /workspace/ssd/qlttxd/app/backend
npm test
curl -s -D- http://localhost:3001/health | grep -i "content-security-policy\|x-content-type-options"
```
