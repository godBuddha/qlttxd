import { useState } from 'react';
import { errorText } from '../lib/api.js';

export function ProfilePage({ api, user, notify }) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [busy, setBusy] = useState(false);
  async function changePassword(e) {
    e.preventDefault();
    if (newPass !== confirmPass) { notify('Mật khẩu xác nhận không khớp', 'error'); return; }
    setBusy(true);
    try {
      await api('/api/v1/auth/password', { method: 'PATCH', body: JSON.stringify({ old_password: oldPass, new_password: newPass }) });
      notify('Đã đổi mật khẩu thành công', 'success');
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (e) { notify(errorText(e), 'error'); }
    setBusy(false);
  }
  return (
    <>
      <div className="page-title"><div><p className="eyebrow">Hồ sơ</p><h2>{user.full_name}</h2></div></div>
      <section className="panel"><h3>Thông tin tài khoản</h3><dl><dt>Tên đăng nhập</dt><dd>{user.username}</dd><dt>Email</dt><dd>{user.email || '—'}</dd><dt>Điện thoại</dt><dd>{user.phone || '—'}</dd><dt>Vai trò</dt><dd>{user.roles?.join(', ') || '—'}</dd></dl></section>
      <section className="panel profile-card"><h3>Đổi mật khẩu</h3><form onSubmit={changePassword}><label>Mật khẩu cũ<input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} required /></label><label>Mật khẩu mới<input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={8} /></label><label>Xác nhận<input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required /></label><button disabled={busy}>{busy ? 'Đang lưu...' : 'Đổi mật khẩu'}</button></form></section>
    </>
  );
}
