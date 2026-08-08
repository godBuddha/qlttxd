-- Migration 006 rollback: remove config permissions + role assignments

BEGIN;

DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.code LIKE 'config.%';

DELETE FROM permissions WHERE module = 'config';

COMMIT;
