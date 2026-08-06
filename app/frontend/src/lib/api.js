export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

let _refreshing = null;

async function doRefresh() {
  const rt = localStorage.getItem('qlttxd_refresh_token');
  if (!rt) throw new Error('No refresh token');
  const resp = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!resp.ok) throw new Error('Refresh failed');
  const data = await resp.json();
  localStorage.setItem('qlttxd_token', data.token);
  if (data.refreshToken) localStorage.setItem('qlttxd_refresh_token', data.refreshToken);
  if (data.user) localStorage.setItem('qlttxd_user', JSON.stringify(data.user));
  return data;
}

export async function request(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem('qlttxd_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('X-Auth-Token', token);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Không thể kết nối API. Kiểm tra máy chủ và VITE_API_BASE_URL.');
  }
  let body = {};
  try {
    body = await response.json();
  } catch {
    /* API may not return JSON */
  }
  if (response.status === 401) {
    try {
      if (!_refreshing) _refreshing = doRefresh();
      const refreshed = await _refreshing;
      _refreshing = null;
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('X-Auth-Token', refreshed.token);
      if (options.body && !(options.body instanceof FormData) && !retryHeaders.has('Content-Type'))
        retryHeaders.set('Content-Type', 'application/json');
      let retryResp;
      try {
        retryResp = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
      } catch {
        throw new Error('Không thể kết nối API.');
      }
      let retryBody = {};
      try {
        retryBody = await retryResp.json();
      } catch {}
      if (retryResp.status === 401) {
        onUnauthorized?.();
        throw new Error(retryBody.error || 'Phiên đăng nhập đã hết hạn.');
      }
      if (!retryResp.ok)
        throw new Error(retryBody.error || `Yêu cầu thất bại (${retryResp.status})`);
      return retryBody;
    } catch {
      _refreshing = null;
      onUnauthorized?.();
      throw new Error(body.error || 'Phiên đăng nhập đã hết hạn.');
    }
  }
  if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (${response.status})`);
  return body;
}

export const can = (user, permission) => Boolean(user?.permissions?.includes(permission));
export const errorText = (err) => err?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
export const dateText = (value) => (value ? new Date(value).toLocaleString('vi-VN') : '—');
export const money = (value) =>
  value == null ? 'Chưa xác định' : `${Number(value).toLocaleString('vi-VN')} đ`;

export async function downloadDocx(url, filename, notify) {
  try {
    const token = localStorage.getItem('qlttxd_token');
    const r = await fetch(url, { headers: { 'X-Auth-Token': token || '' } });
    if (!r.ok) {
      let msg = 'Xuất file thất bại';
      try {
        const j = await r.json();
        msg = j.error || msg;
      } catch {}
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
  } catch (e) {
    notify(errorText(e), 'error');
  }
}
