import { useState } from 'react';
import { request, errorText } from '../lib/api.js';

export function ForgotPasswordPage({ onBack, onResetToken }) {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
      setSent(true);
      if (result.dev_token) setDevToken(result.dev_token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">QL</div>
          <h1>Kiểm tra email</h1>
          <p>
            Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi. Token có hiệu lực trong
            15 phút.
          </p>
          {devToken && (
            <div className="dev-token-box">
              <p>
                <strong>[DEV]</strong> Token phát hiện — nhấp để đặt lại trực tiếp:
              </p>
              <button
                className="forgot-password-link"
                onClick={() => onResetToken?.(devToken)}
                style={{ fontSize: '1rem' }}
              >
                → Đặt lại mật khẩu ngay
              </button>
            </div>
          )}
          <button className="forgot-password-link" onClick={onBack}>
            ← Quay lại đăng nhập
          </button>
        </section>
      </main>
    );
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">QL</div>
        <h1>Quên mật khẩu</h1>
        <p>Nhập tên đăng nhập hoặc email để nhận hướng dẫn đặt lại mật khẩu.</p>
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Tên đăng nhập hoặc email
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </label>
          <button disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi hướng dẫn'}</button>
        </form>
        <button className="forgot-password-link" onClick={onBack}>
          ← Quay lại đăng nhập
        </button>
      </section>
    </main>
  );
}

export function ResetPasswordPage({ initialToken, onBack }) {
  const [token, setToken] = useState(initialToken || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      await request('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">QL</div>
          <h1>Thành công</h1>
          <p>Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
          <button className="forgot-password-link" onClick={onBack} style={{ fontSize: '1rem' }}>
            → Đăng nhập
          </button>
        </section>
      </main>
    );
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">QL</div>
        <h1>Đặt lại mật khẩu</h1>
        <p>Nhập mật khẩu mới của bạn.</p>
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          {!initialToken && (
            <label>
              Token đặt lại
              <input required value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
            </label>
          )}
          <label>
            Mật khẩu mới (≥8 ký tự, có chữ và số)
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={!!initialToken}
            />
          </label>
          <label>
            Xác nhận mật khẩu
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}</button>
        </form>
        <button className="forgot-password-link" onClick={onBack}>
          ← Quay lại đăng nhập
        </button>
      </section>
    </main>
  );
}
