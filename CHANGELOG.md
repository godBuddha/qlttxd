# CHANGELOG

## v0.3.4 (2026-08-26) — Audit remediation (GĐ1–GĐ7)

Chương trình audit + remediation trên nhánh `resolve-pending`: audit nền tảng
(discovery, DB integrity, API contract, traceability, runtime, performance)
theo quy trình ORCH-00 → ORCH-06, kèm hai batch sửa lỗi.

### FIX-BATCH-1

- **DEF-006:** Sửa contract `onPick` bản đồ GIS — trả object thay vì giá trị rời rạc
- **DEF-009:** Chốt RBAC ma trận trạng thái (`role_state_permissions`) + migration 008 seed ma trận case_handler 4 trạng thái
- **DEF-010:** Dọn path config — bỏ `lib/config.js`, frontend đọc qua Settings Center; xóa sạch tham chiếu
- **DEF-007:** Bỏ khối route 404 thừa

### FIX-BATCH-2

- **DEF-001:** Thêm `PUT /api/v1/config/workflow/states/:code` — đổi label trạng thái workflow (perm `config.edit.workflow`, audit log, 400/404)
- **DEF-002 / DEF-011:** Thêm `PUT /api/v1/config/security/mime-types/:mime` — bật/tắt `is_active` của MIME type

### Docs-sync & verify

- `.env.example` bổ sung biến nghiệp vụ code đang đọc (DEF-004): FRONTEND_URL, LOG_LEVEL, RATE_LIMIT_DISABLED, PGCONNECT_TIMEOUT, PGSSLMODE + mục riêng biến chỉ dùng test/dev (QLTTXD_DEBUG_TOKENS, TEST_ADMIN_PASSWORD)
- Runbook vận hành: ghi chú migration 001–003 không có file down (rollback qua backup/restore)
- Suite cuối: BE 309/309 PASS, FE vitest 112/112 PASS + build OK
- Perf baseline GĐ7-A: 6 endpoint đo thật, median 4–77 ms (<100 ms)

## v0.3.3 (2026-08-09)

### Tính năng mới — Enterprise Settings Center

- **ConfigService:** Cấu hình runtime từ database (`system_config` table), cache-in-memory, pg_notify real-time push
- **17 Config API endpoints:** GET/PUT/POST `config`, workflow states/transitions/role-permissions, export/import, validation rules, notification channels, MIME types, config history + rollback
- **Migration 005:** 9 bảng mới (`system_config`, `config_history`, `config_schema`, `workflow_states`, `workflow_transitions`, `role_state_permissions`, `allowed_mime_types`, `notification_channels`, `validation_rules`) với 54 seed records
- **ConfigProvider React Context:** Dynamic config cho toàn bộ app (JWT TTL, bcrypt rounds, rate limits, upload limits, pagination...)
- **useConfig hook:** Declarative config access trong components
- **12 Settings pages** — Admin UI quản lý cấu hình: Overview, Auth, Upload, Rate Limit, Security, Notifications, Pagination, Cleanup, Pool, SSE, Version, Workflows (States/Transitions/Role Permissions)

### Cải tiến

- **constants.js refactored:** Static constants → dynamic helpers (`getStates()`, `getStateLabels()`, `getTransitions()`) từ DB-backed workflow-rules
- **7 modules inject ConfigService:** TokenBlocklist, ResetTokenCleanup, UserTokensCleanup, AuditRetention, auth routes, ho-so routes, danh-muc routes — không còn hardcoded values
- **Route order bảo mật:** Workflow config routes định nghĩa TRƯỚC `/:category/:key` parameterized route để tránh collision

### Tests & Verification

- Backend config-service tests: **37/37 PASS** (bao gồm bugfix jsonb serialization cho PUT endpoint)
- Frontend vitest: **70/70 PASS** (12 test files)
- E2E smoke: Login ✅, Config CRUD ✅, Workflow APIs ✅, Auth edge cases (no token/bad token → 401) ✅
- Known limitation: Browser screenshots blocked by missing system libs in CI container (libglib, libnss, libX11)

### Bugs fixed

- **CRITICAL:** `PUT /api/v1/config/:category/:key` trả về 500 "invalid input syntax for type json" — raw JS value `'10m'` được cast `$2::jsonb` thay vì pre-encoded JSON string. Fix: dùng `$2::text::jsonb` với `newValStr = JSON.stringify(newValue)` [routes/config.js]

## v0.2.1 (2026-08-06)

### Tính năng mới

- **Hardening bảo mật:** Helmet security headers (CSP/HSTS/nosniff), Rate limit cho auth endpoints (429)
- **Health mở rộng:** DB ping + uptime + version
- **Đổi mật khẩu:** Endpoint `PATCH /api/v1/auth/password`
- **Audit log:** Endpoint `GET /api/v1/admin/audit-log` với filter + phân trang
- **Xuất báo cáo:** CSV + PII masking theo quyền
- **Xuất PDF:** Báo cáo PDF tiếng Việt

### Frontend mới

- Trang Nhật ký hệ thống (Audit Log) — admin
- Trang Danh mục (loại vi phạm, hành vi, mức phạt) — admin
- Trang Hồ sơ cá nhân + đổi mật khẩu — tất cả user
- Trang Báo cáo/Thống kê + nút xuất CSV/PDF
- Hiển thị ảnh minh chứng trong chi tiết hồ sơ

### Cải tiến

- `schema_migrations` table trong schema
- `GET /api/v1/ho-so/:id` trả thêm `khac_phuc[]`
- `admin.locations` permission trong seed

### Tests & Security

- 91/91 backend tests PASS (tăng từ 70)
- Frontend build PASS
- verify-db.sql: 18/18 checks PASS
- Security review: 0 HIGH findings
  - Helmet: CSP, HSTS 1yr, nosniff, X-Frame-Options, Referrer-Policy
  - Rate limit: 10req/15min trên login + setup-admin
  - Password change: old_password required + bcrypt
  - Audit log: full CRUD logging (user, action, table, IP, request_id)
  - PII masking: phone/email theo quyền
  - Error handler: generic 500, no stack trace leak
  - JWT_SECRET: min 32 chars enforced

### Dependencies mới

- Backend: `helmet`, `express-rate-limit`, `csv-stringify`, `pdfkit`

## v0.2.0 (2026-08-03)

- Admin CRUD quận/huyện + phường/xã
- Boundary GeoJSON MultiPolygon + preview bản đồ
- Migration 002/003
- 70 unit tests
