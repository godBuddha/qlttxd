import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BellNotification } from '../components/BellNotification.jsx';

function stubApi() {
  return vi.fn((path) => {
    if (path === '/api/v1/thong-bao/unread-count') {
      return Promise.resolve({ count: 0 });
    }
    if (path === '/api/v1/thong-bao?limit=15') {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({});
  });
}

class FakeEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  fail() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

const unreadCalls = (api) =>
  api.mock.calls.filter(([p]) => p === '/api/v1/thong-bao/unread-count').length;

describe('BellNotification', () => {
  beforeEach(() => {
    localStorage.setItem('qlttxd_token', 'tok-1');
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.instances = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('mở EventSource SSE tới /thong-bao/stream với token', async () => {
    const api = stubApi();
    render(<BellNotification api={api} />);
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    const es = FakeEventSource.instances[0];
    expect(es.url).toContain('/api/v1/thong-bao/stream');
    expect(es.url).toContain('token=tok-1');
  });

  it('tăng badge count khi nhận real-time notification qua SSE', async () => {
    const api = stubApi();
    render(<BellNotification api={api} />);
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emit({
        id: 'n1',
        tieu_de: 'SSE hồ sơ mới',
        noi_dung: 'Có hồ sơ mới',
        trang_thai: 'da_gui',
        created_at: '2026-08-06T08:00:00.000Z',
      });
    });
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('reconnect 3 lần với backoff rồi fallback sang polling khi SSE hỏng', async () => {
    vi.useFakeTimers();
    const api = stubApi();
    render(<BellNotification api={api} />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(FakeEventSource.instances.length).toBe(1);

    // Lần fail 1 và 2 → đóng EventSource hiện tại và reconnect theo backoff (1s, 2s)
    for (let i = 0; i < 2; i++) {
      const es = FakeEventSource.instances[i];
      await act(async () => {
        es.fail();
        // chạy reconnect timeout → tạo instance EventSource mới
        await vi.runOnlyPendingTimersAsync();
      });
      expect(es.closed).toBe(true);
    }

    // Lần fail 3 → mới fallback sang polling
    const es3 = FakeEventSource.instances[2];
    act(() => es3.fail());
    expect(es3.closed).toBe(true);
    // Đã thử 3 kết nối; không reconnect thêm mà chuyển polling
    expect(FakeEventSource.instances.length).toBeLessThanOrEqual(3);

    // Advance 31s: polling fallback (30s interval) phải gọi unread-count lần nữa
    const callsBefore = unreadCalls(api);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000);
    });
    expect(unreadCalls(api)).toBeGreaterThan(callsBefore);
  });
});
