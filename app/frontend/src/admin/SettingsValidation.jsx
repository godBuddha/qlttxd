import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/**
 * SettingsValidation — read-only view of validation rules.
 * No editing/saving allowed.
 */
export function SettingsValidation({ api, notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=validation')
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setItems(list);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Lỗi tải cấu hình');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
          <h2>Quy tắc kiểm tra</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Các quy tắc validation hiện tại (chỉ xem)
        </small>
      </div>
      <section className="panel">
        {items.length === 0 ? (
          <p style={{ color: 'var(--muted, #6c757d)', textAlign: 'center', padding: 32 }}>
            Chưa có quy tắc kiểm tra nào được cấu hình.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tên tham số</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <strong>{item.key}</strong>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {typeof item.value === 'string' && item.value.includes(',') 
                      ? item.value.split(',').map((v, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            {v.trim()}
                          </span>
                        ))
                      : String(item.value ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
