import { useEffect, useMemo, useState } from 'react';
import { request, can, errorText } from '../../../lib/api.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { Loading } from '../../../components/Loading.jsx';

/**
 * RolePermissionsPage — custom page của Settings Shell v2 (nhóm "workflow").
 * Ma trận vai trò × trạng thái: GET /api/v1/config/workflow/role-permissions.
 * Cột sticky bên trái là tên vai trò; mỗi ô là một checkbox.
 * Lưu bulk: PUT /api/v1/config/workflow/role-permissions với { assignments }.
 * Optimistic update + rollback khi lỗi.
 */
export function RolePermissionsPage() {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState(null);
  const [roles, setRoles] = useState([]);
  const [states, setStates] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEdit = can(user, 'config.edit.workflow');

  useEffect(() => {
    let cancelled = false;
    request('/api/v1/config/workflow/role-permissions')
      .then((data) => {
        if (cancelled) return;
        setMatrix(data?.data && typeof data.data === 'object' ? data.data : {});
        setRoles(Array.isArray(data?.roles) ? data.roles : []);
        setStates(Array.isArray(data?.states) ? data.states : []);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stateCodes = useMemo(() => states.map((s) => s.code), [states]);

  function isChecked(roleCode, stateCode) {
    return Boolean(matrix?.[roleCode]?.[stateCode]);
  }

  /** Optimistic toggle; PUT một assignment duy nhất, rollback khi lỗi. */
  async function handleToggle(roleCode, stateCode) {
    if (!canEdit || saving || !matrix) return;
    const prevMatrix = matrix;
    const nextValue = !isChecked(roleCode, stateCode);
    setMatrix({
      ...prevMatrix,
      [roleCode]: { ...(prevMatrix[roleCode] || {}), [stateCode]: nextValue },
    });
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await request('/api/v1/config/workflow/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({
          assignments: [{ role_id: roleCode, state_code: stateCode, allowed: nextValue }],
        }),
      });
      setNotice(`Đã ${nextValue ? 'cấp' : 'thu hồi'} quyền cho vai trò "${roleCode}" tại trạng thái "${stateCode}".`);
    } catch (e) {
      // Rollback về ma trận trước đó khi lỗi.
      setMatrix(prevMatrix);
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && matrix === null) {
    return (
      <div className="notice error" role="alert">
        <span>Lỗi tải ma trận phân quyền: {error}</span>
      </div>
    );
  }
  if (matrix === null) return <Loading />;

  return (
    <>
      <p className="settings-subtitle">
        Ma trận phân quyền theo trạng thái: mỗi ô cho phép vai trò thao tác ở trạng thái tương ứng
        {canEdit ? '' : ' (chỉ xem)'}.
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

      <section className="panel" aria-labelledby="wf-roleperm-h">
        <h3 id="wf-roleperm-h">Quyền theo vai trò và trạng thái</h3>
        {roles.length === 0 || stateCodes.length === 0 ? (
          <p className="empty">Chưa có dữ liệu phân quyền nào.</p>
        ) : (
          <div className="table-wrap">
            <table className="wf-transition-matrix">
              <thead>
                <tr>
                  <th scope="col" className="sticky-col">
                    Vai trò \ Trạng thái
                  </th>
                  {states.map((s) => (
                    <th key={s.code} scope="col" className="table-cell-center" title={s.label}>
                      <code className="state-code">{s.code}</code>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.code}>
                    <th scope="row" className="sticky-col">
                      <span title={r.name}>{r.code}</span>
                    </th>
                    {stateCodes.map((sc) => {
                      const checked = isChecked(r.code, sc);
                      return (
                        <td key={`${r.code}-${sc}`} className="table-cell-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggle(r.code, sc)}
                            disabled={!canEdit || saving}
                            aria-label={`${r.code} được thao tác ở trạng thái ${sc}`}
                          />
                        </td>
                      );
                    })}
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
