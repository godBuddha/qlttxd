'use strict';

/**
 * Workflow role rules — which roles are allowed to perform each transition.
 *
 * Matrix (from approved user spec):
 *   case_handler: da_tiep_nhan, dang_khac_phuc, da_khac_phuc, da_dong, da_lap_bien_ban
 *   verifier:     dang_xac_minh, cho_bo_sung, cho_lap_bien_ban, da_dong
 *   leader:        da_xac_minh(xác nhận → maps to cho_xac_minh), cho_bo_sung,
 *                  cho_lap_bien_ban, da_ra_quyet_dinh, da_dong, da_huy, da_chuyen_co_quan
 *   admin:         all transitions
 */

// All stored in snake_case matching nextState values from the API.
const ROLE_PERMISSIONS = Object.freeze({
  case_handler: new Set([
    'da_tiep_nhan',       // cán bộ nhận hồ sơ
    'dang_khac_phuc',
    'da_khac_phuc',
    'da_dong',
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

module.exports = { canTransition, ROLE_PERMISSIONS };

/**
 * Check if a role is allowed to perform a specific transition.
 * @param {string} role - User's role code
 * @param {string} nextState - Target state for the transition (snake_case)
 * @returns {boolean}
 */
function canTransition(role, nextState) {
  const perm = ROLE_PERMISSIONS[role];

  // Admin has unrestricted access
  if (perm === 'all') return true;

  // Resolve alias: "da_xac_minh" doesn't exist as a real state; it means
  // the leader is confirming during verification, so map to cho_xac_minh.
  const resolved = nextState === 'da_xac_minh' ? 'cho_xac_minh' : nextState;

  return perm instanceof Set ? perm.has(resolved) : false;
}
