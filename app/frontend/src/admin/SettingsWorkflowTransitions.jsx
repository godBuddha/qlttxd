import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/** Shared style objects */
const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };
const inputStyle = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, outline: 'none' };
const btnStyle = { padding: '6px 14px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 };

export function SettingsWorkflowTransitions({ api, notify }) {
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
    <div className="panel" style={{ color: '#dc2626', padding: 24 }}>
      Lỗi: {error}
    </div>
  );

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Chuyển trạng thái</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Chỉnh sửa nhãn và thứ tự các chuyển trạng thái
        </small>
      </div>
      <section className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={thStyle}>Thứ tự</th>
              <th style={thStyle}>Từ trạng thái</th>
              <th style={thStyle}>Đến trạng thái</th>
              <th style={thStyle}>Nhãn hiển thị</th>
              <th style={{ ...thStyle, textAlign: 'center', width: 180 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {transitions.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Order */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input type="number" value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)} style={{ ...inputStyle, width: 60 }} aria-label="Thứ tự" />
                    ) : (
                      <span style={{ fontFamily: 'monospace' }}>{t.sort_order}</span>
                    )}
                  </td>
                  {/* From */}
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#1a56db' }}>{t.from_state}</span>
                  </td>
                  {/* To */}
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#16a34a' }}>{t.to_state}</span>
                  </td>
                  {/* Label + Sort (edit) */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input autoFocus type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ ...inputStyle, minWidth: 200 }} placeholder="Nhãn hiển thị" aria-label="Nhãn" />
                        <button onClick={save} disabled={saving} style={btnStyle}>
                          {saving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                        <button className="text-button" onClick={() => setEditingId(null)} disabled={saving}>Hủy</button>
                      </div>
                    ) : (
                      <span>{t.label || '—'}</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {!isEditing && (
                      <button className="text-button" onClick={() => startEdit(t)} style={{ fontSize: 13 }} aria-label={`Sửa ${t.from_state} → ${t.to_state}`}>
                        Sửa
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {transitions.length === 0 && (
          <p style={{ color: 'var(--muted, #6c757d)', textAlign: 'center', padding: 32 }}>
            Chưa có chuyển trạng thái nào được cấu hình.
          </p>
        )}
      </section>
    </>
  );
}
