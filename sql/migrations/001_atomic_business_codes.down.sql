-- QLTTXD migration 001 rollback
-- Preconditions: application has been rolled back to a version that does not
-- call next_business_code(). Take a verified backup before executing.
BEGIN;

DROP FUNCTION IF EXISTS next_business_code(TEXT, REGCLASS);
DROP SEQUENCE IF EXISTS code_quyet_dinh_seq;
DROP SEQUENCE IF EXISTS code_bien_ban_seq;
DROP SEQUENCE IF EXISTS code_ho_so_seq;
DROP SEQUENCE IF EXISTS code_bao_cao_seq;
DELETE FROM schema_migrations WHERE version = '001_atomic_business_codes';

COMMIT;
