import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/**
 * SettingsValidation — read-only view of validation rules.
 * No editing/saving allowed.
 */
export function SettingsValidation({ api, _notify }) {
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
    <div className="notice error">
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
        <p className="settings-subtitle">
          Các quy tắc validation hiện tại (chỉ xem)
        </p>
      </div>
      <section className="panel">
        {items.length === 0 ? (
          <p className="empty">
            Chưa có quy tắc kiểm tra nào được cấu hình.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên tham số</th>
                  <th>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.key}</strong>
                    </td>
                    <td className="value-mono">
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
          </div>
        )}
      </section>
    </>
  );
}
