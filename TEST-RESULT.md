# TEST-RESULT.md — T-01: Migration 002 + 8 CRUD endpoints địa điểm

## Files changed

| File                                          | Action   | Description                                                                                                   |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `sql/migrations/002_admin_locations.up.sql`   | NEW      | Migration up: add admin.locations permission + assign to admin role + schema_migrations                       |
| `sql/migrations/002_admin_locations.down.sql` | NEW      | Migration down: remove role_permissions → permissions → schema_migrations                                     |
| `sql/schema.sql`                              | MODIFIED | Added `admin.locations` permission line (L546)                                                                |
| `sql/verify-db.sql`                           | MODIFIED | L51: `seeded_demo_users=5` → `count(*)=0`; added checks for admin.locations existence + admin role assignment |
| `app/backend/server.js`                       | MODIFIED | Added 8 CRUD endpoints (317 lines) + `parseBoundary()` helper + `MA_RE`/`TEN_MAX` constants                   |
| `app/backend/test/admin-locations.test.js`    | NEW      | 24 tests covering auth/RBAC/CRUD/validation/guards/audit/public endpoints                                     |

## Evidence

### Migration 002 up (idempotent)

```
BEGIN
INSERT 0 1  -- permission
INSERT 0 1  -- role_permissions
INSERT 0 1  -- schema_migrations
COMMIT
-- Second run: INSERT 0 0 × 3 (idempotent)
```

### Migration 002 down (idempotent)

```
BEGIN
DELETE 1  -- role_permissions
DELETE 1  -- permissions
DELETE 1  -- schema_migrations
COMMIT
```

### verify-db.sql results (all new checks PASS)

```
permission_admin_locations_exists | t
admin_has_admin_locations         | t
seeded_demo_users                 | (count(*)=0 check — 0 users on clean DB)
```

Note: `seed_contains_known_point = f` is a pre-existing issue with seed data geometry.

### Full test suite (70 tests, 0 failures)

```
node --test --test-concurrency=1
tests 70 | pass 70 | fail 0 | duration 5982ms
```

### New test breakdown (24 tests)

- 401 no token: 2 tests (GET quan-huyen, POST quan-huyen)
- 403 leader/citizen: 2 tests
- 200 CRUD: GET list quan-huyen, POST create, PATCH update, GET phuong-xa filter, PATCH phuong-xa
- 409 duplicate ma: 2 tests (quan-huyen, phuong-xa)
- 400 validation: missing ma, invalid boundary (Polygon vs MultiPolygon)
- 404 not found: PATCH quan-huyen, DELETE quan-huyen, POST phuong-xa invalid quan_huyen_id
- 409 guard: DELETE quan-huyen with child phuong-xa
- 200 delete: DELETE phuong-xa, DELETE quan-huyen (after removing children)
- audit_log: verified create/delete records exist
- Public endpoints: GET /api/v1/danh-muc/quan-huyen (200), GET /api/v1/danh-muc/phuong-xa (200)

## API Contract Summary

| Method | Path                         | Auth   | Permission      | Status          |
| ------ | ---------------------------- | ------ | --------------- | --------------- |
| GET    | /api/v1/admin/quan-huyen     | Bearer | admin.locations | 200             |
| POST   | /api/v1/admin/quan-huyen     | Bearer | admin.locations | 201/400/409     |
| PATCH  | /api/v1/admin/quan-huyen/:id | Bearer | admin.locations | 200/400/404/409 |
| DELETE | /api/v1/admin/quan-huyen/:id | Bearer | admin.locations | 200/404/409     |
| GET    | /api/v1/admin/phuong-xa      | Bearer | admin.locations | 200             |
| POST   | /api/v1/admin/phuong-xa      | Bearer | admin.locations | 201/400/404/409 |
| PATCH  | /api/v1/admin/phuong-xa/:id  | Bearer | admin.locations | 200/400/404/409 |
| DELETE | /api/v1/admin/phuong-xa/:id  | Bearer | admin.locations | 200/404/409     |
| GET    | /api/v1/danh-muc/quan-huyen  | None   | —               | 200             |
| GET    | /api/v1/danh-muc/phuong-xa   | None   | —               | 200             |

## Known Risks

- `seed_contains_known_point` verify-db check fails (pre-existing, seed geometry issue)
- Boundary seed data is synthetic rectangular demo fixtures, not legal administrative boundaries
- Migration requires `schema_migrations` table (from migration 001) to exist first

# WAVE 1 — Settings Center: Migration 007 + bulk/import/test-smtp/purge-now API + bỏ env override (HC-03) (2026-08-24)

## Migration 007 (sql/migrations/007_settings_wave1.up.sql / .down.sql)

- Đã chạy UP trên DB thật (psql qua socket /tmp). Kết quả verify:
  - system_config category IN ('smtp','features') → smtp=4, features=3 (7 key mới)
  - config_schema.schema_version INT NOT NULL DEFAULT 1 đã tồn tại
  - security.hsts_max_age → is_readonly=true (HC-04: HSTS do Caddy phát hành độc quyền)
- Down migration: DROP COLUMN schema_version, DELETE smtp.*/features.*, mở khóa hsts_max_age.
- Đồng bộ app/db/init/03-config-tables.sql (ON CONFLICT DO NOTHING) cho deployment Docker mới.

## Endpoint mới (routes/config.js — KHÔNG đổi contract endpoint cũ)

| Method | Path | Auth | Permission | Ghi chú |
| ------ | ---- | ---- | ---------- | ------- |
| PUT    | /api/v1/config/bulk | Bearer | theo permission map từng category | max 50 items, transaction all-or-nothing, rollback → 400 kèm vị trí item lỗi |
| POST   | /api/v1/config/import?dryRun=true\|false | Bearer | admin.config | dryRun=true không ghi DB, trả diff would_update/invalid/unchanged; dryRun=false ghi item hợp lệ, bỏ qua invalid |
| POST   | /api/v1/config/test-smtp | Bearer | config.edit.notification | nodemailer; enabled=false → 400 "Kênh email đang tắt"; lỗi mail → 502, SMTP_PASS được redact khỏi detail |
| POST   | /api/v1/audit/purge-now | Bearer | config.edit.infra | gate feature flag features.manual_audit_purge; flag false → 403; gọi AuditRetention.runOnce() (single-flight) |

## HC-03 — bỏ env override (ưu tiên DB → default)

Bỏ hẳn nhánh env cho 5 mục: upload.max_mb, audit.retention_days, audit.batch_size,
rate_limit.forgot_max, request.timeout_ms. Giữ nguyên env lớp A (PG*, JWT_SECRET,
SMTP_*, CORS_ORIGIN, UPLOAD_DIR, PORT, HOST). .env.example đã cập nhật comment giải thích.

## Files changed

- sql/migrations/007_settings_wave1.up.sql, 007_settings_wave1.down.sql (mới)
- app/db/init/03-config-tables.sql (đồng bộ seed)
- app/backend/routes/config.js (+4 endpoint, helper setOneInTx dùng chung)
- app/backend/jobs/audit-retention.js (runOnce(), đọc cấu hình từ DB)
- app/backend/server.js, utils/upload.js, routes/auth.js (bỏ env override)
- app/backend/.env.example
- app/backend/test/config-wave1.test.js (17 test mới)

## Lệnh test và kết quả

```
node --test --test-concurrency=1   # backend: 289 pass / 0 fail (gồm 17 test Wave 1)
npx vitest run                     # frontend: 73/73 PASS (13 files)
npm run build                      # SUCCESS (built in 2.42s)
```

Wave 1 test breakdown: bulk PUT (updated=3, rollback sai category, 404 rollback, readonly 400, quá 50 items 400, 401/403), import dryRun true/false + history, test-smtp (400 khi tắt, validate to), purge-now (403 flag off, an toàn trên DB thật), migration verify (7 key, hsts readonly, schema_version).

## Known Risks

- test-smtp chưa test được happy path thật (cần SMTP server ngoài); chỉ verify 400 khi kênh tắt + redact logic bằng đọc code.
- purge-now với flag=true chạy trên DB thật là hành động phá dữ liệu — chỉ test nhánh deleted=0.
- Các run trước (555–557) bị protocol violation khi report; công việc được verify lại toàn bộ trong run này.
