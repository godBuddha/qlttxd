import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/**
 * SettingsWorkflowStates — read-only table of workflow states.
 */
export function SettingsWorkflowStates({ api, _notify }) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config/workflow/states')
      .then((data) => {
        if (!cancelled) setStates(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Lỗi tải danh sách trạng thái');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loading />;
  if (error) return (
    <div className="panel" style={{ color: '#dc2626', padding: 24 }}>
      Lỗi: {error}
    </div>
  );

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Trạng thái workflow</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Danh sách 15 trạng thái hiện có (chỉ xem, sửa trong DB migration)
        </small>
      </div>
      <section className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thứ tự</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mã</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tên trạng thái</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kết thúc</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s, idx) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13 }}>{idx + 1}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: '#1a56db' }}>{s.code}</td>
                <td style={{ padding: '10px 12px' }}>
                  <strong>{s.label}</strong>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {s.is_terminal ? (
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>Đã xong</span>
                  ) : (
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600 }}>Tiếp tục</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
