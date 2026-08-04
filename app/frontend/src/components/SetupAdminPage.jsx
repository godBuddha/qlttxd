import { useState } from 'react';
import { request, errorText } from '../lib/api.js';

export function SetupAdminPage({ onSetup }) {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Mật khẩu xác nhận không khớp');
    setBusy(true); setError('');
    try {
      const result = await request('/api/v1/auth/setup-admin', {
        method: 'POST',
        body: JSON.stringify({ username: form.username, password: form.password, full_name: form.full_name, email: form.email || undefined, phone: form.phone || undefined })
      });
      localStorage.setItem('qlttxd_token', result.token);
      localStorage.setItem('qlttxd_user', JSON.stringify(result.user));
      onSetup(result.user);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">QL</div>
        <h1>QLTTXD</h1>
        <p>Đăng ký quản trị viên đầu tiên</p>
        {error && <div className="field-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Họ và tên<input required name="full_name" value={form.full_name} onChange={change} /></label>
          <label>Tên đăng nhập<input required name="username" value={form.username} onChange={change} minLength={3} maxLength={50} /></label>
          <label>Email<input type="email" name="email" value={form.email} onChange={change} /></label>
          <label>Số điện thoại<input name="phone" value={form.phone} onChange={change} /></label>
          <label>Mật khẩu<input required type="password" name="password" value={form.password} onChange={change} minLength={8} /></label>
          <label>Xác nhận mật khẩu<input required type="password" name="confirm" value={form.confirm} onChange={change} /></label>
          <button disabled={busy}>{busy ? 'Đang tạo tài khoản…' : 'Đăng ký quản trị viên'}</button>
        </form>
      </section>
    </main>
  );
}
