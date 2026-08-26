const test = require('node:test');
const assert = require('node:assert/strict');
const { canTransition } = require('../utils/workflow-rules');

test('admin can transition to any state', () => {
  const adminStates = [
    'da_dong', 'da_huy', 'da_tiep_nhan', 'da_chuyen_co_quan',
    'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban',
    'da_ra_quyet_dinh', 'dang_khac_phuc', 'da_khac_phuc',
    'cho_xac_minh', 'cho_tiep_nhan', 'cho_ra_quyet_dinh',
    'da_lap_bien_ban', 'cho_duyet_dieu_81',
  ];
  for (const state of adminStates) {
    assert.equal(canTransition('admin', state), true, `admin should be able to transition to ${state}`);
  }
});

test('case_handler: allowed transitions', () => {
  const allowed = ['da_tiep_nhan', 'dang_khac_phuc', 'da_khac_phuc', 'da_lap_bien_ban'];
  for (const state of allowed) {
    assert.equal(canTransition('case_handler', state), true, `case_handler should be able to transition to ${state}`);
  }
});

// DEF-009: handler không được tự đóng hồ sơ
test('case_handler: blocked transitions', () => {
  const blocked = ['da_dong', 'dang_xac_minh', 'cho_bo_sung', 'cho_xac_minh', 'da_chuyen_co_quan', 'da_ra_quyet_dinh'];
  for (const state of blocked) {
    assert.equal(canTransition('case_handler', state), false, `case_handler should NOT be able to transition to ${state}`);
  }
});

test('verifier: allowed transitions', () => {
  const allowed = ['dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_dong'];
  for (const state of allowed) {
    assert.equal(canTransition('verifier', state), true, `verifier should be able to transition to ${state}`);
  }
});

test('verifier: blocked transitions', () => {
  const blocked = ['da_tiep_nhan', 'da_chuyen_co_quan', 'da_ra_quyet_dinh', 'dang_khac_phuc'];
  for (const state of blocked) {
    assert.equal(canTransition('verifier', state), false, `verifier should NOT be able to transition to ${state}`);
  }
});

test('leader: allowed transitions', () => {
  const allowed = ['cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_ra_quyet_dinh', 'da_dong', 'da_huy', 'da_chuyen_co_quan'];
  for (const state of allowed) {
    assert.equal(canTransition('leader', state), true, `leader should be able to transition to ${state}`);
  }
});

test('leader: blocked transitions', () => {
  const blocked = ['da_tiep_nhan', 'da_lap_bien_ban', 'dang_khac_phuc', 'da_khac_phuc'];
  for (const state of blocked) {
    assert.equal(canTransition('leader', state), false, `leader should NOT be able to transition to ${state}`);
  }
});

test('unknown role returns false', () => {
  assert.equal(canTransition('citizen', 'da_dong'), false);
  assert.equal(canTransition('nobody', 'da_tiep_nhan'), false);
});
