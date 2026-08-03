# P1.3 Full-stack QA/E2E Acceptance Regression

Ngày: 2026-08-03
Task: t_58ffc858
Workspace: /workspace/ssd/qlttxd

## Môi trường kiểm thử

- Node: v24.18.1 (/workspace/ssd/toolchain/node/bin/node)
- PostgreSQL: 16.14 (/workspace/ssd/toolchain/postgres)
- PostGIS: 3.6.3
- Playwright: 1.55.0 (Chromium headless shell 140.0.7339.16)
- Kết nối DB: socket /tmp, role qlttxd, database qlttxd
- Backend port: 3000 (API), 3001 (browser smoke proxy)
- Frontend: Vite 7.3.6

## 1. DB Smoke — verify-db.sql

```
psql -h /tmp -U postgres -d qlttxd -f sql/verify-db.sql
```

13/13 assertions PASS:
- postgres_16_or_newer: true
- postgis_enabled: true (3.6.3)
- has_19_application_tables: true
- foreign_keys_present: true (>=20)
- spatial_indexes_present: true (3 GiST)
- srid_4326_geometry_columns: true (4 tables)
- boundary_srid_and_type_valid: true (MultiPolygon)
- seed_contains_known_point: true
- seeded_districts: true (6)
- seeded_wards: true (12)
- seeded_demo_users: true (5)
- atomic_code_format: true

## 2. Backend Tests — node --test

```
cd app/backend && PGHOST=/tmp node --test
```

7/7 PASS (726ms):
- ✔ ma trận auth/RBAC: protected 401, công dân 403, quản trị 200
- ✔ ma trận 5 vai trò: quyền nghiệp vụ server-side trả đúng 200/403
- ✔ upload giả MIME bị từ chối bằng magic-byte và CORS không mở mặc định
- ✔ JWT_SECRET không được fallback mặc định
- ✔ đăng nhập đúng và sai tuân thủ RBAC
- ✔ tạo báo cáo, hồ sơ và chuyển trạng thái
- ✔ luồng biên bản, quyết định, khắc phục và thống kê

## 3. Frontend Build

```
cd app/frontend && npm run build
```

PASS: Vite 7.3.6, 32 modules, built in 1.58s.
- dist/index.html: 0.41 kB
- dist/assets/index.css: 23.59 kB (gzip 8.85 kB)
- dist/assets/index.js: 368.21 kB (gzip 111.35 kB)

## 4. API Smoke Tests — 46 checks

Server chạy thật trên port 3000, kết nối PostgreSQL/PostGIS thật.

### 4a. Health
- GET /health: 200 {"status":"ok"} — PASS

### 4b. Auth: 401 without token (3 endpoints)
- /api/v1/bao-cao: 401 — PASS
- /api/v1/ho-so: 401 — PASS
- /api/v1/thong-ke/tong-quan: 401 — PASS

### 4c. Auth: invalid tokens
- bad token: 401 — PASS
- malformed JWT: 401 — PASS
- wrong scheme (Basic): 401 — PASS

### 4d. Auth: login wrong credentials
- wrong username: 401 — PASS
- wrong password: 401 — PASS
- empty body: 400 — PASS

### 4e. Auth: login correct — 5 demo users
- admin: 200 + token — PASS
- handler.hn (case_handler): 200 + token — PASS
- verifier.hn (verifier): 200 + token — PASS
- leader.hn (leader): 200 + token — PASS
- citizen.nga (citizen): 200 + token — PASS

### 4f. Auth: /me endpoint
- GET /api/v1/auth/me (admin): 200 — PASS

### 4g. RBAC: admin full access
- /api/v1/bao-cao: 200 — PASS
- /api/v1/ho-so: 200 — PASS
- /api/v1/thong-ke/tong-quan: 200 — PASS

### 4h. RBAC: citizen restrictions
- /api/v1/thong-ke/tong-quan: 403 — PASS (expected: no report.statistics)
- /api/v1/bao-cao: 200 — PASS (has report.view_own)
- /api/v1/ho-so: 403 — PASS (expected: no case.view)

### 4i. RBAC: handler access
- /api/v1/bao-cao: 403 — PASS (expected: no report.view_own, handlers use case management)
- /api/v1/ho-so: 200 — PASS (has case.view)

### 4j. RBAC: leader access
- /api/v1/thong-ke/tong-quan: 200 — PASS (has report.statistics)

### 4k. Security Headers (5/5 PASS)
- Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: no-referrer
- Permissions-Policy: geolocation=(), microphone=(), camera=()

### 4l. CORS
- evil origin: ACAO=NOT SET — PASS (blocked)
- valid origin (qlttxd.example.gov.vn): ACAO=https://qlttxd.example.gov.vn — PASS

### 4m. Danh mục (reference data)
- /api/v1/danh-muc/loai-vi-pham: 200 — PASS
- /api/v1/danh-muc/hanh-vi: 200 — PASS
- /api/v1/danh-muc/quan-huyen: 200 — PASS
- /api/v1/danh-muc/phuong-xa: 200 — PASS

## 5. E2E Full Workflow

Toàn bộ flow nghiệp vụ chạy trên server thật, DB thật:

| Bước | Endpoint | Kết quả |
|---|---|---|
| Tạo báo cáo | POST /api/v1/bao-cao | 201, BC-2026-xxxxxx |
| Tạo hồ sơ | POST /api/v1/ho-so | 201, HS-2026-xxxxxx, cho_tiep_nhan |
| Tiếp nhận | PATCH trang-thai → cho_xac_minh | 200 |
| Xác minh | PATCH trang-thai → dang_xac_minh | 200 |
| Hoàn tất xác minh | PATCH trang-thai → cho_lap_bien_ban | 200 |
| Lập biên bản | POST .../bien-ban | 201, BB-2026-xxxxxx |
| Chuyển QĐ | PATCH trang-thai → cho_ra_quyet_dinh | 200 |
| Ban hành QĐ | POST .../quyet-dinh | 201, QD-2026-xxxxxx |
| Đăng ký khắc phục | POST .../khac-phuc | 201 |
| Hoàn tất khắc phục | PATCH /api/v1/khac-phuc/:id | 200 |
| Đóng hồ sơ | PATCH trang-thai → da_dong | 200 |
| Kiểm tra cuối | GET /api/v1/ho-so/:id | 200, trang_thai=da_dong, 1 BB, 1 QD |
| Thống kê | GET /api/v1/thong-ke/tong-quan | 200, da_dong: 1 |

## 6. Browser E2E — BLOCKED

Playwright Chromium 140.0.7339.16 đã cài đặt nhưng thiếu 20+ host shared libraries:
libglib-2.0, libgobject-2.0, libnspr4, libnss3, libdbus-1, libatk-1.0, libX11, libgbm, libxkbcommon, libasound, ...

Đây là known risk đã ghi nhận từ T10. Cần `sudo npx playwright install-deps` hoặc cài đặt thủ công.

## 7. Kết luận

| Tiêu chí | Kết quả |
|---|---|
| Backend tests (node --test) | PASS 7/7 |
| Frontend build (npm run build) | PASS (32 modules, 1.58s) |
| DB verify (verify-db.sql) | PASS 13/13 |
| Health smoke | PASS |
| Auth: 401/401/bad-token/login | PASS |
| RBAC: 5 vai trò 200/403 đúng | PASS |
| Security headers | PASS 5/5 |
| CORS | PASS |
| E2E critical path (login→BC→HS→BB→QĐ→KP→đóng) | PASS |
| Browser E2E (DOM/screenshot) | BLOCKED — thiếu Chromium host libs |
| Application code modified | KHÔNG (chỉ QA, không sửa) |

**Verdict: PASS** — tất cả kiểm thử API và E2E backend đạt. Browser E2E bị chặn bởi môi trường (thiếu system libraries), không phải lỗi code.

## Known Risks

1. Browser E2E cần cài Chromium host dependencies (libglib2.0-0, libnss3, libatk*, X11, libasound2, ...)
2. ILIKE search wildcards không escape trong /api/v1/ho-so?q= (LOW severity, đã ghi ở P1.2)
3. JWT logout stateless — token vẫn valid 8h nếu bị đánh cắp
4. Seed GIS polygons là hình chữ nhật giả lập, production cần dữ liệu GIS chính thức
5. Không có rate-limiting trên login endpoint
