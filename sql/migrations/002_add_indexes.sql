-- QLTTXD migration 002: add supporting indexes.
--
-- Adds an index on reset_token.token_hash. The reset_token table is created by
-- the baseline (001_initial_schema.sql); this index avoids a full table scan when
-- looking up a password-reset token by its hash. Idempotent (IF NOT EXISTS).
-- ----------------------------------------------------------------------------
BEGIN;

-- Index on reset_token.token_hash (only if the reset_token table exists).
DO $$
BEGIN
    IF to_regclass('public.reset_token') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_reset_token_token_hash
            ON reset_token (token_hash);
    END IF;
END $$;

COMMIT;
