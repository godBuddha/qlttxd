# SPEC T-01: Schema Fix — schema_migrations + seed admin.locations

> Task: coder (backend) | Priority: P0 | Dependency: none

## Mục tiêu

Thêm `schema_migrations` table vào `01-schema.sql` và đảm bảo `admin.locations` permission được seed trong `02-seed.sql`.

## Files thay đổi

1. `app/db/init/01-schema.sql` — thêm CREATE TABLE schema_migrations
2. `app/db/init/02-seed.sql` — thêm seed permission admin.locations + gán cho admin

## Chi tiết

### 1. `01-schema.sql` — thêm cuối cùng (trước khi close)

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(100) PRIMARY KEY,
    checksum    VARCHAR(200),
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. `02-seed.sql` — thêm permission admin.locations

```sql
-- Thêm permission mới (idempotent)
INSERT INTO permissions (code, name, module) VALUES
  ('admin.locations', 'Quản lý địa điểm', 'admin')
ON CONFLICT (code) DO NOTHING;

-- Gán cho admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin' AND p.code = 'admin.locations'
ON CONFLICT DO NOTHING;
```

## Acceptance Criteria

- [ ] `schema_migrations` table tồn tại sau khi chạy `01-schema.sql`
- [ ] `admin.locations` permission tồn tại trong `permissions` table
- [ ] Admin role có `admin.locations` permission trong `role_permissions`
- [ ] Migration 002/003 chạy được (INSERT vào schema_migrations không lỗi)
- [ ] Chạy lại `bash sql/setup-db.sh` — pass

## Test

```bash
cd /workspace/ssd/qlttxd
bash sql/setup-db.sh
# Verify:
PGPASSWORD=postgres psql -h /tmp -U postgres -d qlttxd -c "SELECT * FROM schema_migrations;"
PGPASSWORD=postgres psql -h /tmp -U postgres -d qlttxd -c "SELECT * FROM permissions WHERE code='admin.locations';"
PGPASSWORD=postgres psql -h /tmp -U postgres -d qlttxd -c "SELECT r.code, p.code FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE p.code='admin.locations';"
```
