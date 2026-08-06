import { useState, useEffect } from 'react';
import { errorText, dateText } from '../lib/api.js';
import {
  AUDIT_TABLES,
  AUDIT_TABLE_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
} from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';

export function AdminAuditLogPage({ api, notify }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ bang: '', hanh_dong: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: filters.page, limit: 50 });
    if (filters.bang) q.set('bang', filters.bang);
    if (filters.hanh_dong) q.set('hanh_dong', filters.hanh_dong);
    api(`/api/v1/admin/audit-log?${q}`)
      .then((r) => setLogs(r.data || []))
      .catch((e) => notify(errorText(e), 'error'))
      .finally(() => setLoading(false));
  }, [filters]);
  const set = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value, page: key === 'page' ? value : 1 }));
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Nhật ký hệ thống</h2>
          <p>Xem lại mọi thao tác trong hệ thống — ai, làm gì, khi nào.</p>
        </div>
      </div>
      <section className="panel filters">
        <label>
          Bảng
          <select value={filters.bang} onChange={(e) => set('bang', e.target.value)}>
            {AUDIT_TABLES.map((t) => (
              <option key={t} value={t}>
                {AUDIT_TABLE_LABELS[t] || t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hành động
          <select value={filters.hanh_dong} onChange={(e) => set('hanh_dong', e.target.value)}>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a] || a}
              </option>
            ))}
          </select>
        </label>
      </section>
      {loading ? (
        <Loading />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người dùng</th>
                  <th>Hành động</th>
                  <th>Bảng</th>
                  <th>ID bản ghi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.length ? (
                  logs
                    .map((row) => (
                      <tr key={row.id} className={expandedId === row.id ? 'selected-row' : ''}>
                        <td>{dateText(row.thoi_gian)}</td>
                        <td>{row.full_name || row.username || '—'}</td>
                        <td>
                          <span className="badge">
                            {AUDIT_ACTION_LABELS[row.hanh_dong] || row.hanh_dong}
                          </span>
                        </td>
                        <td>{AUDIT_TABLE_LABELS[row.bang_bi_tac_dong] || row.bang_bi_tac_dong}</td>
                        <td>
                          <code style={{ fontSize: '.78rem' }}>
                            {row.id_ban_ghi ? String(row.id_ban_ghi).slice(0, 8) + '…' : '—'}
                          </code>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          >
                            {expandedId === row.id ? 'Thu gọn' : 'Chi tiết'}
                          </button>
                        </td>
                      </tr>
                    ))
                    .concat(expandedId ? [] : [])
                ) : (
                  <tr>
                    <td colSpan="6" className="empty">
                      Chưa có nhật ký nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {expandedId &&
            (() => {
              const row = logs.find((r) => r.id === expandedId);
              if (!row) return null;
              return (
                <div className="audit-detail">
                  <h4>Chi tiết thao tác</h4>
                  <dl>
                    <dt>Thời gian</dt>
                    <dd>{dateText(row.thoi_gian)}</dd>
                    <dt>Người dùng</dt>
                    <dd>
                      {row.full_name || row.username || '—'}{' '}
                      {row.username && row.full_name ? `(${row.username})` : ''}
                    </dd>
                    <dt>Hành động</dt>
                    <dd>{AUDIT_ACTION_LABELS[row.hanh_dong] || row.hanh_dong}</dd>
                    <dt>Bảng</dt>
                    <dd>{row.bang_bi_tac_dong}</dd>
                    <dt>ID bản ghi</dt>
                    <dd>{row.id_ban_ghi || '—'}</dd>
                    <dt>IP</dt>
                    <dd>{row.ip || '—'}</dd>
                    {row.request_id && (
                      <>
                        <dt>Request ID</dt>
                        <dd>{row.request_id}</dd>
                      </>
                    )}
                  </dl>
                  {row.chi_tiet && (
                    <div className="audit-json">
                      <h4>Dữ liệu chi tiết</h4>
                      <pre>
                        {typeof row.chi_tiet === 'string'
                          ? row.chi_tiet
                          : JSON.stringify(row.chi_tiet, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}
          <div className="pagination">
            <button disabled={filters.page === 1} onClick={() => set('page', filters.page - 1)}>
              ← Trang trước
            </button>
            <span>Trang {filters.page}</span>
            <button disabled={logs.length < 50} onClick={() => set('page', filters.page + 1)}>
              Trang sau →
            </button>
          </div>
        </section>
      )}
    </>
  );
}
