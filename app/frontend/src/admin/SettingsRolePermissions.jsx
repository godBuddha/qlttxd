import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/** Shared style objects */

export function SettingsRolePermissions({ api, _notify, navigate }) {
  const [matrix, setMatrix] = useState({});
  const [roles, setRoles] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [tempMatrix, setTempMatrix] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config/workflow/role-permissions')
      .then((data) => {
        if (!cancelled) {
          setMatrix(data?.data || {});
          setRoles(Array.isArray(data?.roles) ? data.roles : []);
          setStates(Array.isArray(data?.states) ? data.states : []);
          // Clone matrix as initial temp
          setTempMatrix(JSON.parse(JSON.stringify(data?.data || {})));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Lỗi tải quyền theo vai trò');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleToggle(roleCode, stateCode) {
    if (!tempMatrix) return;
    const updated = { ...tempMatrix };
    if (!updated[roleCode]) updated[roleCode] = {};
    updated[roleCode][stateCode] = !updated[roleCode][stateCode];
    setTempMatrix(updated);
    setHasChanges(true);
  }

  async function saveAll() {
    if (!tempMatrix) return;
    setSaving(true);
    try {
      const assignments = [];
      for (const roleCode of Object.keys(tempMatrix)) {
        for (const stateCode of Object.keys(tempMatrix[roleCode])) {
          assignments.push({
            role_id: roleCode,
            state_code: stateCode,
            allowed: !!tempMatrix[roleCode][stateCode],
          });
        }
      }
      await api('/api/v1/config/workflow/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({ assignments }),
      });
      setMatrix(JSON.parse(JSON.stringify(tempMatrix)));
      setHasChanges(false);
      notify('Đã cập nhật phân quyền.', 'success');
    } catch (err) {
      notify(err?.message || 'Lỗi lưu phân quyền', 'error');
    } finally {
      setSaving(false);
    }
  }

  function cancelChanges() {
    setTempMatrix(JSON.parse(JSON.stringify(matrix)));
    setHasChanges(false);
  }

  function renderCheckbox(roleCode, stateCode) {
    const checked = tempMatrix?.[roleCode]?.[stateCode] ?? false;
    const currentVal = matrix?.[roleCode]?.[stateCode] ?? false;
    const isChanged = checked !== currentVal;
    return (
      <button
        className="toggle-switch"
        aria-checked={checked}
        aria-label={`Phân quyền ${roles.find(r => r.code === roleCode)?.name || roleCode} cho trạng thái ${stateCode}`}
      >
        <span className="toggle-thumb" />
        {isChanged && <span className="toggle-changed" />}
      </button>
    );
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
          <h2>Quyền theo vai trò</h2>
          {navigate && (
            <button className="back" onClick={() => navigate('admin-settings')}>
              ← Quay lại Cài đặt
            </button>
          )}
        </div>
        <p className="settings-subtitle">
          Bật/tắt quyền truy cập từng trạng thái cho mỗi vai trò
        </p>
      </div>
      <section className="panel">
        {hasChanges && (
          <div className="unsaved-bar">
            <span>Có thay đổi chưa lưu.</span>
            <button onClick={saveAll} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu tất cả'}
            </button>
            <button className="text-button" onClick={cancelChanges} disabled={saving}>Bỏ thay đổi</button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="table-cell-center">Trạng thái</th>
                {roles.map((r) => (
                  <th key={r.code}>
                    <div>{r.name}</div>
                    <small className="role-code-display">{r.code}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.code}>
                  <td className="state-label-text">
                    <span>{s.label}</span>
                    <br />
                    <small className="state-code-display">{s.code}</small>
                    {s.is_terminal && (
                      <span className="terminal-indicator">● kết thúc</span>
                    )}
                  </td>
                  {roles.map((r) => (
                    <td key={`${r.code}-${s.code}`} className="table-cell-center">
                      {renderCheckbox(r.code, s.code)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {states.length === 0 && (
          <p className="empty">
            Chưa có dữ liệu phân quyền nào được cấu hình.
          </p>
        )}
      </section>
    </>
  );
}
