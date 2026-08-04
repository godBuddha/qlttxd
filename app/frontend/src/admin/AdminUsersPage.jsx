import { useState, useEffect } from 'react';
import { errorText } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';

export function AdminUsersPage({ api, notify }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', roles: [] });
  const load = () => Promise.all([
    api('/api/v1/admin/users').then((r) => setUsers(r.data || [])),
    api('/api/v1/admin/roles').then((r) => setRoles(r.data || []))
  ]).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const toggleRole = (code) => setForm((f) => ({ ...f, roles: f.roles.includes(code) ? f.roles.filter((r) => r !== code) : [...f.roles, code] }));
  const openCreate = () => { setEditUser(null); setForm({ username: '', password: '', full_name: '', email: '', phone: '', roles: [] }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ username: u.username, password: '', full_name: u.full_name, email: u.email || '', phone: u.phone || '', roles: u.roles || [] }); setShowModal(true); };
  async function save(e) {
    e.preventDefault();
    try {
      if (editUser) {
        const payload = { full_name: form.full_name, email: form.email || null, phone: form.phone || null, roles: form.roles };
        if (form.password) payload.password = form.password;
        await api(`/api/v1/admin/users/${editUser.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        notify('Đã cập nhật người dùng.', 'success');
      } else {
        await api('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(form) });
        notify('Đã tạo người dùng mới.', 'success');
      }
      setShowModal(false); load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  async function toggleActive(u) {
    try {
      await api(`/api/v1/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) });
      notify(u.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.', 'success');
      load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title"><div><p className="eyebrow">Quản trị hệ thống</p><h2>Quản lý người dùng</h2></div><button onClick={openCreate}>Tạo tài khoản</button></div>
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.email || '—'}</td><td>{u.roles?.join(', ') || '—'}</td><td>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</td><td><button className="text-button" onClick={() => openEdit(u)}>Sửa</button><button className="text-button" onClick={() => toggleActive(u)}>{u.is_active ? 'Khóa' : 'Mở'}</button></td></tr>)}</tbody></table></div></section>
      {showModal && <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h3>{editUser ? 'Sửa người dùng' : 'Tạo người dùng'}</h3><form onSubmit={save}><label>Họ tên<input required name="full_name" value={form.full_name} onChange={change} /></label>{!editUser && <label>Tên đăng nhập<input required name="username" value={form.username} onChange={change} minLength={3} maxLength={50} /></label>}<label>Email<input type="email" name="email" value={form.email} onChange={change} /></label><label>Số điện thoại<input name="phone" value={form.phone} onChange={change} /></label><label>{editUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}<input type="password" name="password" value={form.password} onChange={change} minLength={8} /></label><fieldset><legend>Vai trò</legend>{roles.map((r) => <label key={r.code} className="checkbox"><input type="checkbox" checked={form.roles.includes(r.code)} onChange={() => toggleRole(r.code)} />{r.name}</label>)}</fieldset><div className="modal-actions"><button type="button" onClick={() => setShowModal(false)}>Hủy</button><button type="submit">Lưu</button></div></form></div></div>}
    </>
  );
}
