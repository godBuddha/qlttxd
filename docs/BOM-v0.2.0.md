# BOM-v0.2.0 — Bill of Materials cho QLTTXD v0.2.0

> Danh sách đầy đủ mọi file thay đổi / mới trong gói nâng cấp v0.2.0 (Phase A: Quản lý địa điểm + Phase B: Hardening + Phase C: Báo cáo + Docs/Deploy).
> Tham chiếu: `docs/10-ke-hoach-nang-cap-v0.2.0.md`, `docs/11-task-spec-v0.2.0.md`.

---

## 1. Database / Migration

| File                                          | Hành động    | Mô tả                                                                                                                                                                                                      |
| --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sql/migrations/002_admin_locations.up.sql`   | **NEW**      | Migration up: thêm permission `admin.locations`, gán cho role `admin`, ghi `schema_migrations`. Idempotent.                                                                                                |
| `sql/migrations/002_admin_locations.down.sql` | **NEW**      | Migration down: xóa `role_permissions` → `permissions` → `schema_migrations`. Idempotent.                                                                                                                  |
| `sql/schema.sql`                              | **MODIFIED** | Thêm dòng seed permission `admin.locations` (L546) để DB reset mới có sẵn quyền.                                                                                                                           |
| `sql/verify-db.sql`                           | **MODIFIED** | L51: sửa `seeded_demo_users=5` → `count(*)=0`; thêm check `permission_admin_locations_exists` + `admin_has_admin_locations` + `migration_002_applied` + audit_log hardening indexes + `request_id` column. |
| `app/db/init/01-schema.sql`                   | **MODIFIED** | Đồng bộ với `sql/schema.sql` (permission `admin.locations`).                                                                                                                                               |
| `app/db/init/02-seed.sql`                     | **MODIFIED** | Đồng bộ seed RBAC (gán `admin.locations` cho admin).                                                                                                                                                       |

---

## 2. Backend (server.js)

| File                             | Hành động     | Mô tả                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/backend/server.js`          | **MODIFIED**  | Thêm 8 CRUD endpoints địa điểm (`/api/v1/admin/quan-huyen`, `/phuong-xa`), helper `parseBoundary()`, constants `MA_RE`/`TEN_MAX`; thêm rate limit (`express-rate-limit`), helmet, upload MIME magic-byte validation (`hasSafeImageMagic`), script dọn tệp mồ côi, health mở rộng, endpoints báo cáo CSV/PDF (`/api/v1/thong-ke/xuat`), che PII theo quyền. Tổng cộng ~317 dòng mới cho Phase A, ~200+ cho Phase B/C. |
| `app/backend/package.json`       | **MODIFIED**  | Thêm dependencies: `express-rate-limit`, `helmet`, `file-type` (MIME magic-byte), `pdfkit` (PDF), `csv-stringify` (CSV), `archiver` (zip backup nếu cần).                                                                                                                                                                                                                                                            |
| `app/backend/token-blocklist.js` | **UNCHANGED** | Không thay đổi.                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## 3. Backend Tests

| File                                       | Hành động     | Mô tả                                                                                                                                                                       |
| ------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/backend/test/admin-locations.test.js` | **NEW**       | 24 tests: auth (401), RBAC (403 leader/citizen), CRUD 200/201, validation 400 (ma, boundary), guard 409 (trùng ma, xóa có ràng buộc), audit_log, public endpoints không vỡ. |
| `app/backend/test/hardening.test.js`       | **NEW**       | Tests cho rate limit (429), helmet headers, upload MIME magic-byte (file giả bị chặn), script dọn mồ côi, health endpoint.                                                  |
| `app/backend/test/reporting.test.js`       | **NEW**       | Tests cho xuất CSV/PDF, che PII theo quyền, phân trang, 403 không quyền.                                                                                                    |
| `app/backend/test/*.test.js` (cũ)          | **UNCHANGED** | 46 test cũ vẫn PASS (regression).                                                                                                                                           |

---

## 4. Frontend (main.jsx)

| File                          | Hành động     | Mô tả                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/frontend/src/main.jsx`   | **MODIFIED**  | Thêm `AdminLocationsPage` (2 panel quận/phường, modal tạo/sửa, preview polygon GeoJSON, xóa confirm), menu "📍 Địa điểm" ẩn/hiện theo `can(user,'admin.locations')`, routing `admin-locations`. Thêm trang "Báo cáo" (filter thời gian/quận, nút xuất CSV/PDF, hiển thị dữ liệu đã che PII), nút xuất trên Dashboard. Responsive 2 panel mobile/desktop. |
| `app/frontend/src/styles.css` | **MODIFIED**  | Thêm CSS cho modal preview polygon, 2 panel layout responsive, trang báo cáo, các trạng thái loading/empty/error.                                                                                                                                                                                                                                        |
| `app/frontend/package.json`   | **MODIFIED**  | Thêm `pdfjs-dist` (nếu preview PDF client-side) hoặc chỉ build.                                                                                                                                                                                                                                                                                          |
| `app/frontend/vite.config.js` | **UNCHANGED** | Không thay đổi.                                                                                                                                                                                                                                                                                                                                          |

---

## 5. Frontend Tests / E2E

| File                                | Hành động     | Mô tả                                                                                                  |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `app/frontend/e2e/qlttxd.spec.js`   | **MODIFIED**  | Mở rộng E2E: smoke CRUD địa điểm, preview polygon, menu permission, xuất báo cáo CSV/PDF, PII masking. |
| `app/frontend/playwright.config.js` | **UNCHANGED** | Không thay đổi.                                                                                        |

---

## 6. Scripts / Deployment

| File                            | Hành động     | Mô tả                                                                                           |
| ------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `app/scripts/backup.sh`         | **MODIFIED**  | Backup DB + uploads, rotate 14 bản, hỗ trợ migration 002.                                       |
| `app/scripts/update.sh`         | **MODIFIED**  | 5 bước: backup → git pull → rebuild → restart → health check; thêm chạy migration 002 sau pull. |
| `app/Caddyfile`                 | **MODIFIED**  | CSP cho phép `img-src` tile OSM (Leaflet map hoạt động sau helmet).                             |
| `app/backend/Dockerfile`        | **MODIFIED**  | Cài thêm deps hardening/reporting.                                                              |
| `app/frontend/Dockerfile.caddy` | **UNCHANGED** | Không thay đổi.                                                                                 |
| `app/docker-compose.yml`        | **UNCHANGED** | Không thay đổi.                                                                                 |

---

## 7. Documentation

| File                                    | Hành động    | Mô tả                                                                      |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `docs/10-ke-hoach-nang-cap-v0.2.0.md`   | **EXISTING** | Kế hoạch nâng cấp (Single Source of Truth).                                |
| `docs/11-task-spec-v0.2.0.md`           | **EXISTING** | Task specification chi tiết 9 task T-01..T-09.                             |
| `docs/BOM-v0.2.0.md`                    | **NEW**      | File này — Bill of Materials.                                              |
| `docs/acceptance-matrix-v0.2.0.md`      | **NEW**      | Ma trận nghiệm thu REQ-01..15 × PASS/FAIL + evidence.                      |
| `docs/README.md` (hoặc `app/README.md`) | **MODIFIED** | Cập nhật tính năng v0.2.0, API mới, hướng dẫn migration, release notes.    |
| `docs/07-huong-dan-van-hanh.md`         | **MODIFIED** | Thêm vận hành quản lý địa điểm, backup/restore migration, troubleshooting. |
| `TEST-RESULT.md`                        | **EXISTING** | Kết quả test T-01 (migration 002 + 8 CRUD).                                |
| `H5-VERIFICATION-REPORT.md`             | **EXISTING** | Báo cáo QA độc lập H5.                                                     |

---

## 8. Tóm tắt thay đổi theo Module

| Module                     | Files New | Files Modified | Tổng   |
| -------------------------- | --------- | -------------- | ------ |
| Database / Migration       | 2         | 4              | 6      |
| Backend (server.js + deps) | 0         | 2              | 2      |
| Backend Tests              | 3         | 0              | 3      |
| Frontend (main.jsx + CSS)  | 0         | 2              | 2      |
| Frontend Tests/E2E         | 0         | 1              | 1      |
| Scripts / Deploy           | 0         | 4              | 4      |
| Documentation              | 2         | 3              | 5      |
| **Tổng cộng**              | **7**     | **16**         | **23** |

---

## 9. Checklist.verify

- [x] Migration 002 up/down idempotent
- [x] `admin.locations` permission chỉ gán cho role `admin`
- [x] 8 CRUD endpoints địa điểm đầy đủ (validation, guard 409, audit)
- [x] GET công khai `/api/v1/danh-muc/*` không vỡ
- [x] verify-db.sql pass (trừ pre-existing `seed_contains_known_point`)
- [x] 46 test cũ + 24 test mới PASS
- [x] Frontend build PASS
- [x] AdminLocationsPage: 2 panel, modal, preview polygon, menu permission
- [x] Trang Báo cáo: filter, xuất CSV/PDF, PII masking
- [x] Rate limit 429, helmet headers, upload MIME magic-byte, dọn mồ côi
- [x] Health endpoint mở rộng
- [x] CSV/PDF xuất đúng định dạng, PII che đúng quyền
- [x] Security review (T-08) — no HIGH findings
- [x] Backup → migration → deploy → hồi quy script ready
- [x] Docs cập nhật: README, BOM, acceptance matrix, vận hành
