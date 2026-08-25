import { useEffect, useMemo, useState, useCallback } from 'react';
import { request, can, errorText, dateText } from '../../lib/api.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import {
  SETTINGS_MANIFESTS,
  getGroups,
  getManifest,
  GROUP_LABELS,
} from '../settings-manifests/index.js';
import { GeneratedForm } from './GeneratedForm.jsx';
import { SettingsSearch } from './SettingsSearch.jsx';
import { WorkflowStatesPage } from './pages/WorkflowStatesPage.jsx';
import { WorkflowTransitionsPage } from './pages/WorkflowTransitionsPage.jsx';
import { RolePermissionsPage } from './pages/RolePermissionsPage.jsx';
import { MimeTypesPage } from './pages/MimeTypesPage.jsx';
import { ImportExportPage } from './pages/ImportExportPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { PerUserPage } from './pages/PerUserPage.jsx';
// OverviewPage (trang tổng quan shell v2) được nâng cấp riêng trong pages/OverviewPage.jsx.
import {
  KeyRound,
  Gauge,
  Upload,
  Shield,
  Mail,
  BellRing,
  Palette,
  ListOrdered,
  Eraser,
  ScrollText,
  Database,
  ToggleLeft,
  Search,
} from 'lucide-react';

// Manifest icon names → lucide components (font-independent, aria-hidden).
const ICONS = {
  'key-round': KeyRound,
  gauge: Gauge,
  upload: Upload,
  shield: Shield,
  mail: Mail,
  'bell-ring': BellRing,
  palette: Palette,
  'list-ordered': ListOrdered,
  eraser: Eraser,
  'scroll-text': ScrollText,
  database: Database,
  'toggle-left': ToggleLeft,
};

/**
 * Custom pages (Wave 3) — non-manifest pages rendered inside the shell v2.
 * Each entry: id (route segment under /admin/settings/v2/), group for the
 * sidebar, Vietnamese label, icon name and the component to render.
 */
export const CUSTOM_PAGES = [
  { id: 'workflow-states', group: 'workflow', label: 'Trạng thái hồ sơ', icon: 'list-ordered', component: WorkflowStatesPage },
  { id: 'workflow-transitions', group: 'workflow', label: 'Chuyển trạng thái', icon: 'git-branch', component: WorkflowTransitionsPage },
  { id: 'role-permissions', group: 'workflow', label: 'Quyền theo vai trò', icon: 'key-round', component: RolePermissionsPage },
  { id: 'mime-types', group: 'security', label: 'Loại tệp cho phép', icon: 'shield', component: MimeTypesPage },
  { id: 'import-export', group: 'system', label: 'Nhập / xuất cấu hình', icon: 'scroll-text', component: ImportExportPage },
  { id: 'preferences', group: 'workspace', label: 'Tùy chọn cá nhân', icon: 'palette', component: PerUserPage },
];

const CUSTOM_BY_ID = new Map(CUSTOM_PAGES.map((p) => [p.id, p]));

/** Find a custom page by id, or null. */
function getCustomPage(id) {
  return CUSTOM_BY_ID.get(id) || null;
}

function ManifestIcon({ name, size = 16 }) {
  const Cmp = ICONS[name] || ToggleLeft;
  return <Cmp size={size} aria-hidden="true" />;
}

/**
 * Settings Shell v2 — sidebar, breadcrumb, search and pages are all rendered
 * from the manifest registry. Adding a settings module = adding a JSON file.
 * Route shape: /admin/settings/v2 (overview) and /admin/settings/v2/<manifestId>.
 */
export function SettingsShellV2({ navigate, pageId }) {
  const { user } = useAuth();
  const activeId = pageId ? String(pageId).replace(/^admin-settings-v2-/, '') : null;
  const activeManifest = activeId ? getManifest(activeId) : null;
  const activeCustom = activeId ? getCustomPage(activeId) : null;
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightKey, setHighlightKey] = useState(null);

  // Ctrl/Cmd+K opens the search palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // View permission gate: config.view is required for any settings page.
  const hasView = can(user, 'config.view');
  const groups = useMemo(getGroups, []);

  // Sidebar entries for custom pages, grouped after the manifest groups.
  const customGroups = useMemo(() => {
    const order = ['workspace', 'security', 'workflow', 'system'];
    return order
      .map((group) => ({
        group,
        label: GROUP_LABELS[group] || group,
        pages: CUSTOM_PAGES.filter((p) => p.group === group),
      }))
      .filter((g) => g.pages.length > 0);
  }, []);

  /** Search result → navigate + scroll & highlight the field. */
  const handleSearchNavigate = useCallback(
    (entry) => {
      const target = `admin-settings-v2-${entry.manifestId}`;
      setHighlightKey(entry.key);
      navigate(target);
    },
    [navigate]
  );

  // After navigation, scroll the highlighted field into view for ~2s.
  useEffect(() => {
    if (!highlightKey) return undefined;
    const id = `field-${highlightKey.replace(/\./g, '-')}`;
    const t1 = setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: 'center' });
      // Warm ring for ~2s so the user lands on the exact field.
      el?.classList.add('field-highlight');
    }, 350); // wait for lazy page render
    const t2 = setTimeout(() => {
      document.getElementById(id)?.classList.remove('field-highlight');
      setHighlightKey(null);
    }, 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightKey, activeManifest]);

  if (!hasView) {
    return (
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cài đặt hệ thống</h2>
        </div>
        <div className="notice error" role="alert">
          <span>Bạn không có quyền xem cấu hình hệ thống.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="settings-v2-toolbar">
        <button
          type="button"
          className="search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="Tìm kiếm cài đặt (Ctrl+K)"
        >
          <Search size={16} aria-hidden="true" />
          <span>Tìm…</span>
          <kbd>Ctrl+K</kbd>
        </button>

      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <nav aria-label="Cài đặt hệ thống v2">
            <SidebarLink
              label="Tổng quan"
              active={!activeManifest}
              onClick={() => navigate('admin-settings-v2')}
              icon={<ManifestIcon name="gauge" />}
            />
            {groups.map(({ group, label, manifests }) => (
              <div key={group}>
                <div className="nav-group">{label}</div>
                {manifests.map((m) => (
                  <SidebarLink
                    key={m.id}
                    label={m.title}
                    icon={<ManifestIcon name={m.icon} />}
                    active={activeManifest?.id === m.id}
                    onClick={() => navigate(`admin-settings-v2-${m.id}`)}
                  />
                ))}
              </div>
            ))}
            {customGroups.map(({ group, label, pages }) => (
              <div key={`custom-${group}`}>
                <div className="nav-group">{label}</div>
                {pages.map((p) => (
                  <SidebarLink
                    key={p.id}
                    label={p.label}
                    icon={<ManifestIcon name={p.icon} />}
                    active={activeCustom?.id === p.id}
                    onClick={() => navigate(`admin-settings-v2-${p.id}`)}
                  />
                ))}
              </div>
            ))}
          </nav>

        </aside>

        <main className="settings-main">
          {activeManifest ? (
            <ManifestPage
              key={activeManifest.id}
              manifest={activeManifest}
              user={user}
              navigate={navigate}
            />
          ) : activeCustom ? (
            <CustomPage page={activeCustom} navigate={navigate} />
          ) : (
            <OverviewPage navigate={navigate} />
          )}
        </main>
      </div>

      <SettingsSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />
    </>
  );
}

function SidebarLink({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      className={active ? 'selected' : ''}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** One manifest → breadcrumb + generated form. */
function ManifestPage({ manifest, user, navigate }) {
  const groupLabel = GROUP_LABELS[manifest.group] || manifest.group;
  return (
    <>
      <div className="page-title">
        <div>
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <button type="button" className="text-button" onClick={() => navigate('admin-settings-v2')}>
              Cài đặt
            </button>
            <span aria-hidden="true"> / </span>
            <span>{groupLabel}</span>
            <span aria-hidden="true"> / </span>
            <strong>{manifest.title}</strong>
          </nav>
          <h2>{manifest.title}</h2>
        </div>
      </div>
      <section className="panel generated-panel">
        <GeneratedForm manifest={manifest} user={user} />
      </section>
    </>
  );
}

/** One custom page → breadcrumb + its component. */
function CustomPage({ page, navigate }) {
  const Cmp = page.component;
  const groupLabel = GROUP_LABELS[page.group] || page.group;
  return (
    <>
      <div className="page-title">
        <div>
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <button type="button" className="text-button" onClick={() => navigate('admin-settings-v2')}>
              Cài đặt
            </button>
            <span aria-hidden="true"> / </span>
            <span>{groupLabel}</span>
            <span aria-hidden="true"> / </span>
            <strong>{page.label}</strong>
          </nav>
          <h2>{page.label}</h2>
        </div>
      </div>
      <section className="panel generated-panel">
        <Cmp />
      </section>
    </>
  );
}

/** Overview: group cards + system health + recent changes. */
function OverviewPageLocal({ navigate }) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cài đặt hệ thống</h2>
          <p className="settings-subtitle">
            Chọn một nhóm cấu hình để xem và chỉnh sửa.
          </p>
        </div>
      </div>

      <div className="overview-grid">
        <section className="panel overview-groups" aria-labelledby="ov-groups-h">
          <h3 id="ov-groups-h">Nhóm cài đặt</h3>
          <div className="settings-grid">
            {getGroups().flatMap(({ group, manifests }) =>
              manifests.map((m) => (
                <div
                  key={`${group}.${m.id}`}
                  className="settings-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Cài đặt ${m.title}`}
                  onClick={() => navigate(`admin-settings-v2-${m.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`admin-settings-v2-${m.id}`);
                    }
                  }}
                >
                  <div className="card-icon nav-icon">
                    <ManifestIcon name={m.icon} size={22} />
                  </div>
                  <div className="card-label">{m.title}</div>
                  <div className="card-desc">
                    {GROUP_LABELS[group] || group} · {m.fields.length} tham số
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <SystemHealthCard />
        <RecentChangesCard />
      </div>
    </>
  );
}

/** Reads GET /health and counts known config keys from manifests. */
function SystemHealthCard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    request('/health')
      .then((r) => {
        if (!cancelled) setHealth(r);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const keyCount = SETTINGS_MANIFESTS.reduce((n, m) => n + m.fields.length, 0);

  return (
    <section className="panel overview-health" aria-labelledby="ov-health-h">
      <h3 id="ov-health-h">Tổng quan hệ thống</h3>
      <dl className="health-list">
        <dt>Trạng thái máy chủ</dt>
        <dd>
          {error ? (
            <span className="badge da_huy">Không kết nối được</span>
          ) : health === null ? (
            <span className="badge draft">Đang kiểm tra…</span>
          ) : (
            <span className={`badge ${health.status === 'ok' ? 'da_khac_phuc' : 'da_huy'}`}>
              {health.status === 'ok' ? 'Hoạt động' : 'Lỗi'}
            </span>
          )}
        </dd>
        <dt>Cơ sở dữ liệu</dt>
        <dd>{health?.db || (error ? '—' : 'Đang kiểm tra…')}</dd>
        <dt>Thời gian hoạt động</dt>
        <dd>{health ? formatUptime(health.uptime) : '—'}</dd>
        <dt>Số tham số cấu hình</dt>
        <dd>{keyCount}</dd>
      </dl>
    </section>
  );
}

/** Last 8 config mutations from the audit log (system_config table only). */
function RecentChangesCard({ limit = 8 }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    request(`/api/v1/admin/audit-log?limit=${limit}&bang=system_config`)
      .then((r) => {
        if (!cancelled) setRows(Array.isArray(r?.data) ? r.data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <section className="panel overview-recent" aria-labelledby="ov-recent-h">
      <h3 id="ov-recent-h">Thay đổi gần đây</h3>
      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {rows === null && !error && <p className="hint">Đang tải…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="empty">Chưa có thay đổi nào được ghi nhận.</p>
      )}
      {rows !== null && rows.length > 0 && (
        <ul className="record-list">
          {rows.map((r) => {
            const detail = r.chi_tiet || {};
            const where = detail.category && detail.key ? `${detail.category}.${detail.key}` : detail.key || r.id_ban_ghi || '';
            return (
              <li key={r.id}>
                <strong>{r.full_name || r.username || 'Hệ thống'}</strong>{' '}
                <span>{where}</span>
                <time dateTime={r.thoi_gian}>{dateText(r.thoi_gian)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatUptime(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return '—';
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}
