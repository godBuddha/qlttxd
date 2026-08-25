import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportExportPage } from '../pages/ImportExportPage.jsx';
import { AuthProvider } from '../../../lib/AuthContext.jsx';

const request = vi.fn();
vi.mock('../../../lib/api.js', () => ({
  request: (...a) => request(...a),
  can: (user, p) => Boolean(user?.permissions?.includes(p)),
  errorText: (e) => e?.message || 'Lỗi',
  dateText: (v) => String(v ?? ''),
}));

function setup(user) {
  localStorage.setItem('qlttxd_user', JSON.stringify(user));
  return render(
    <AuthProvider>
      <ImportExportPage />
    </AuthProvider>
  );
}

const editor = { permissions: ['config.view', 'config.edit.general'] };

function uploadFile(input, obj) {
  const file = new File([JSON.stringify(obj)], 'cfg.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ImportExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // dryRun=true trả diff; dryRun=false trả kết quả nhập
    request.mockImplementation((url, opts) => {
      if (String(url).includes('dry_run=true')) {
        return Promise.resolve({
          data: {
            would_update: [{ category: 'auth', key: 'bcrypt_rounds', old_value: 10, new_value: 12 }],
            unchanged: [],
            invalid: [],
          },
        });
      }
      if (String(url).includes('dry_run=false')) {
        return Promise.resolve({ data: { imported: 1, skipped: 0, unchanged: 0 } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('dryRun=true xem trước diff và KHÔNG gọi dryRun=false cho tới khi người dùng xác nhận', async () => {
    setup(editor);
    uploadFile(
      screen.getByLabelText('Chọn tệp JSON cần nhập'),
      { items: [{ category: 'auth', key: 'bcrypt_rounds', value: 12 }] }
    );

    // Diff preview hiện ra sau dry_run=true
    expect(await screen.findByText('Xem trước (chưa ghi vào hệ thống)')).toBeInTheDocument();
    expect(screen.getByText('Sửa')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/api/v1/config/import?dry_run=true',
      expect.objectContaining({ method: 'POST' })
    );
    // Chưa ghi gì cả
    expect(
      request.mock.calls.filter(([u]) => String(u).includes('dry_run=false'))
    ).toHaveLength(0);
    // Nút xác nhận chưa tồn tại cho tới khi có diff — rồi bấm mới gọi dryRun=false
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận nhập' });
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/v1/config/import?dry_run=false',
        expect.objectContaining({ method: 'POST' })
      )
    );
    expect(await screen.findByText('Đã nhập cấu hình thành công.')).toBeInTheDocument();
    expect(request.mock.calls.filter(([u]) => String(u).includes('dry_run=false'))).toHaveLength(1);
  });

  it('file sai định dạng → báo lỗi và không gọi import', async () => {
    setup(editor);
    uploadFile(screen.getByLabelText('Chọn tệp JSON cần nhập'), { khong_phai_items: true });
    expect(await screen.findByText(/Không đọc được tệp/)).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
