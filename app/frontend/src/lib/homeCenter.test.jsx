import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider, useConfig } from './ConfigContext.jsx';
import { HOME } from './constants.js';

vi.mock('./api.js', () => ({
  request: vi.fn(),
  API_BASE: '',
  errorText: (e) => String(e?.message || e),
}));

import { request } from './api.js';

/** Probe component: ghi output của selector vào DOM để assert. */
function HomeCenterProbe({ onValue }) {
  const { homeCenter, loading } = useConfig();
  onValue(homeCenter(), loading);
  return <div data-testid="probe">probe</div>;
}

function renderHomeCenter(onValue) {
  return render(
    <ConfigProvider>
      <HomeCenterProbe onValue={onValue} />
    </ConfigProvider>
  );
}

describe('HC-02: ConfigContext.homeCenter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('config có ui.home_lat=10.5, ui.home_lng=106.7 → trả [10.5, 106.7]', async () => {
    request.mockImplementation((url) => {
      if (String(url).includes('/api/v1/config')) {
        const cat = decodeURIComponent(String(url).split('category=')[1] || '');
        if (cat === 'ui') {
          return Promise.resolve([
            { key: 'home_lat', value: 10.5 },
            { key: 'home_lng', value: 106.7 },
          ]);
        }
      }
      return Promise.resolve([]);
    });

    let latest;
    renderHomeCenter((v) => {
      latest = v;
    });
    await vi.waitFor(() => {
      expect(latest).toEqual([10.5, 106.7]);
    });
  });

  it('config chưa load → fallback [21.0285, 105.8542] (HOME)', async () => {
    // request trả về giá trị không phải mảng → rawConfigs rỗng → getConfig undefined
    request.mockResolvedValue(null);

    let latest;
    renderHomeCenter((v) => {
      latest = v;
    });
    await vi.waitFor(() => {
      expect(latest).toEqual([21.0285, 105.8542]);
    });
    expect(latest).toEqual(HOME);
  });

  it('giá trị NaN/không hợp lệ → fallback HOME', async () => {
    request.mockImplementation((url) => {
      const cat = decodeURIComponent(String(url).split('category=')[1] || '');
      if (cat === 'ui') {
        return Promise.resolve([
          { key: 'home_lat', value: 'abc' },
          { key: 'home_lng', value: null },
        ]);
      }
      return Promise.resolve([]);
    });

    let latest;
    renderHomeCenter((v) => {
      latest = v;
    });
    await vi.waitFor(() => {
      expect(latest).toEqual([21.0285, 105.8542]);
    });
  });
});
