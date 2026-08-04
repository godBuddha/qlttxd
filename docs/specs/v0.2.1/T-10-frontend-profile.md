# SPEC T-10: Frontend Hồ sơ cá nhân + Đổi mật khẩu

> Task: coder (frontend) | Priority: P1 | Dependency: T-04

## Mục tiêu
Trang hồ sơ cá nhân và form đổi mật khẩu.

## Files thay đổi
1. `app/frontend/src/main.jsx` — thêm `ProfilePage`
2. `app/frontend/src/styles.css` — CSS cho profile

## Chi tiết

### Component `ProfilePage`
```jsx
function ProfilePage({ api, user, notify }) {
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
    <div className="page-title"><div><p className="eyebrow">Hồ sơ</p><h2>{user.full_name}</h2></div></div>
    <section className="panel">
      <h3>Thông tin tài khoản</h3>
      <p>Tên đăng nhập: {user.username}</p>
      <p>Email: {user.email || '—'}</p>
      <p>Điện thoại: {user.phone || '—'}</p>
      <p>Vai trò: {user.roles?.join(', ')}</p>
    </section>
    <section className="panel">
      <h3>Đổi mật khẩu</h3>
      <form onSubmit={changePassword}>
        <label>Mật khẩu cũ<input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} required /></label>
        <label>Mật khẩu mới<input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={8} /></label>
        <label>Xác nhận<input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required /></label>
        <button disabled={busy}>{busy ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
      </form>
    </section>
  );
}
```

### Menu
Thêm vào nav (hiển thị cho tất cả user đăng nhập):
```jsx
<button className={route.page === 'profile' ? 'selected' : ''} onClick={() => nav('profile')}>👤 Hồ sơ</button>
```

## Acceptance Criteria
- [ ] Trang hiển thị thông tin user
- [ ] Đổi mật khẩu hoạt động (old → new)
- [ ] Validation: mật khẩu mới ≥ 8 ký tự, có chữ và số
- [ ] Frontend build pass
