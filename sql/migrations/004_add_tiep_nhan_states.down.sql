-- Rollback migration 004: remove two new states from trang_thai_ho_so ENUM
-- NOTE: PostgreSQL does not support removing values from an ENUM type.
-- To rollback, you must recreate the ENUM without those values.
-- This is acceptable because this migration only ADDED states and did not change data flow.
-- In production, DO NOT run this down migration unless you are also migrating away from the ENUM.
BEGIN;

/*
-- Option A (PostgreSQL 14+): drop the ENUM type and recreate it.
-- WARNING: this will break any code still referencing the old enum label names!
DROP TYPE trang_thai_ho_so CASCADE;
CREATE TYPE trang_thai_ho_so AS ENUM (
    'cho_tiep_nhan', 'cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung',
    'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh',
    'da_ra_quyet_dinh', 'dang_khac_phuc', 'cho_duyet_dieu_81',
    'da_khac_phuc', 'da_dong', 'da_huy'
);

-- Re-create indexes on the dropped type
CREATE INDEX idx_ho_so_trang_thai ON ho_so (trang_thai);
*/

-- Option B (recommended for most cases): leave the ENUM as-is.
-- The two extra labels are harmless if no new rows use them.
-- Just document that migration 004 is "irreversible" for this ENUM.

COMMIT;
