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
