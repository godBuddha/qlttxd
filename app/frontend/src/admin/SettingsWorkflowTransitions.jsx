import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

export function SettingsWorkflowTransitions({ api, notify, navigate }) {
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config/workflow/transitions')
      .then((data) => {
        if (!cancelled) setTransitions(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Lỗi tải danh sách chuyển trạng thái');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function startEdit(t) {
    setEditingId(t.id);
    setEditLabel(t.label ?? '');
    setEditSortOrder(String(t.sort_order ?? ''));
  }

  async function save() {
    if (!editingId) return;
    setSaving(true);
    try {
      await api(`/api/v1/config/workflow/transitions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ label: editLabel, sort_order: Number(editSortOrder) }),
      });
      setTransitions((prev) => prev.map((t) =>
        t.id === editingId ? { ...t, label: editLabel, sort_order: Number(editSortOrder) } : t
      ));
      setEditingId(null);
      setEditLabel('');
      setEditSortOrder('');
      notify('Đã cập nhật chuyển trạng thái.', 'success');
    } catch (err) {
      notify(err?.message || 'Lỗi lưu thay đổi', 'error');
    } finally {
      setSaving(false);
    }
  }

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
          <h2>Chuyển trạng thái</h2>
          {navigate && (
            <button className="back" onClick={() => navigate('admin-settings')}>
              ← Quay lại Cài đặt
            </button>
          )}
        </div>
        <p className="settings-subtitle">
          Chỉnh sửa nhãn và thứ tự các chuyển trạng thái
        </p>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thứ tự</th>
                <th>Từ trạng thái</th>
                <th>Đến trạng thái</th>
                <th>Nhãn hiển thị</th>
                <th className="table-cell-action-header">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((t) => {
                const isEditing = editingId === t.id;
                return (
                  <tr key={t.id}>
                    {/* Order */}
                    <td>
                      {isEditing ? (
                        <input type="number" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} className="input-tight" aria-label="Thứ tự" />
                      ) : (
                        <span className="state-code">{t.sort_order}</span>
                      )}
                    </td>
                    {/* From */}
                    <td><code className="state-code primary">{t.from_state}</code></td>
                    {/* To */}
                    <td><code className="state-code success">{t.to_state}</code></td>
                    {/* Label + Sort (edit) */}
                    <td>
                      {isEditing ? (
                        <div className="flex-row">
                          <input autoFocus type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input-medium" placeholder="Nhãn hiển thị" aria-label="Nhãn" />
                          <button onClick={save} disabled={saving}>
                            {saving ? 'Đang lưu...' : 'Lưu'}
                          </button>
                          <button className="text-button" onClick={() => setEditingId(null)} disabled={saving}>Hủy</button>
                        </div>
                      ) : (
                        <span>{t.label || '—'}</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td>
                      {!isEditing && (
                        <button className="text-button" onClick={() => startEdit(t)} aria-label={`Sửa ${t.from_state} → ${t.to_state}`}>
                          Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {transitions.length === 0 && (
          <p className="empty">
            Chưa có chuyển trạng thái nào được cấu hình.
          </p>
        )}
      </section>
    </>
  );
}
