import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request, can, errorText, dateText, money } from './api.js';

function jsonResponse(status, data = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return data;
    },
  };
}

describe('request()', () => {
  beforeEach(() => {
    localStorage.setItem('qlttxd_token', 'tok-1');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(impl) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }

  it('gửi X-Auth-Token từ localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/v1/health');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/health');
    expect(opts.headers.get('X-Auth-Token')).toBe('tok-1');
  });

  it('thêm Content-Type json khi có JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/v1/cases', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
  });

  it('không set Content-Type cho FormData', async () => {
    const fd = new FormData();
    fd.append('a', 'b');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/v1/upload', { method: 'POST', body: fd });
    expect(fetchMock.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  });

  it('trả về body khi response OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { id: 7, name: 'x' })));
    const data = await request('/api/v1/cases');
    expect(data).toEqual({ id: 7, name: 'x' });
  });

  it('throw error từ server khi status không OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: 'Lỗi máy chủ' })));
    await expect(request('/api/v1/cases')).rejects.toThrow('Lỗi máy chủ');
  });

  it('throw thông báo mất kết nối khi fetch reject', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/api/v1/cases')).rejects.toThrow('Không thể kết nối API');
  });

  it('401 → thử refresh; nếu refresh fail gọi onUnauthorized và throw hết hạn', async () => {
    const onUnauth = vi.fn();
    stubFetch((url) => {
      if (String(url).includes('/auth/refresh')) return Promise.resolve(jsonResponse(401, {}));
      return Promise.resolve(jsonResponse(401, {}));
    });
    await expect(request('/api/v1/cases', {}, onUnauth)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn'
    );
    expect(onUnauth).toHaveBeenCalled();
  });

  it('401 → refresh thành công và retry trả body', async () => {
    localStorage.setItem('qlttxd_refresh_token', 'rt-1');
    let first = true;
    stubFetch((url) => {
      if (String(url).includes('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { token: 'tok-2', refreshToken: 'rt-2' }));
      }
      if (first) {
        first = false;
        return Promise.resolve(jsonResponse(401, {}));
      }
      return Promise.resolve(jsonResponse(200, { done: true }));
    });
    const data = await request('/api/v1/cases');
    expect(data).toEqual({ done: true });
    expect(localStorage.getItem('qlttxd_token')).toBe('tok-2');
  });

  it('10 request 401 đồng thời → chỉ refresh 1 lần, tất cả retry với token mới', async () => {
    let refreshCalls = 0;
    let reqCount = 0;
    stubFetch((url) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, { token: 'tok-new' }));
      }
      reqCount += 1;
      if (reqCount <= 10) return Promise.resolve(jsonResponse(401, {}));
      return Promise.resolve(jsonResponse(200, { done: true }));
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request('/api/v1/cases'))
    );
    expect(refreshCalls).toBe(1); // chỉ 1 lần gọi /auth/refresh
    expect(reqCount).toBe(20); // 10 lần đầu 401 + 10 lần retry
    expect(results.every((r) => r.done === true)).toBe(true);
    expect(localStorage.getItem('qlttxd_token')).toBe('tok-new');
  });

  it('nếu refresh fail → tất cả request fail và gọi onUnauthorized', async () => {
    const onUnauth = vi.fn();
    stubFetch((url) => {
      if (String(url).includes('/auth/refresh')) return Promise.resolve(jsonResponse(401, {}));
      return Promise.resolve(jsonResponse(401, {}));
    });
    await expect(
      Promise.all(Array.from({ length: 5 }, () => request('/api/v1/cases', {}, onUnauth)))
    ).rejects.toThrow('Phiên đăng nhập đã hết hạn');
    expect(onUnauth).toHaveBeenCalledTimes(5);
  });
});

describe('can()', () => {
  it('true khi user có permission', () => {
    expect(can({ permissions: ['view_cases', 'edit'] }, 'view_cases')).toBe(true);
  });
  it('false khi user thiếu permission', () => {
    expect(can({ permissions: ['view_cases'] }, 'admin')).toBe(false);
  });
  it('false khi user null / permissions rỗng', () => {
    expect(can(null, 'view_cases')).toBe(false);
    expect(can({}, 'view_cases')).toBe(false);
  });
});

describe('errorText()', () => {
  it('lấy err.message nếu có', () => {
    expect(errorText(new Error('Sai mật khẩu'))).toBe('Sai mật khẩu');
  });
  it('trả về fallback khi không có message', () => {
    expect(errorText(undefined)).toBe('Không thể kết nối máy chủ. Vui lòng thử lại.');
    expect(errorText({})).toBe('Không thể kết nối máy chủ. Vui lòng thử lại.');
  });
});

describe('dateText()', () => {
  it('định dạng ngày hợp lệ theo locale vi-VN', () => {
    const d = new Date(2026, 0, 15, 12, 30);
    const out = dateText(d);
    expect(out.includes('2026')).toBe(true);
    expect(out).not.toBe('—');
  });
  it('trả về — khi giá trị rỗng', () => {
    expect(dateText(null)).toBe('—');
    expect(dateText(undefined)).toBe('—');
  });
});

describe('money()', () => {
  it('format số tiền kiểu vi-VN kèm đ', () => {
    expect(money(1000000)).toBe('1.000.000 đ');
  });
  it('trả về Chưa xác định khi giá trị null/undefined', () => {
    expect(money(null)).toBe('Chưa xác định');
    expect(money(undefined)).toBe('Chưa xác định');
  });
});
