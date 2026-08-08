export const HOME = [21.0285, 105.8542]; // Hà Nội

export const STATES = [
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
];

export const STATE_LABELS = {
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

export const TRANSITIONS = Object.freeze({
  // Terminal states — no outgoing transitions
  da_dong: [],
  da_huy: [],
  da_chuyen_co_quan: [],
  // Workflow transitions
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

export const AUDIT_TABLES = [
  '',
  'ho_so',
  'bao_cao_vi_pham',
  'users',
  'quan_huyen',
  'phuong_xa',
  'bien_ban',
  'quyet_dinh',
  'khac_phuc',
  'roles',
];
export const AUDIT_TABLE_LABELS = {
  '': 'Tất cả',
  ho_so: 'Hồ sơ',
  bao_cao_vi_pham: 'Báo cáo',
  users: 'Người dùng',
  quan_huyen: 'Quận/Huyện',
  phuong_xa: 'Phường/Xã',
  bien_ban: 'Biên bản',
  quyet_dinh: 'Quyết định',
  khac_phuc: 'Khắc phục',
  roles: 'Vai trò',
};
export const AUDIT_ACTIONS = [
  '',
  'create',
  'update',
  'delete',
  'login',
  'setup_admin',
  'update_permissions',
  'change_password',
];
export const AUDIT_ACTION_LABELS = {
  '': 'Tất cả',
  create: 'Tạo mới',
  update: 'Cập nhật',
  delete: 'Xóa',
  login: 'Đăng nhập',
  setup_admin: 'Khởi tạo admin',
  update_permissions: 'Phân quyền',
  change_password: 'Đổi mật khẩu',
};
