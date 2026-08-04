-- QLTTXD migration 001: atomic business-code allocation
-- Apply only after taking a verified backup. Safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum TEXT NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS code_bao_cao_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_ho_so_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_bien_ban_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_quyet_dinh_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Existing codes may have been created by the previous COUNT + 1 strategy.
-- Advance each sequence past the largest persisted numeric suffix before use.
SELECT setval('code_bao_cao_seq', COALESCE((SELECT max((substring(ma_bao_cao FROM '([0-9]{6})$'))::BIGINT) FROM bao_cao_vi_pham), 0) + 1, false);
SELECT setval('code_ho_so_seq', COALESCE((SELECT max((substring(ma_ho_so FROM '([0-9]{6})$'))::BIGINT) FROM ho_so), 0) + 1, false);
SELECT setval('code_bien_ban_seq', COALESCE((SELECT max((substring(ma_bien_ban FROM '([0-9]{6})$'))::BIGINT) FROM bien_ban), 0) + 1, false);
SELECT setval('code_quyet_dinh_seq', COALESCE((SELECT max((substring(ma_quyet_dinh FROM '([0-9]{6})$'))::BIGINT) FROM quyet_dinh), 0) + 1, false);

CREATE OR REPLACE FUNCTION next_business_code(prefix TEXT, code_sequence REGCLASS)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
           lpad(nextval(code_sequence)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

INSERT INTO schema_migrations (version, checksum)
VALUES ('001_atomic_business_codes', 'manual-v1')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Rollback: sql/migrations/001_atomic_business_codes.down.sql
-- Rollback does not restore the unsafe COUNT + 1 behavior; deploy a compatible
-- application version before removing this database function/sequences.
