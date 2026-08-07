export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Helper to read CSRF cookie
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)qlttxd_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Singleton promise so concurrent 401s share a single refresh instead of each
// calling doRefresh() and racing on the old token.
let _refreshPromise = null;

async function doRefresh() {
  // Refresh token is now in HttpOnly cookie, no need to read from localStorage
  const resp = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Include cookies
  });
  if (!resp.ok) throw new Error('Refresh failed');
  const data = await resp.json();
  localStorage.setItem('qlttxd_token', data.token);
  if (data.user) localStorage.setItem('qlttxd_user', JSON.stringify(data.user));
  return data;
}

function buildHeaders(options, token) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('X-Auth-Token', token);
  // Add CSRF token for state-changing requests (POST, PATCH, PUT, DELETE)
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  return headers;
}

async function execute(path, options, token) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(options, token),
      credentials: 'include',
    });
  } catch {
    throw new Error('Không thể kết nối API. Kiểm tra máy chủ và VITE_API_BASE_URL.');
  }
  let body = {};
  try {
    body = await response.json();
  } catch {
    /* API may not return JSON */
  }
  return { response, body };
}

export async function request(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem('qlttxd_token');
  let { response, body } = await execute(path, options, token);

  if (response.status === 401) {
    // Get the fresh token from a single shared refresh. If a refresh is already
    // in flight, await it instead of starting a second one.
    let refreshed;
    try {
      if (!_refreshPromise) _refreshPromise = doRefresh();
      refreshed = await _refreshPromise;
    } catch {
      _refreshPromise = null;
      onUnauthorized?.();
      throw new Error(body.error || 'Phiên đăng nhập đã hết hạn.');
    }
    _refreshPromise = null;

    // Retry with the new token — never the stale one.
    const retry = await execute(path, options, refreshed.token);
    if (retry.response.status === 401) {
      onUnauthorized?.();
      throw new Error(retry.body.error || 'Phiên đăng nhập đã hết hạn.');
    }
    if (!retry.response.ok)
      throw new Error(retry.body.error || `Yêu cầu thất bại (${retry.response.status})`);
    return retry.body;
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
    const r = await fetch(url, { headers: { 'X-Auth-Token': token || '' }, credentials: 'include' });
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
