-- ============================================================================
-- 008_rbac_state_matrix_fix.up.sql
-- DEF-009: role_state_permissions cho case_handler bị rộng quá mức
-- (13/15 trạng thái) cho phép cán bộ thụ lý tự đóng hồ sơ (da_dong) bỏ qua
-- chuỗi khắc phục/duyệt. Nguồn sự thật nghiệp vụ: docs/03-dac-ta-nghiep-vu.md
-- (UC-06) — da_dong chỉ đạt qua chuỗi khắc phục/duyệt hoặc do leader/admin.
--
-- Ma trận CHUẮT sau migration:
--   case_handler: da_tiep_nhan, dang_khac_phuc, da_khac_phuc, da_lap_bien_ban
--   verifier    : dang_xac_minh, cho_bo_sung, cho_lap_bien_ban, da_dong, cho_xac_minh (giữ nguyên)
--   leader      : giữ nguyên theo seed hiện hành
--   admin       : toàn bộ trạng thái (giữ nguyên)
--
-- Idempotent: DELETE ... WHERE điều kiện cụ thể — chạy lại không đổi gì thêm.
-- ============================================================================

DELETE FROM role_state_permissions rsp
USING roles r
WHERE r.id = rsp.role_id
  AND r.code = 'case_handler'
  AND rsp.state_code NOT IN (
    'da_tiep_nhan',
    'dang_khac_phuc',
    'da_khac_phuc',
    'da_lap_bien_ban'
  );
