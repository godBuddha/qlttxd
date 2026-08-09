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
    <div className="notice error">
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
        <p className="settings-subtitle">
          Danh sách 15 trạng thái hiện có (chỉ xem, sửa trong DB migration)
        </p>
      </div>
      <section className="panel">
        {states.length === 0 ? (
          <p className="empty">
            Chưa có trạng thái workflow nào được cấu hình.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="table-cell-center">Thứ tự</th>
                  <th>Mã</th>
                  <th>Tên trạng thái</th>
                  <th className="table-cell-center">Kết thúc</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="table-cell-center"><code className="state-code">{idx + 1}</code></td>
                    <td><code className="state-code primary">{s.code}</code></td>
                    <td><strong>{s.label}</strong></td>
                    <td className="table-cell-center">
                      {s.is_terminal ? (
                        <span className="terminal-badge yes">Đã xong</span>
                      ) : (
                        <span className="terminal-badge no">Tiếp tục</span>
                      )}
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
