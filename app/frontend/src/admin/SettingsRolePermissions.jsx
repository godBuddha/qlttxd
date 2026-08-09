import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';

/** Shared style objects */
const thStyle = { padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--muted, #6c757d)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };
const btnStyle = { padding: '6px 14px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 };

export function SettingsRolePermissions({ api, _notify }) {
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
        onClick={() => handleToggle(roleCode, stateCode)}
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s',
          backgroundColor: checked ? '#1a56db' : '#d1d5db',
        }}
        role="switch"
        aria-checked={checked}
        aria-label={`Phân quyền ${roles.find(r => r.code === roleCode)?.name || roleCode} cho trạng thái ${stateCode}`}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
        {isChanged && (
          <span style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#f59e0b',
            border: '1px solid #fff',
          }} />
        )}
      </button>
    );
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
          <h2>Quyền theo vai trò</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Bật/tắt quyền truy cập từng trạng thái cho mỗi vai trò
        </small>
      </div>
      <section className="panel">
        {hasChanges && (
          <div style={{ padding: '12px 16px', marginBottom: 16, background: '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Có thay đổi chưa lưu.</span>
            <button onClick={saveAll} disabled={saving} style={btnStyle}>
              {saving ? 'Đang lưu...' : 'Lưu tất cả'}
            </button>
            <button className="text-button" onClick={cancelChanges} disabled={saving}>Bỏ thay đổi</button>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Trạng thái</th>
              {roles.map((r) => (
                <th key={r.code} style={thStyle}>
                  <div>{r.name}</div>
                  <small style={{ fontWeight: 400, fontSize: 11 }}>{r.code}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  <span>{s.label}</span>
                  <br />
                  <small style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted, #6c757d)' }}>{s.code}</small>
                  {s.is_terminal && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626' }}>● kết thúc</span>
                  )}
                </td>
                {roles.map((r) => (
                  <td key={`${r.code}-${s.code}`} style={{ ...tdStyle, textAlign: 'center' }}>
                    {renderCheckbox(r.code, s.code)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {states.length === 0 && (
          <p style={{ color: 'var(--muted, #6c757d)', textAlign: 'center', padding: 32 }}>
            Chưa có dữ liệu phân quyền nào được cấu hình.
          </p>
        )}
      </section>
    </>
  );
}
