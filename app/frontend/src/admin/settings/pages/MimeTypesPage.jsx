import { useEffect, useState } from 'react';
import { request, can, errorText } from '../../../lib/api.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { Loading } from '../../../components/Loading.jsx';

/**
 * MimeTypesPage — custom page của Settings Shell v2 (nhóm "security").
 * Dữ liệu: GET /api/v1/config/allowed-mime-types.
 * Toggle is_active → PUT cập nhật (optimistic + rollback).
 * Nút "Thêm" bị vô hiệu theo thiết kế (loại tệp mới cần bộ kiểm tra dữ liệu thật).
 * Empty state: cảnh báo đỏ vì hệ thống sẽ từ chối mọi tệp tải lên.
 */
export function MimeTypesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Backend chưa có endpoint riêng để thêm/sửa MIME → chỉ toggle is_active qua PUT config.
  const canEdit = can(user, 'config.edit.security');

  useEffect(() => {
    let cancelled = false;
    request('/api/v1/config/allowed-mime-types')
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(item) {
    if (!canEdit || savingId) return;
    const prevItems = items;
    const nextActive = !item.is_active;
    setItems((list) => list.map((x) => (x.id === item.id ? { ...x, is_active: nextActive } : x)));
    setError(null);
    setNotice(null);
    setSavingId(item.id);
    try {
      await request(`/api/v1/config/security/mime-types/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: nextActive }),
      });
      setNotice(`Đã ${nextActive ? 'bật' : 'tắt'} loại tệp ${item.mime_type}.`);
    } catch (e) {
      // Rollback khi lỗi
      setItems(prevItems);
      setError(errorText(e));
    } finally {
      setSavingId(null);
    }
  }

  if (error && items === null) {
    return (
      <div className="notice error" role="alert">
        <span>Lỗi tải danh sách loại tệp: {error}</span>
      </div>
    );
  }
  if (items === null) return <Loading />;

  return (
    <>
      <p className="settings-subtitle">
        Các loại tệp được phép tải lên và yêu cầu kiểm tra magic bytes{canEdit ? '' : ' (chỉ xem)'}.
      </p>

      <div aria-live="polite">
        {notice ? (
          <div className="notice" role="status">
            <span>{notice}</span>
          </div>
        ) : null}
        {error ? (
          <div className="notice error" role="alert">
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <section className="panel" aria-labelledby="mime-h">
        <h3 id="mime-h">Loại tệp được phép</h3>
        <div className="flex-row">
          <button
            type="button"
            disabled
            title="Loại tệp mới cần cập nhật bộ kiểm tra dữ liệu thật — liên hệ đội phát triển"
            aria-label="Thêm loại tệp mới (hiện không khả dụng)"
          >
            Thêm
          </button>
        </div>
        {items.length === 0 ? (
          <div className="notice error" role="alert">
            <span>Không có loại tệp nào được phép — hệ thống sẽ từ chối mọi tệp tải lên.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Loại tệp (MIME)</th>
                  <th scope="col">Phần mở rộng</th>
                  <th scope="col" className="table-cell-center">
                    Kích hoạt
                  </th>
                  <th scope="col" className="table-cell-center">
                    Yêu cầu magic bytes
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <code>{it.mime_type}</code>
                    </td>
                    <td>{it.extension || ''}</td>
                    <td className="table-cell-center">
                      <input
                        type="checkbox"
                        checked={Boolean(it.is_active)}
                        onChange={() => handleToggle(it)}
                        disabled={!canEdit || savingId === it.id}
                        aria-label={`Kích hoạt loại tệp ${it.mime_type}`}
                      />
                    </td>
                    <td className="table-cell-center">{it.magic_bytes_required ? '✓' : ''}</td>
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
