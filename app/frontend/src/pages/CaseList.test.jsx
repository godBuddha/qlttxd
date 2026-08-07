import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CaseList } from './CaseList.jsx';

vi.mock('../components/MapView.jsx', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

// api mock that records every path it is called with.
function makeApi() {
  const calls = [];
  const fn = vi.fn((path) => {
    calls.push(path);
    return Promise.resolve({ data: [] });
  });
  fn.hoSoCalls = () => calls.filter((p) => p.startsWith('/api/v1/ho-so'));
  return fn;
}

const PLACEHOLDER = 'Mã hồ sơ, mô tả, địa chỉ, loại vi phạm';

describe('CaseList — search debounce (M-03, 400ms)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gõ liên tục chỉ gọi API 1 lần sau 400ms (không gọi trên từng keystroke)', async () => {
    const api = makeApi();
    render(<CaseList api={api} navigate={vi.fn()} notify={vi.fn()} />);

    // Gõ 3 ký tự liên tục trong vòng < 400ms (mỗi lần reset debounce timer).
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    // Trước khi qua 400ms: chỉ có 1 call khởi tạo ban đầu, KHÔNG có call nào
    // phát sinh cho từng ký tự.
    expect(api.hoSoCalls().length).toBe(1);

    // Qua đúng 400ms → debounce fire, chỉ 1 call cho query cuối cùng.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const hoSoCalls = api.hoSoCalls();
    expect(hoSoCalls.length).toBe(2); // 1 khởi tạo + 1 debounced
    expect(hoSoCalls[1]).toContain('q=abc'); // dùng query cuối
  });

  it('dừng gõ rồi gõ tiếp trong <400ms vẫn chỉ gọi 1 lần với query cuối', async () => {
    const api = makeApi();
    render(<CaseList api={api} navigate={vi.fn()} notify={vi.fn()} />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: 'hà nội' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200); // chưa tới 400ms
    });
    fireEvent.change(input, { target: { value: 'hà nội 2' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const hoSoCalls = api.hoSoCalls();
    expect(hoSoCalls.length).toBe(2); // 1 khởi tạo + 1 debounced
    // URLSearchParams encodes space as '+'
    expect(hoSoCalls[1]).toContain('q=h%C3%A0+n%E1%BB%99i+2');
  });
});
