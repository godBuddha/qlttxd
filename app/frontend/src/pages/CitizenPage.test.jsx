import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitizenPage } from './CitizenPage.jsx';

vi.mock('../components/MapView.jsx', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

function makeApi() {
  return vi.fn((path, opts) =>
    Promise.resolve({ data: opts && opts.method === 'POST' ? { id: 1, ma_bao_cao: 'BC-1' } : [] })
  );
}

const fillRequiredDesc = () => {
  fireEvent.change(screen.getByPlaceholderText('Mô tả công trình, hành vi và dấu hiệu vi phạm'), {
    target: { value: 'Xây dựng không phép' },
  });
};

describe('CitizenPage — non-pointer coordinate entry (A11Y-A5)', () => {
  it('render các input tọa độ và nút dùng vị trí hiện tại', () => {
    render(<CitizenPage api={makeApi()} notify={vi.fn()} />);
    expect(screen.getByLabelText('Vĩ độ (Lat)')).toBeInTheDocument();
    expect(screen.getByLabelText('Kinh độ (Lng)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dùng vị trí hiện tại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa tọa độ' })).toBeInTheDocument();
  });

  it('gửi báo cáo bằng tọa độ nhập text mà KHÔNG cần click map', async () => {
    const api = makeApi();
    const notify = vi.fn();
    render(<CitizenPage api={api} notify={notify} />);
    fireEvent.change(screen.getByLabelText('Vĩ độ (Lat)'), { target: { value: '21.0285' } });
    fireEvent.change(screen.getByLabelText('Kinh độ (Lng)'), { target: { value: '105.8542' } });
    fillRequiredDesc();

    await userEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/v1/bao-cao', expect.objectContaining({ method: 'POST' }))
    );
    const [, opts] = api.mock.calls.find(([p, o]) => p === '/api/v1/bao-cao' && o && o.method === 'POST');
    expect(opts.body.get('latitude')).toBe('21.0285');
    expect(opts.body.get('longitude')).toBe('105.8542');
    expect(notify).not.toHaveBeenCalled();
  });

  it('không gửi khi thiếu tọa độ dù các trường khác hợp lệ', async () => {
    const api = makeApi();
    const notify = vi.fn();
    render(<CitizenPage api={api} notify={notify} />);
    fillRequiredDesc();

    await userEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    expect(notify).toHaveBeenCalledWith(expect.stringContaining('tọa độ'), 'error');
    expect(
      api.mock.calls.filter(([p, o]) => p === '/api/v1/bao-cao' && o && o.method === 'POST')
    ).toHaveLength(0);
  });

  it('nút “Dùng vị trí hiện tại” điền tọa độ từ geolocation', async () => {
    const getPosition = vi.fn();
    const original = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getPosition },
      configurable: true,
    });
    getPosition.mockImplementation((success) =>
      success({ coords: { latitude: 21.00123, longitude: 105.87456 } })
    );
    render(<CitizenPage api={makeApi()} notify={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dùng vị trí hiện tại' }));

    expect(screen.getByLabelText('Vĩ độ (Lat)')).toHaveValue(21.00123);
    expect(screen.getByLabelText('Kinh độ (Lng)')).toHaveValue(105.87456);
    Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true });
  });
});