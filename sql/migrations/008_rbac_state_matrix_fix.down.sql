-- ============================================================================
-- 008_rbac_state_matrix_fix.down.sql
-- Khôi phục ma trận case_handler như trước khi fix DEF-009 (13 trạng thái).
-- Chỉ INSERT những dòng còn thiếu (idempotent).
-- LƯU Ý: file down KHÔNG được chạy tự động — runner chỉ áp dụng *.up.sql.
-- ============================================================================

INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, s.code FROM roles r, workflow_states s
WHERE r.code = 'case_handler'
  AND s.code IN (
    'cho_tiep_nhan','da_tiep_nhan','cho_xac_minh','dang_xac_minh','cho_bo_sung',
    'cho_lap_bien_ban','da_lap_bien_ban','cho_ra_quyet_dinh','da_ra_quyet_dinh',
    'dang_khac_phuc','da_khac_phuc','da_dong','da_chuyen_co_quan'
  )
ON CONFLICT DO NOTHING;
