import { describe, it, expect } from 'vitest';
import { STATES, STATE_LABELS, AUDIT_TABLES, AUDIT_TABLE_LABELS } from './constants.js';

describe('STATES / STATE_LABELS consistency', () => {
  it('mọi state trong STATES đều có nhãn', () => {
    for (const s of STATES) {
      expect(STATE_LABELS[s]).toBeTruthy();
    }
  });

  it('mọi nhãn trong STATE_LABELS đều ứng với state hợp lệ', () => {
    for (const key of Object.keys(STATE_LABELS)) {
      expect(STATES).toContain(key);
    }
  });

  it('không có state trùng lặp và không rỗng', () => {
    expect(new Set(STATES).size).toBe(STATES.length);
    expect(STATES.length).toBeGreaterThan(0);
  });

  it('mọi state có nhãn chuỗi không rỗng', () => {
    for (const label of Object.values(STATE_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('không có state lạ ngoài danh sách đã định nghĩa', () => {
    const KNOWN = [
      'cho_tiep_nhan',
      'da_tiep_nhan',
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
      'da_chuyen_co_quan',
    ];
    for (const s of STATES) expect(KNOWN).toContain(s);
  });

  it('các trạng thái quyết định chính tồn tại với nhãn đúng', () => {
    expect(STATE_LABELS.cho_xac_minh).toBe('Chờ xác minh');
    expect(STATE_LABELS.da_lap_bien_ban).toBe('Đã lập biên bản');
    expect(STATE_LABELS.da_ra_quyet_dinh).toBe('Đã ra quyết định');
    expect(STATE_LABELS.da_dong).toBe('Đã đóng');
  });
});

describe('AUDIT tables consistency', () => {
  it('mọi bảng trong AUDIT_TABLES đều có nhãn', () => {
    for (const t of AUDIT_TABLES) {
      expect(AUDIT_TABLE_LABELS[t]).toBeTruthy();
    }
  });

  it('bảng rỗng (tất cả) có nhãn Tất cả', () => {
    expect(AUDIT_TABLE_LABELS['']).toBe('Tất cả');
  });
});
