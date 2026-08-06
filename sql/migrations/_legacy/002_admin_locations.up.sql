-- QLTTXD migration 002: admin.locations permission
-- Apply only after taking a verified backup. Safe to re-run.
BEGIN;

-- 1. Add permission admin.locations (idempotent)
INSERT INTO permissions (code, name, module)
VALUES ('admin.locations', 'Quản lý địa điểm (đơn vị hành chính)', 'admin')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign admin.locations to admin role (idempotent)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'admin' AND p.code = 'admin.locations'
ON CONFLICT DO NOTHING;

-- 3. Record migration
INSERT INTO schema_migrations (version, checksum)
VALUES ('002_admin_locations', 'manual-v1')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback: sql/migrations/002_admin_locations.down.sql
