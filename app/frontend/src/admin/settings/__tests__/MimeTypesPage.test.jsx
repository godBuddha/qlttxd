import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MimeTypesPage } from '../pages/MimeTypesPage.jsx';
import { AuthProvider } from '../../../lib/AuthContext.jsx';

const request = vi.fn();
vi.mock('../../../lib/api.js', () => ({
  request: (...a) => request(...a),
  can: (user, p) => Boolean(user?.permissions?.includes(p)),
  errorText: (e) => e?.message || 'Lỗi',
}));

function setup(user) {
  localStorage.setItem('qlttxd_user', JSON.stringify(user));
  return render(
    <AuthProvider>
      <MimeTypesPage />
    </AuthProvider>
  );
}

const editor = { permissions: ['config.view', 'config.edit.security'] };
const items = [
  { id: 7, mime_type: 'application/pdf', extension: '.pdf', is_active: true, magic_bytes_required: true },
];

describe('MimeTypesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty → cảnh báo đỏ hệ thống từ chối mọi tệp', async () => {
    request.mockResolvedValue({ data: [] });
    setup(editor);
    expect(
      await screen.findByText(
        'Không có loại tệp nào được phép — hệ thống sẽ từ chối mọi tệp tải lên.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('có dữ liệu → toggle gọi PUT đúng; nút Thêm bị vô hiệu kèm tooltip', async () => {
    request.mockImplementation((url, opts) => {
      if (!opts) return Promise.resolve({ data: items });
      return Promise.resolve({});
    });
    setup(editor);

    // Nút "Thêm" luôn disabled theo thiết kế
    const addBtn = await screen.findByRole('button', {
      name: 'Thêm loại tệp mới (hiện không khả dụng)',
    });
    expect(addBtn).toBeDisabled();
    expect(addBtn).toHaveAttribute(
      'title',
      'Loại tệp mới cần cập nhật bộ kiểm tra dữ liệu thật — liên hệ đội phát triển'
    );

    const box = screen.getByRole('checkbox', {
      name: 'Kích hoạt loại tệp application/pdf',
    });
    expect(box).toBeChecked();

    fireEvent.click(box); // optimistic → unchecked ngay
    expect(box).not.toBeChecked();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/v1/config/security/mime-types/7', {
        method: 'PUT',
        body: JSON.stringify({ is_active: false }),
      })
    );
    expect(await screen.findByText(/Đã tắt loại tệp application\/pdf/)).toBeInTheDocument();
  });
});
