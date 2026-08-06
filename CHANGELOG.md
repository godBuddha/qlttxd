# CHANGELOG

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
