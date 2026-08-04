export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function request(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem('qlttxd_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('X-Auth-Token', token);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new Error('Không thể kết nối API. Kiểm tra máy chủ và VITE_API_BASE_URL.'); }
  let body = {};
  try { body = await response.json(); } catch { /* API may not return JSON */ }
  if (response.status === 401) { onUnauthorized?.(); throw new Error(body.error || 'Phiên đăng nhập đã hết hạn.'); }
  if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (${response.status})`);
  return body;
}

export const can = (user, permission) => Boolean(user?.permissions?.includes(permission));
export const errorText = (err) => err?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
export const dateText = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';
export const money = (value) => value == null ? 'Chưa xác định' : `${Number(value).toLocaleString('vi-VN')} đ`;

export async function downloadDocx(url, filename, notify) {
  try {
    const token = localStorage.getItem('qlttxd_token');
    const r = await fetch(url, { headers: { 'X-Auth-Token': token || '' } });
    if (!r.ok) {
      let msg = 'Xuất file thất bại';
      try { const j = await r.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    notify('Đã tải file Word.', 'success');
  } catch (e) { notify(errorText(e), 'error'); }
}
