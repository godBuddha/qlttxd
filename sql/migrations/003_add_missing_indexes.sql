-- QLTTXD migration 003: add missing supporting indexes (audit H-04).
--
-- Adds partial/composite indexes for the most common lookups:
--   * bao_cao_vi_pham(nguoi_gui_id)  — "báo cáo của tôi" (citizen dashboard)
--   * thong_bao(nguoi_nhan_id, trang_thai) WHERE trang_thai='da_gui' — unread inbox
--   * ho_so(created_at) WHERE deleted_at IS NULL — active case list (soft-delete)
-- Idempotent (IF NOT EXISTS).
-- ----------------------------------------------------------------------------
BEGIN;

CREATE INDEX IF NOT EXISTS idx_bao_cao_nguoi_gui
    ON bao_cao_vi_pham (nguoi_gui_id);

CREATE INDEX IF NOT EXISTS idx_thong_bao_unread
    ON thong_bao (nguoi_nhan_id, trang_thai)
    WHERE trang_thai = 'da_gui';

CREATE INDEX IF NOT EXISTS idx_ho_so_active
    ON ho_so (created_at)
    WHERE deleted_at IS NULL;

COMMIT;
