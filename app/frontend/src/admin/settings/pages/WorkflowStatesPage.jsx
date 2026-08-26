import { useEffect, useRef, useState } from 'react';
import { Loading } from '../../../components/Loading.jsx';
import { request, can, errorText } from '../../../lib/api.js';
import { useAuth } from '../../../lib/AuthContext.jsx';

/**
 * WorkflowStatesPage — custom page của Settings Shell v2 (nhóm "workflow").
 * Đọc GET /api/v1/config/workflow/states và hiển thị bảng trạng thái.
 * Người có quyền config.edit.workflow có thể sửa tên hiển thị (label) inline
 * qua PUT /api/v1/config/workflow/states/:code (body { ten_hien_thi }).
 */
export function WorkflowStatesPage() {
  const { user } = useAuth();
  const [states, setStates] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editingCode, setEditingCode] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const canEdit = can(user, 'config.edit.workflow');

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

  useEffect(() => {
    if (editingCode && inputRef.current) inputRef.current.focus();
  }, [editingCode]);

  function startEdit(state) {
    setError(null);
    setNotice(null);
    setEditingCode(state.code);
    setDraft(state.label);
  }

  function cancelEdit() {
    setEditingCode(null);
    setDraft('');
  }

  async function saveEdit(code) {
    const tenHienThi = draft.trim();
    if (!tenHienThi || saving) return;
    const prevStates = states;
    setSaving(true);
    setError(null);
    try {
      const res = await request(`/api/v1/config/workflow/states/${encodeURIComponent(code)}`, {
        method: 'PUT',
        body: JSON.stringify({ ten_hien_thi: tenHienThi }),
      });
      const updated = res?.data;
      setStates((list) =>
        list.map((s) => (s.code === code ? { ...s, label: updated?.label ?? tenHienThi } : s))
      );
      setNotice(`Đã đổi tên hiển thị của ${code} thành "${updated?.label ?? tenHienThi}".`);
      cancelEdit();
    } catch (e) {
      setStates(prevStates);
      setError(errorText(e));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  if (error && states === null) {
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
                    <td>{editingCode === s.code ? (
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEdit(s.code);
                        }}
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          value={draft}
                          maxLength={200}
                          disabled={saving}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          aria-label={`Tên hiển thị mới cho ${s.code}`}
                        />
                        <button type="submit" disabled={!draft.trim() || saving}>
                          Lưu
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={saving}>
                          Hủy
                        </button>
                      </form>
                    ) : canEdit ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => startEdit(s)}
                        aria-label={`Sửa tên hiển thị của ${s.label}`}
                      >
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
