'use strict';

/**
 * Workflow role rules — which roles are allowed to perform each transition.
 *
 * Matrix (from approved user spec, DEF-009 fix):
 *   case_handler: da_tiep_nhan, dang_khac_phuc, da_khac_phuc, da_lap_bien_ban
 *                 (KHÔNG có da_dong — hồ sơ chỉ đóng qua chuỗi khắc phục/duyệt)
 *   verifier:     dang_xac_minh, cho_bo_sung, cho_lap_bien_ban, da_dong
 *   leader:        da_xac_minh(xác nhận → maps to cho_xac_minh), cho_bo_sung,
 *                  cho_lap_bien_ban, da_ra_quyet_dinh, da_dong, da_huy, da_chuyen_co_quan
 *   admin:         all transitions
 */

// ────────────────────────────────────────────
// Fallback hardcoded permissions — used when DB is empty or during tests
// ────────────────────────────────────────────

const ROLE_PERMISSIONS = Object.freeze({
  case_handler: new Set([
    'da_tiep_nhan',       // cán bộ nhận hồ sơ
    'dang_khac_phuc',
    'da_khac_phuc',
    // DEF-009: KHÔNG có da_dong — handler không tự đóng hồ sơ bỏ qua duyệt
    'da_lap_bien_ban',
  ]),
  verifier: new Set([
    'dang_xac_minh',
    'cho_bo_sung',
    'cho_lap_bien_ban',
    'da_dong',
  ]),
  leader: new Set([
    'cho_xac_minh',              // "da_xac_minh" alias resolves here
    'dang_xac_minh',
    'cho_bo_sung',
    'cho_lap_bien_ban',
    'da_ra_quyet_dinh',
    'da_dong',
    'da_huy',
    'da_chuyen_co_quan',
  ]),
  admin: 'all',
});

// ────────────────────────────────────────────
// In-memory cache populated by loadRolePermissions()
// Key: role_code (string) → Set<string> of allowed next states
// ────────────────────────────────────────────

let _cachedPermissions = null;

/**
 * Load role-state permissions from the database.
 * Queries `role_state_permissions` joined with `roles` and `workflow_states`,
 * then stores an in-memory Map for fast lookup.
 * Falls back to ROLE_PERMISSIONS if the table is empty.
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function loadRolePermissions(pool) {
  const res = await pool.query(
    `SELECT r.code AS role_code, ws.code AS state_code
     FROM role_state_permissions rsp
     JOIN roles r ON r.id = rsp.role_id
     JOIN workflow_states ws ON ws.code = rsp.state_code
     ORDER BY r.code, ws.code`
  );

  const permsMap = new Map();

  for (const row of res.rows) {
    const roleCode = row.role_code;
    if (!permsMap.has(roleCode)) {
      permsMap.set(roleCode, new Set());
    }
    permsMap.get(roleCode).add(row.state_code);
  }

  // If DB returned nothing, populate from fallback so tests still pass
  if (permsMap.size === 0) {
    for (const [role, states] of Object.entries(ROLE_PERMISSIONS)) {
      if (states === 'all') {
        permsMap.set(role, 'all');
      } else {
        permsMap.set(role, new Set(states));
      }
    }
  }

  _cachedPermissions = permsMap;
  return permsMap;
}

/**
 * Get cached role permissions, falling back to hardcoded ROLE_PERMISSIONS.
 * @returns {Map<string, Set<string>|string>}
 */
function getRolePermissions() {
  if (_cachedPermissions && _cachedPermissions.size > 0) {
    return _cachedPermissions;
  }
  // Build map from static ROLE_PERMISSIONS
  const fallback = new Map();
  for (const [role, states] of Object.entries(ROLE_PERMISSIONS)) {
    if (states === 'all') {
      fallback.set(role, 'all');
    } else {
      fallback.set(role, new Set(states));
    }
  }
  return fallback;
}

module.exports = { canTransition, ROLE_PERMISSIONS, loadRolePermissions, getRolePermissions };

/**
 * Check if a role is allowed to perform a specific transition.
 * Reads from in-memory cache (populated by loadRolePermissions).
 * Falls back to hardcoded ROLE_PERMISSIONS when cache is empty.
 * @param {string} role - User's role code
 * @param {string} nextState - Target state for the transition (snake_case)
 * @returns {boolean}
 */
function canTransition(role, nextState) {
  const perms = getRolePermissions();
  const perm = perms.get(role);

  // Admin has unrestricted access
  if (perm === 'all') return true;

  // Resolve alias: "da_xac_minh" doesn't exist as a real state; it means
  // the leader is confirming during verification, so map to cho_xac_minh.
  const resolved = nextState === 'da_xac_minh' ? 'cho_xac_minh' : nextState;

  return perm instanceof Set ? perm.has(resolved) : false;
}
