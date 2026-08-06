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

  it('fallback sang polling (setInterval) khi SSE fail', async () => {
    vi.useFakeTimers();
    const api = stubApi();
    render(<BellNotification api={api} />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(FakeEventSource.instances.length).toBe(1);
    const es = FakeEventSource.instances[0];

    // SSE error -> EventSource closed, poll timer installed
    act(() => es.fail());
    expect(es.closed).toBe(true);

    // Advance 31s under fake timers; polling fallback should call unread-count again
    const callsBefore = unreadCalls(api);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000);
    });
    expect(unreadCalls(api)).toBeGreaterThan(callsBefore);
  });
});
