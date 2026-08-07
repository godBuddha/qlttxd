import { useState } from 'react';
import { request, errorText } from '../lib/api.js';
import { Notice } from './Notice.jsx';
import { ForgotPasswordPage, ResetPasswordPage } from './ForgotPassword.jsx';

export function Login({ onLogin, notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get('token') || ''
  );
  const goLogin = () => {
    setResetToken('');
    setShowForgot(false);
    window.history.replaceState(null, '', window.location.pathname);
  };
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Include cookies for refresh token
      });
      localStorage.setItem('qlttxd_token', result.token);
      localStorage.setItem('qlttxd_user', JSON.stringify(result.user));
      onLogin(result.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  if (resetToken) return <ResetPasswordPage initialToken={resetToken} onBack={goLogin} />;
  if (showForgot)
    return (
      <ForgotPasswordPage
        onBack={() => setShowForgot(false)}
        onResetToken={(t) => setResetToken(t)}
      />
    );
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">QL</div>
        <h1>QLTTXD</h1>
        <p>Hệ thống quản lý trật tự xây dựng</p>
        <Notice notice={notice} onClose={() => {}} />
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Tên đăng nhập
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Mật khẩu
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
        <button className="forgot-password-link" onClick={() => setShowForgot(true)}>
          Quên mật khẩu?
        </button>
      </section>
    </main>
  );
}
