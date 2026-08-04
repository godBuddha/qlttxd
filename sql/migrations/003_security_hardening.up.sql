-- QLTTXD migration 003: Security hardening
-- Add request_id column to audit_log + composite index on (nguoi_dung_id, thoi_gian)
-- Apply only after taking a verified backup. Safe to re-run.
BEGIN;

-- 1. Add request_id column to audit_log (nullable, for backward compat)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS request_id UUID;

-- 2. Composite index: (nguoi_dung_id, thoi_gian) for user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log (nguoi_dung_id, thoi_gian);

-- 3. Record migration
INSERT INTO schema_migrations (version, checksum)
VALUES ('003_security_hardening', 'manual-v1')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback: sql/migrations/003_security_hardening.down.sql
