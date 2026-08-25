import { describe, it, expect } from 'vitest';
import {
  SETTINGS_MANIFESTS,
  getManifest,
  getGroups,
  GROUP_ORDER,
  fieldEditPermission,
} from '../../settings-manifests/index.js';

describe('Settings manifest registry', () => {
  it('loads exactly 12 manifests', () => {
    expect(SETTINGS_MANIFESTS).toHaveLength(12);
  });

  it('has unique manifest ids', () => {
    const ids = SETTINGS_MANIFESTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every manifest has required metadata and at least one labelled field', () => {
    for (const m of SETTINGS_MANIFESTS) {
      expect(m.id, 'manifest id').toBeTruthy();
      expect(m.group, `group of ${m.id}`).toBeTruthy();
      expect(m.title, `title of ${m.id}`).toBeTruthy();
      expect(Array.isArray(m.fields), `fields of ${m.id}`).toBe(true);
      expect(m.fields.length, `field count of ${m.id}`).toBeGreaterThan(0);
      for (const f of m.fields) {
        expect(f.key, `key in ${m.id}`).toMatch(/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/);
        expect(f.label, `label of ${f.key}`).toBeTruthy();
        expect(f.type, `type of ${f.key}`).toMatch(
          /^(duration|number|boolean|enum|string)$/
        );
      }
    }
  });

  it('sorts manifests by GROUP_ORDER then order', () => {
    for (let i = 1; i < SETTINGS_MANIFESTS.length; i++) {
      const prev = SETTINGS_MANIFESTS[i - 1];
      const curr = SETTINGS_MANIFESTS[i];
      const gp = GROUP_ORDER.indexOf(prev.group);
      const gc = GROUP_ORDER.indexOf(curr.group);
      if (gp === gc) {
        expect(prev.order ?? 999).toBeLessThanOrEqual(curr.order ?? 999);
      } else {
        expect(gp).toBeLessThan(gc);
      }
    }
  });

  it('getManifest returns the right manifest and null for unknown id', () => {
    expect(getManifest('auth')?.title).toBe('Xác thực & Phiên');
    expect(getManifest('does-not-exist')).toBeNull();
  });

  it('getGroups returns unique groups in GROUP_ORDER with all manifests covered', () => {
    const groups = getGroups();
    const groupNames = groups.map((g) => g.group);
    expect(new Set(groupNames).size).toBe(groupNames.length);
    const indexes = groupNames.map((g) =>
      GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : 999
    );
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    const covered = groups.flatMap((g) => g.manifests.map((m) => m.id));
    expect(covered.sort()).toStrictEqual(
      SETTINGS_MANIFESTS.map((m) => m.id).sort()
    );
  });

  it('field permission falls back from categoryPermission to editPermission', () => {
    const auth = getManifest('auth');
    const cookieField = auth.fields.find((f) => f.categoryPermission);
    expect(cookieField).toBeTruthy();
    expect(fieldEditPermission(auth, cookieField)).toBe(
      cookieField.categoryPermission
    );
    const jwt = auth.fields.find((f) => !f.categoryPermission);
    expect(fieldEditPermission(auth, jwt)).toBe(auth.editPermission);
  });
});
