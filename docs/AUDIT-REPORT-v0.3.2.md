# AUDIT REPORT — QLTTXD v0.3.2

## Production Readiness Review — Round 1

**Reviewer:** Principal Software Architect & Engineering Reviewer  
**Date:** 2026-08-04  
**Scope:** Full-stack system audit (Backend, Frontend, Database, Security, UX, DevOps, Documentation)

---

## Executive Summary

Hệ thống QLTTXD v0.3.2 đã đạt mức **functional completeness** khá tốt cho một sản phẩm quản lý trật tự xây dựng. Tuy nhiên, có **6 vấn đề Critical**, **11 vấn đề High**, **15 vấn đề Medium**, và **12 vấn đề Low** cần được xử lý trước khi production release.

**Điểm mạnh:**

- RBAC 5 vai trò + 27 quyền chi tiết, thiết kế tốt
- State machine 13 trạng thái có kiểm soát
- Audit log bất biến cho mọi thao tác
- PostGIS integration tốt cho dữ liệu không gian
- Token blocklist + refresh token rotation
- Rate limiting nhiều lớp
- OpenAPI spec đã có (dù chưa đầy đủ)

**Điểm yếu chính:**

- Code readability cực kỳ kém (single-line components, compressed routes)
- Thiếu frontend tests hoàn toàn
- Lỗ hổng bảo mật: token leaked qua URL, password change không invalidate tokens
- Không có client-side routing (browser back/forward không hoạt động)
- Trust proxy không cấu hình → audit log sai IP
- reset_token không có cleanup → token cũ accumulate vô hạn

---

## 🔴 CRITICAL (6 issues)

### C-01: JWT Token leaked via URL query parameters

**1. Vấn đề:** Ảnh minh chứng được truy cập qua URL `GET /uploads/:filename?token=<JWT>`. Token cũng được đưa vào `<img src>` attributes.

**2. Tại sao đây là vấn đề:**

- Token xuất hiện trong browser history, server access logs, proxy logs
- Token bị leak qua `Referer` header khi truy cập tài nguyên bên ngoài
- Nếu có XSS, attacker có thể lấy token từ URL
- Vi phạm nguyên tắc OWASP: không đưa secrets vào URL

**3. Mức độ:** 🔴 **Critical**

**4. Đề xuất giải pháp:**

- Tạo endpoint `GET /api/v1/attachments/:filename/signed` trả về redirect 302 với signed URL có thời hạn ngắn (HMAC-based, 5 phút)
- Frontend: thay `?token=` bằng endpoint mới
- Hoặc dùng cookie-based auth cho image serving

**5. Task:**

- Tạo signed URL endpoint với HMAC + expiry
- Frontend: thay `?token=` bằng signed URL
- Xóa hẳn query param `?token=` khỏi image serving endpoint

**6. Acceptance Criteria:**

- Không có JWT token nào xuất hiện trong URL
- Ảnh vẫn hiển thị bình thường cho user có quyền
- Signed URL hết hạn sau 5 phút, không thể reuse

---

### C-02: Password change không invalidate existing tokens

**1. Vấn đề:** `PATCH /api/v1/auth/password` đổi mật khẩu nhưng không gọi `invalidateUserTokens()`. Tất cả token cũ (access + refresh) vẫn hợp lệ. (`invalidateUserTokens` chỉ được gọi trong `admin-users.js` khi admin thay đổi vai trò người dùng.)

**2. Tại sao đây là vấn đề:**

- Nếu attacker đã lấy được token, đổi mật khẩu không cắt quyền truy cập
- Vi phạm OWASP: password change phải invalidate all sessions

**3. Mức độ:** 🔴 **Critical**

**4. Đề xuất giải pháp:**

```javascript
// Trong PATCH /api/v1/auth/password, sau khi update password:
await invalidateUserTokens(pool, req.user.id);
```

**5. Task:** Thêm `invalidateUserTokens` vào password change endpoint.

**6. Acceptance Criteria:**

- Sau đổi mật khẩu, tất cả token cũ bị revoke
- User phải đăng nhập lại với mật khẩu mới
- Refresh token cũ cũng bị vô hiệu hóa

---

### C-03: Trust Proxy không cấu hình → Audit log sai IP

**1. Vấn đề:** Server chạy sau Caddy reverse proxy nhưng không cấu hình `trust proxy`. `req.ip` luôn trả về IP của Docker container (`172.x.x.x`), không phải IP thật của client. Không có `trust proxy` nào được set trong toàn bộ backend code.

**2. Tại sao đây là vấn đề:**

- Audit log ghi sai IP nguồn cho mọi hành động
- Không thể trace lại user khi có sự cố bảo mật
- Rate limiting dựa trên IP không hiệu quả

**3. Mức độ:** 🔴 **Critical** (cho hệ thống chính quyền)

**4. Đề xuất giải pháp:**

```javascript
app.set('trust proxy', 1); // trust first proxy (Caddy)
```

**5. Task:** Thêm trust proxy configuration vào server.js.

**6. Acceptance Criteria:**

- `req.ip` trả về IP thật của client
- Audit log ghi đúng IP nguồn
- Rate limiting phân biệt được các client khác nhau

---

### C-04: Không có client-side routing (Browser History API)

**1. Vấn đề:** Frontend dùng `useState` để quản lý routing (`route.page`). Không có browser history integration.

**2. Tại sao đây là vấn đề:**

- Nút Back/Forward của browser không hoạt động
- Không thể share URL đến một trang cụ thể (deep linking)
- Không thể bookmark một hồ sơ cụ thể
- Refresh trang → mất context, quay về trang mặc định

**3. Mức độ:** 🔴 **Critical** (UX)

**4. Đề xuất giải pháp:**

- Tích hợp `window.history.pushState/popstate`
- URL pattern: `/cases`, `/cases/:id`, `/admin/users`, v.v.

**5. Task:** Implement browser history integration.

**6. Acceptance Criteria:**

- Browser Back/Forward hoạt động đúng
- URL thay đổi khi navigate
- Refresh trang giữ nguyên context

---

### C-05: Không có frontend tests

**1. Vấn đề:** Frontend hoàn toàn không có unit tests hay component tests.

**2. Tại sao đây là vấn đề:** Không có safety net cho refactoring, không phát hiện regression.

**3. Mức độ:** 🔴 **Critical** (Quality)

**4. Đề xuất giải pháp:** Setup Vitest + React Testing Library.

**5. Task:** Setup frontend test framework và viết tests cho 5 critical flows.

**6. Acceptance Criteria:**

- Vitest + RTL configured
- Ít nhất 20 test cases
- Tests chạy trong CI

---

### C-06: Code readability cực kỳ kém

**1. Vấn đề:** Nhiều file frontend viết compressed trên 1 dòng:

- `CaseDetail.jsx` dòng 15: ~2000 ký tự
- `main.jsx` dòng 66: ~5000 ký tự
- `ho-so.js` route handlers: compressed 1 dòng

**2. Tại sao đây là vấn đề:** Không thể code review, debug, hay onboarding.

**3. Mức độ:** 🔴 **Critical** (Maintainability)

**4. Đề xuất giải pháp:** Chạy `npm run format`, enforce pre-commit hook.

**5. Task:** Format toàn bộ codebase.

**6. Acceptance Criteria:** Không còn dòng nào > 120 ký tự, readable indentation.

---

## 🟠 HIGH (11 issues)

### H-01: Custom routing không có route guards

**1. Vấn đề:** Không có mechanism bảo vệ routes theo permission.

**2. Mức độ:** 🟠 **High**

**3. Task:** Tạo `ProtectedRoute` component kiểm tra permission.

**4. Acceptance Criteria:** User không có quyền → hiển thị 403.

---

### H-02: Thiếu database migration runner

**1. Vấn đề:** `schema.sql` dùng `DROP TABLE IF EXISTS ... CASCADE` →每次 chạy sẽ xóa hết dữ liệu. Không có automated migration runner.

**2. Mức độ:** 🟠 **High**

**3. Task:** Implement migration runner đọc từ `sql/migrations/`, ghi version vào `schema_migrations`.

**4. Acceptance Criteria:** `npm run migrate` chạy incremental, không bao giờ DROP.

---

### H-03: State machine UX — Dropdown hiển thị tất cả states

**1. Vấn đề:** CaseDetail.jsx hiển thị dropdown với tất cả 13 trạng thái, không chỉ valid transitions.

**2. Mức độ:** 🟠 **High** (UX)

**3. Task:** Frontend chỉ hiển thị valid transitions.

**4. Acceptance Criteria:** Dropdown chỉ có trạng thái hợp lệ.

---

### H-04: Missing indexes cho queries thường dùng

**1. Vấn đề:** Thiếu indexes:

- `bao_cao_vi_pham(nguoi_gui_id)` — citizen report list
- `thong_bao(nguoi_nhan_id, trang_thai)` — unread-count
- Partial index cho `ho_so WHERE deleted_at IS NULL`

**2. Mức độ:** 🟠 **High** (Performance)

**3. Task:** Thêm indexes vào migration.

---

### H-05: Không có error boundary cho lazy-loaded pages

**1. Vấn đề:** Lỗi ở một page crash toàn bộ app.

**2. Mức độ:** 🟠 **High** (Reliability)

**3. Task:** Wrap mỗi `<Suspense>` trong `<ErrorBoundary>`.

---

### H-06: OpenAPI spec version mismatch + thiếu Swagger UI

**1. Vấn đề:** OpenAPI spec trong `routes/docs.js` ghi version `0.2.1` (cũ) trong khi package.json là `0.3.2`. Không có Swagger UI.

**2. Mức độ:** 🟠 **High** (Developer Experience)

**3. Task:** Update version, mount Swagger UI tại `/api/docs`.

---

### H-07: Notification polling thay vì WebSocket/SSE

**1. Vấn đề:** BellNotification poll mỗi 30 giây, không real-time.

**2. Mức độ:** 🟠 **High** (UX/Performance)

**3. Task:** Implement SSE cho notifications.

---

### H-08: Không có audit_log retention policy

**1. Vấn đề:** Audit log grow vô hạn.

**2. Mức độ:** 🟠 **High** (Scalability)

**3. Task:** Implement archival/partitioning strategy.

---

### H-09: `cors` package installed but not used

**1. Vấn đề:** `cors` trong dependencies nhưng CORS xử lý manual.

**2. Mức độ:** 🟠 **High** (Code quality)

**3. Task:** Remove unused dependency.

---

### H-10: Service Worker caching có thể serve stale content

**1. Vấn đề:** Cache-first strategy có thể serve phiên bản cũ sau deploy.

**2. Mức độ:** 🟠 **High** (Reliability)

**3. Task:** Fix caching strategy hoặc disable SW.

---

### H-11: reset_token không có cleanup mechanism

**1. Vấn đề:** `reset_token` table không có scheduled cleanup. Token cũ (cả used và expired) accumulate vô hạn.

**2. Tại sao đây là vấn đề:** Table grow vô hạn, potential info leak nếu DB bị compromise.

**3. Mức độ:** 🟠 **High** (Security/Scalability)

**4. Task:** Thêm scheduled cleanup (token_blocklist đã có cleanup timer, cần thêm cho reset_token).

---

## 🟡 MEDIUM (15 issues)

### M-01: Thiếu input validation consistency

### M-02: Không có pagination total cho audit-log endpoint

### M-03: Frontend không debounce search input

### M-04: Missing ARIA labels và keyboard navigation

### M-05: localStorage cho token storage (XSS vulnerability)

### M-06: Không có PWA manifest

### M-07: Thiếu loading/skeleton states

### M-08: BOM version mismatch (README v0.2.1 vs package.json v0.3.2)

### M-09: Missing khoan 11 trong seed data

### M-10: Remedy component UX confusion (hint text cũ)

### M-11: Không có database backup automation

### M-12: Express error handler quá compressed (1 dòng)

### M-13: Không có request timeout

### M-14: Không có health check dependency validation

### M-15: ban-do endpoint không pagination (tải tất cả vi phạm)

---

## 🟢 LOW (12 issues)

### L-01: `nodemailer` dependency nhưng email không phải core feature

### L-02: Không có code splitting granular

### L-03: `file-type` mentioned in README nhưng không trong dependencies

### L-04: Global CSS (styles.css) — risk conflict khi scale

### L-05: Không có error tracking service (Sentry, v.v.)

### L-06: Test credentials hardcoded (Qlttxd@2026)

### L-07: Không có TypeScript

### L-08: PDF export thiếu header/footer (số trang, ngày xuất)

### L-09: Không có dark mode

### L-10: Docker image không tối ưu

### L-11: danh-muc endpoints public (không cần auth) — có thể cần hạn chế

### L-12: Không có `helmet` cho production CSP (styleSrc: 'unsafe-inline')

---

## Summary Table

| Severity    | Count | Status                     |
| ----------- | ----- | -------------------------- |
| 🔴 Critical | 6     | Cần fix trước production   |
| 🟠 High     | 11    | Nên fix trước production   |
| 🟡 Medium   | 15    | Fix trong sprint tiếp theo |
| 🟢 Low      | 12    | Backlog                    |

## Recommended Priority Order

1. **C-03** (Trust proxy) — Fix ngay, 1 dòng code
2. **C-02** (Password change invalidate tokens) — Fix ngay, 2 dòng code
3. **C-06** (Code formatting) — Chạy `npm run format`
4. **H-11** (reset_token cleanup) — Fix nhanh
5. **H-04** (Missing indexes) — Fix nhanh
6. **H-03** (State machine UX) — Fix nhanh
7. **C-04** (Client-side routing) — Cần design + implement
8. **C-01** (Token in URL) — Cần design signed URL
9. **C-05** (Frontend tests) — Cần setup framework
10. Các issues còn lại theo thứ tự ưu tiên

---

## Appendix: Files Audited

| Area     | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | server.js, routes/auth.js, routes/ho-so.js, routes/bao-cao.js, routes/thong-ke.js, routes/thong-bao.js, routes/admin-users.js, routes/admin-locations.js, routes/admin-catalogs.js, routes/danh-muc.js, routes/ban-do.js, routes/docs.js, utils/middleware.js, utils/helpers.js, utils/logger.js, utils/rate-limit.js, utils/rate-limit-user.js, utils/constants.js, utils/upload.js, utils/sanitize.js, token-blocklist.js, lib/email.js, gov_docx.js                                                                                                                                                                                                                                                     |
| Frontend | main.jsx, src/lib/api.js, src/lib/AuthContext.jsx, src/lib/constants.js, src/pages/Dashboard.jsx, src/pages/CaseList.jsx, src/pages/CaseDetail.jsx, src/pages/CitizenPage.jsx, src/pages/ProfilePage.jsx, src/pages/ReportPage.jsx, src/pages/OfficerReportsPage.jsx, src/pages/BanDoPage.jsx, src/components/Login.jsx, src/components/SetupAdminPage.jsx, src/components/ForgotPassword.jsx, src/components/BellNotification.jsx, src/components/MapView.jsx, src/components/ErrorBoundary.jsx, src/components/NotFound.jsx, src/components/Status.jsx, src/components/Loading.jsx, src/admin/AdminUsersPage.jsx, src/admin/AdminRolesPage.jsx, src/styles.css, index.html, vite.config.js, public/sw.js |
| Database | sql/schema.sql, sql/seed.sql, sql/migrations/                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| DevOps   | docker-compose.yml, Caddyfile, backend/Dockerfile, frontend/Dockerfile, frontend/Dockerfile.caddy, .env.example                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Config   | package.json (root, backend, frontend), .eslintrc.json, .prettierrc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

_Report generated by Principal Software Architect review._
