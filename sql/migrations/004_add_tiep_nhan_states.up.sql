-- ============================================================================
-- Migration 004: Add hai trạng thái mới cho quy trình hồ sơ
--   - da_tiep_nhan (Đã tiếp nhận)   : sau cho_tiep_nhan, do cán bộ nhận hồ sơ
--   - da_chuyen_co_quan (Chuyển cơ quan khác) : vụ ngoài thẩm quyền / liên ngành
-- ============================================================================
BEGIN;

DO $$
BEGIN
    -- Thêm state mới vào ENUM nếu chưa có (idempotent)
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'trang_thai_ho_so' AND e.enumlabel = 'da_tiep_nhan') THEN
        ALTER TYPE trang_thai_ho_so ADD VALUE 'da_tiep_nhan';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'trang_thai_ho_so' AND e.enumlabel = 'da_chuyen_co_quan') THEN
        ALTER TYPE trang_thai_ho_so ADD VALUE 'da_chuyen_co_quan';
    END IF;
END
$$;

COMMIT;
