/**
 * Settings Manifest registry (Wave 2).
 * Each JSON file declares one settings page; the shell renders everything
 * from this registry — adding a module means adding a manifest file only.
 */
import auth from './auth.json';
import rateLimit from './rate-limit.json';
import upload from './upload.json';
import security from './security.json';
import smtp from './smtp.json';
import notification from './notification.json';
import ui from './ui.json';
import pagination from './pagination.json';
import cleanup from './cleanup.json';
import audit from './audit.json';
import pool from './pool.json';
import features from './features.json';

// Sidebar group ordering (docs/settings-center/04 §4.4).
export const GROUP_ORDER = [
  'overview',
  'workspace',
  'security',
  'workflow',
  'notification',
  'system',
  'advanced',
];

/** Vietnamese labels for sidebar group headings + breadcrumbs. */
export const GROUP_LABELS = {
  overview: 'Tổng quan',
  workspace: 'Không gian làm việc',
  security: 'Bảo mật',
  workflow: 'Nghiệp vụ',
  notification: 'Thông báo',
  system: 'Hệ thống',
  advanced: 'Nâng cao',
};

export const SETTINGS_MANIFESTS = [auth, rateLimit, upload, security, smtp, notification, ui, pagination, cleanup, audit, pool, features].sort(
  (a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return (ga < 0 ? 999 : ga) - (gb < 0 ? 999 : gb);
    return (a.order ?? 999) - (b.order ?? 999);
  }
);

/** Find a manifest by id, or null. */
export function getManifest(id) {
  return SETTINGS_MANIFESTS.find((m) => m.id === id) || null;
}

/**
 * Group manifests for the sidebar: [{ group, label, manifests: [...] }]
 * following GROUP_ORDER; unknown groups keep first-seen order at the end.
 */
export function getGroups() {
  const groups = [];
  const byGroup = new Map();
  for (const m of SETTINGS_MANIFESTS) {
    if (!byGroup.has(m.group)) {
      byGroup.set(m.group, []);
      groups.push(m.group);
    }
    byGroup.get(m.group).push(m);
  }
  groups.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return groups.map((group) => ({
    group,
    label: GROUP_LABELS[group] || group,
    manifests: byGroup.get(group),
  }));
}

/** Effective permission required to edit one field (falls back to manifest-level). */
export function fieldEditPermission(manifest, field) {
  return field.categoryPermission || manifest.editPermission || 'config.edit.general';
}
