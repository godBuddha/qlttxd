import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading.jsx';
import { request, errorText } from '../../../lib/api.js';

/**
 * WorkflowStatesPage — custom page của Settings Shell v2 (nhóm "workflow").
 * Đọc GET /api/v1/config/workflow/states và hiển thị bảng trạng thái.
 * Backend hiện KHÔNG có endpoint PUT /workflow/states/:code để đổi label,
 * nên trang chạy ở chế độ chỉ xem (view-only).
 */
export function WorkflowStatesPage() {
  const { user } = useAuth();
  const [states, setStates] = useState(null);
  const [error, setError] = useState(null);

  // Backend chưa hỗ trợ PUT /workflow/states/:code → luôn view-only.
  const canEdit = false;

  useEffect(() => {
    let cancelled = false;
    request('/api/v1/config/workflow/states')
      .then((data) => {
        if (!cancelled) setStates(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="notice error" role="alert">
        <span>Lỗi tải danh sách trạng thái: {error}</span>
      </div>
    );
  }
  if (states === null) return <Loading />;

  return (
    <>
      <p className="settings-subtitle">
        Danh sách các trạng thái workflow của hồ sơ
        {canEdit ? ' — nhấp vào tên hiển thị để sửa.' : ' (chỉ xem).'}
      </p>
      <section className="panel" aria-labelledby="wf-states-h">
        <h3 id="wf-states-h">Trạng thái workflow</h3>
        {states.length === 0 ? (
          <p className="empty">Chưa có trạng thái nào</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Tên hiển thị</th>
                  <th scope="col" className="table-cell-center">Kết thúc</th>
                  <th scope="col" className="table-cell-center">Thứ tự</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s, idx) => (
                  <tr key={s.code || s.id}>
                    <td>
                      <code className="state-code primary">{s.code}</code>
                    </td>
                    <td>{canEdit ? (
                      /* Khi backend có PUT /workflow/states/:code sẽ bật sửa inline tại đây */
                      <button type="button" className="text-button" aria-label={`Sửa tên hiển thị của ${s.label}`}>
                        {s.label}
                      </button>
                    ) : (
                      <strong>{s.label}</strong>
                    )}</td>
                    <td className="table-cell-center">
                      {s.is_terminal ? 'Kết thúc' : ''}
                    </td>
                    <td className="table-cell-center">{idx + 1}</td>
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
