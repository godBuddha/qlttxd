'use strict';

// ────────────────────────────────────────────
// Fallback static data — used when DB is empty or during tests
// ────────────────────────────────────────────

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

// ────────────────────────────────────────────
// In-memory cache — populated by loadConstants()
// ────────────────────────────────────────────

let _cachedStates = null;          // Array of { code, label }
let _cachedStateLabels = null;     // { code: label }
let _cachedTransitions = null;     // { from: [to, ...] }

/**
 * Load workflow constants from database.
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Promise<{states: Array<{code:string,label:string}>, stateLabels: Object, transitions: Object}>}
 */
async function loadConstants(pool) {
  // Load workflow_states ordered by sort_order
  const statesRes = await pool.query(
    `SELECT code, label FROM workflow_states ORDER BY sort_order`
  );
  const states = statesRes.rows.map(r => ({ code: r.code, label: r.label }));

  // Build state labels map
  const stateLabels = {};
  for (const s of states) {
    stateLabels[s.code] = s.label;
  }

  // Load workflow_transitions
  const transRes = await pool.query(
    `SELECT from_state, to_state FROM workflow_transitions ORDER BY from_state, sort_order`
  );
  const transitions = {};
  for (const t of transRes.rows) {
    if (!transitions[t.from_state]) transitions[t.from_state] = [];
    transitions[t.from_state].push(t.to_state);
  }

  // Populate terminal-state entries that never appear in transitions table
  for (const t of ['da_dong', 'da_huy', 'da_chuyen_co_quan']) {
    if (!transitions[t]) transitions[t] = [];
  }

  // Cache
  _cachedStates = states;
  _cachedStateLabels = stateLabels;
  _cachedTransitions = transitions;

  return { states, stateLabels, transitions };
}

/**
 * Get cached states from DB, falling back to static STATES set.
 * @returns {{code: string, label: string}[]}
 */
function getStates() {
  if (_cachedStates && _cachedStates.length > 0) {
    return _cachedStates;
  }
  // Fallback: build from static SET + LABELS
  const fallback = [];
  for (const code of STATES) {
    fallback.push({ code, label: STATE_LABELS[code] || code });
  }
  return fallback;
}

/**
 * Get cached state labels, falling back to static.
 * @returns {Object}
 */
function getStateLabels() {
  if (_cachedStateLabels && Object.keys(_cachedStateLabels).length > 0) {
    return _cachedStateLabels;
  }
  return STATE_LABELS;
}

/**
 * Get cached transitions, falling back to static.
 * @returns {Object}
 */
function getTransitions() {
  if (_cachedTransitions && Object.keys(_cachedTransitions).length > 0) {
    return _cachedTransitions;
  }
  return TRANSITIONS;
}

module.exports = {
  STATES, STATE_LABELS, TRANSITIONS, BUSINESS_CODE_SEQUENCES, AUDIT_ACTIONS,
  loadConstants, getStates, getStateLabels, getTransitions,
};
