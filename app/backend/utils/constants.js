'use strict';

const STATES = new Set([
  'cho_tiep_nhan',
  'da_tiep_nhan',              // NEW: đã tiếp nhận
  'cho_xac_minh',
  'dang_xac_minh',
  'cho_bo_sung',
  'cho_lap_bien_ban',
  'da_lap_bien_ban',
  'cho_ra_quyet_dinh',
  'da_ra_quyet_dinh',
  'dang_khac_phuc',
  'cho_duyet_dieu_81',
  'da_khac_phuc',
  'da_dong',
  'da_huy',
  'da_chuyen_co_quan',         // NEW: chuyển cơ quan khác
]);
const STATE_LABELS = {
  cho_tiep_nhan: 'Chờ tiếp nhận',
  da_tiep_nhan: 'Đã tiếp nhận',
  cho_xac_minh: 'Chờ xác minh',
  dang_xac_minh: 'Đang xác minh',
  cho_bo_sung: 'Chờ bổ sung',
  cho_lap_bien_ban: 'Chờ lập biên bản',
  da_lap_bien_ban: 'Đã lập biên bản',
  cho_ra_quyet_dinh: 'Chờ ra quyết định',
  da_ra_quyet_dinh: 'Đã ra quyết định',
  dang_khac_phuc: 'Đang khắc phục',
  cho_duyet_dieu_81: 'Chờ duyệt Điều 81',
  da_khac_phuc: 'Đã khắc phục',
  da_dong: 'Đã đóng',
  da_huy: 'Đã hủy',
  da_chuyen_co_quan: 'Chuyển cơ quan khác',
};
const TRANSITIONS = Object.freeze({
  // Terminal states — no outgoing transitions
  da_dong: [],
  da_huy: [],
  da_chuyen_co_quan: [],
  // New workflow: allow_tiep_nhan -> da_tiep_nhan (case handler nhận hồ sơ)
  cho_tiep_nhan: ['cho_xac_minh', 'da_tiep_nhan', 'da_huy', 'da_chuyen_co_quan'],
  da_tiep_nhan: ['cho_xac_minh', 'cho_bo_sung', 'da_huy'],
  cho_xac_minh: ['dang_xac_minh', 'cho_bo_sung', 'da_huy', 'da_chuyen_co_quan'],
  dang_xac_minh: ['cho_bo_sung', 'cho_lap_bien_ban', 'da_huy'],
  cho_bo_sung: ['cho_xac_minh', 'da_huy'],
  cho_lap_bien_ban: ['da_lap_bien_ban', 'da_huy'],
  da_lap_bien_ban: ['cho_ra_quyet_dinh'],
  cho_ra_quyet_dinh: ['da_ra_quyet_dinh'],
  da_ra_quyet_dinh: ['dang_khac_phuc', 'da_dong'],
  dang_khac_phuc: ['da_khac_phuc'],
  da_khac_phuc: ['da_dong'],
  cho_duyet_dieu_81: ['cho_lap_bien_ban', 'da_huy'],
});
const BUSINESS_CODE_SEQUENCES = Object.freeze({
  BC: 'code_bao_cao_seq',
  HS: 'code_ho_so_seq',
  BB: 'code_bien_ban_seq',
  QD: 'code_quyet_dinh_seq',
});

const AUDIT_ACTIONS = Object.freeze({
  // Case actions
  CASE_CREATE: 'case.create',
  CASE_UPDATE: 'case.update',
  CASE_TRANSFER: 'case.transfer',
  CASE_ASSIGN: 'case.assign',
  CASE_STATUS_CHANGE: 'case.status_change',
  // Report actions
  REPORT_CREATE: 'report.create',
  REPORT_UPDATE: 'report.update',
  // Bien ban / Quyet dinh actions
  BIENBAN_CREATE: 'bien_ban.create',
  QUYETDINH_CREATE: 'quyet_dinh.create',
  QUYETDINH_ISSUE: 'quyet_dinh.issue',
  KHACPHUC_CREATE: 'khac_phuc.create',
  KHACPHUC_UPDATE: 'khac_phuc.update',
  // Location actions
  LOCATION_CREATE: 'location.create',
  LOCATION_UPDATE: 'location.update',
  LOCATION_DELETE: 'location.delete',
  // Catalog actions
  CATALOG_CREATE: 'catalog.create',
  CATALOG_UPDATE: 'catalog.update',
  CATALOG_DELETE: 'catalog.delete',
  // Export actions
  EXPORT_DOCX: 'export.docx',
  EXPORT_PDF: 'export.pdf',
  // User/auth actions
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  ROLE_UPDATE: 'role.update',
  AUTH_LOGIN: 'auth.login',
  AUTH_CHANGE_PASSWORD: 'auth.change_password',
});

module.exports = { STATES, STATE_LABELS, TRANSITIONS, BUSINESS_CODE_SEQUENCES, AUDIT_ACTIONS };
