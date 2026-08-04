# SPEC T-15: Docs + Release v0.2.1

> Task: deployment | Priority: P1 | Dependency: T-14

## Mục tiêu
Cập nhật docs + commit + tag v0.2.1.

## Files thay đổi
1. `CHANGELOG.md` — NEW (tạo mới)
2. `README.md` — cập nhật version + features
3. Git: commit + tag v0.2.1

## Chi tiết

### 1. CHANGELOG.md
```markdown
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

### Dependencies mới
- Backend: `helmet`, `express-rate-limit`, `csv-stringify`, `pdfkit`

## v0.2.0 (2026-08-03)
- Admin CRUD quận/huyện + phường/xã
- Boundary GeoJSON MultiPolygon + preview bản đồ
- Migration 002/003
- 70 unit tests
```

### 2. README.md
Cập nhật:
- Version: v0.2.1
- Tính năng: thêm hardening, health, export, audit log
- Dependencies: thêm helmet, express-rate-limit, csv-stringify, pdfkit

### 3. Git
```bash
cd /workspace/ssd/qlttxd
git add -A
git commit -m "feat: v0.2.1 — hardening, reporting, audit log, catalog, profile"
git tag v0.2.1
```

## Acceptance Criteria
- [ ] CHANGELOG.md tồn tại với v0.2.1
- [ ] README.md cập nhật version + features
- [ ] Git commit + tag v0.2.1
- [ ] `git status` sạch
