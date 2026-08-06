import { useState, useEffect } from 'react';
import { errorText } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';

export function AdminRolesPage({ api, notify }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = () =>
    Promise.all([
      api('/api/v1/admin/roles').then((r) => setRoles(r.data || [])),
      api('/api/v1/admin/permissions').then((r) => setPermissions(r.data || [])),
    ]).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  const selectRole = (role) => {
    setSelectedRole(role);
    setRolePerms(role.permissions?.map((p) => p.id) || []);
  };
  const togglePerm = (id) =>
    setRolePerms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  async function save() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permission_ids: rolePerms }),
      });
      notify('Đã cập nhật quyền cho vai trò.', 'success');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Phân quyền vai trò</h2>
        </div>
      </div>
      <div className="two-col">
        <section className="panel">
          <h3>Vai trò</h3>
          <ul className="role-list">
            {roles.map((r) => (
              <li
                key={r.id}
                className={selectedRole?.id === r.id ? 'selected' : ''}
                onClick={() => selectRole(r)}
              >
                <b>{r.name}</b>
                <small>{r.code}</small>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3>Quyền hạn {selectedRole && `— ${selectedRole.name}`}</h3>
          {selectedRole ? (
            <>
              <div className="permission-grid">
                {permissions.map((mod) => (
                  <div key={mod.module} className="perm-module">
                    <h4>{mod.module}</h4>
                    {mod.permissions.map((p) => (
                      <label key={p.id} className="checkbox">
                        <input
                          type="checkbox"
                          checked={rolePerms.includes(p.id)}
                          onChange={() => togglePerm(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={save} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu quyền'}
              </button>
            </>
          ) : (
            <p className="empty">Chọn vai trò bên trái để chỉnh sửa quyền.</p>
          )}
        </section>
      </div>
    </>
  );
}
