-- QLTTXD migration 002 rollback
-- Preconditions: application has been rolled back. Take a verified backup before executing.
BEGIN;

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'admin.locations');

DELETE FROM permissions WHERE code = 'admin.locations';

DELETE FROM schema_migrations WHERE version = '002_admin_locations';

COMMIT;
