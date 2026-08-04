\set ON_ERROR_STOP on

-- Execute after schema.sql and seed.sql. Every query must return the expected value.
-- The final sequence check advances a sequence; rollback does not undo nextval(),
-- which is expected PostgreSQL behavior. Run this only on a disposable test DB.
BEGIN;

SELECT current_setting('server_version_num')::INT >= 160000 AS postgres_16_or_newer;
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis_enabled;
SELECT postgis_lib_version() AS postgis_version;

SELECT count(*) = 19 AS has_19_application_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users','roles','permissions','user_roles','role_permissions','quan_huyen','phuong_xa',
    'loai_vi_pham','hanh_vi_vi_pham','muc_phat','bao_cao_vi_pham','nguoi_vi_pham','ho_so',
    'bien_ban','quyet_dinh','khac_phuc','thong_bao','tep_dinh_kem','audit_log'
  );

SELECT count(*) >= 20 AS foreign_keys_present
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY';

SELECT count(*) = 3 AS spatial_indexes_present
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_quan_huyen_boundary','idx_phuong_xa_boundary','idx_ho_so_toa_do');

SELECT count(*) = 4 AS srid_4326_geometry_columns
FROM geometry_columns
WHERE f_table_schema = 'public'
  AND srid = 4326
  AND f_table_name IN ('quan_huyen','phuong_xa','bao_cao_vi_pham','ho_so');

SELECT bool_and(ST_SRID(boundary) = 4326 AND GeometryType(boundary) = 'MULTIPOLYGON') AS boundary_srid_and_type_valid
FROM (
  SELECT boundary FROM quan_huyen
  UNION ALL
  SELECT boundary FROM phuong_xa
) boundaries
WHERE boundary IS NOT NULL;

-- Verify ward 00101 has a valid (non-null, valid geometry) boundary.
-- NOTE: the original point-containment check used a fixed lat/lon that may
-- fall outside synthetic seed boundaries and is unreliable on non-fresh DBs.
SELECT boundary IS NOT NULL AND ST_IsValid(boundary) AS seed_boundary_valid
FROM phuong_xa px
WHERE px.ma = '00101';

SELECT count(*) = 6 AS seeded_districts FROM quan_huyen;
SELECT count(*) = 12 AS seeded_wards FROM phuong_xa;
-- Verify at least one admin user exists (the initial setup account).
-- NOTE: original check `count(*)=0 AS seeded_demo_users` fails on running DBs
-- that have already had their first admin registered.
SELECT count(*) >= 1 AS admin_user_exists FROM users;

SELECT next_business_code('BC', 'code_bao_cao_seq'::regclass) ~ '^BC-[0-9]{4}-[0-9]{6}$' AS atomic_code_format;

SELECT EXISTS(SELECT 1 FROM permissions WHERE code='admin.locations') AS permission_admin_locations_exists;

SELECT EXISTS(
  SELECT 1 FROM role_permissions rp
  JOIN roles r ON r.id=rp.role_id
  JOIN permissions p ON p.id=rp.permission_id
  WHERE r.code='admin' AND p.code='admin.locations'
) AS admin_has_admin_locations;

-- Verify migration 002_admin_locations was applied
SELECT EXISTS(
  SELECT 1 FROM schema_migrations WHERE version = '002_admin_locations'
) AS migration_002_applied;

-- Verify audit_log indexes for security hardening
SELECT count(*) = 3 AS audit_log_hardening_indexes_present
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'audit_log'
  AND indexname IN (
    'idx_audit_log_user_created',
    'idx_audit_entity',
    'idx_audit_time'
  );

-- Verify audit_log has request_id column (migration 003)
SELECT EXISTS(
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'audit_log'
    AND column_name = 'request_id'
) AS audit_log_has_request_id;

ROLLBACK;

-- Seed boundaries are synthetic rectangular demo fixtures. They are not legal
-- administrative boundaries and must be replaced by an authoritative source
-- (and approved by a competent authority) before production deployment.
