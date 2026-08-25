import { useEffect, useState } from 'react';
import { request, errorText, dateText } from '../../../lib/api.js';
import {
  SETTINGS_MANIFESTS,
  getGroups,
  GROUP_LABELS,
} from '../../settings-manifests/index.js';

/**
 * OverviewPage — trang tổng quan của Settings Shell v2.
 * - Sức khỏe hệ thống: GET /health.
 * - Đếm số tham số cấu hình từ các manifest đã đăng ký.
 * - Thay đổi gần đây: 8 bản ghi mới nhất từ audit log (bảng system_config).
 */
export function OverviewPage({ navigate }) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cài đặt hệ thống</h2>
          <p className="settings-subtitle">Chọn một nhóm cấu hình để xem và chỉnh sửa.</p>
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
