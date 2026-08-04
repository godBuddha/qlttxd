'use strict';

const STATES = new Set(['cho_tiep_nhan', 'cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh', 'da_ra_quyet_dinh', 'dang_khac_phuc', 'cho_duyet_dieu_81', 'da_khac_phuc', 'da_dong', 'da_huy']);
const STATE_LABELS = { cho_tiep_nhan: 'Chờ tiếp nhận', cho_xac_minh: 'Chờ xác minh', dang_xac_minh: 'Đang xác minh', cho_bo_sung: 'Chờ bổ sung', cho_lap_bien_ban: 'Chờ lập biên bản', da_lap_bien_ban: 'Đã lập biên bản', cho_ra_quyet_dinh: 'Chờ ra quyết định', da_ra_quyet_dinh: 'Đã ra quyết định', dang_khac_phuc: 'Đang khắc phục', cho_duyet_dieu_81: 'Chờ duyệt Điều 81', da_khac_phuc: 'Đã khắc phục', da_dong: 'Đã đóng', da_huy: 'Đã hủy' };
const TRANSITIONS = {
  cho_tiep_nhan: ['cho_xac_minh', 'da_huy'], cho_xac_minh: ['dang_xac_minh', 'cho_bo_sung', 'da_huy'],
  dang_xac_minh: ['cho_bo_sung', 'cho_lap_bien_ban', 'da_huy'], cho_bo_sung: ['cho_xac_minh', 'da_huy'],
  cho_lap_bien_ban: ['da_lap_bien_ban', 'da_huy'], da_lap_bien_ban: ['cho_ra_quyet_dinh'],
  cho_ra_quyet_dinh: ['da_ra_quyet_dinh'], da_ra_quyet_dinh: ['dang_khac_phuc', 'da_dong'],
  dang_khac_phuc: ['da_khac_phuc'], da_khac_phuc: ['da_dong'], cho_duyet_dieu_81: ['cho_lap_bien_ban', 'da_huy'],
};
const BUSINESS_CODE_SEQUENCES = Object.freeze({
  BC: 'code_bao_cao_seq',
  HS: 'code_ho_so_seq',
  BB: 'code_bien_ban_seq',
  QD: 'code_quyet_dinh_seq',
});

module.exports = { STATES, STATE_LABELS, TRANSITIONS, BUSINESS_CODE_SEQUENCES };
