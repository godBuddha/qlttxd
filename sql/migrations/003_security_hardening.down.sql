-- QLTTXD migration 003 rollback: Security hardening
BEGIN;

DROP INDEX IF EXISTS idx_audit_log_user_created;
ALTER TABLE audit_log DROP COLUMN IF EXISTS request_id;
DELETE FROM schema_migrations WHERE version = '003_security_hardening';

COMMIT;
