import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MimeTypesPage } from '../pages/MimeTypesPage.jsx';
import { WorkflowTransitionsPage } from '../pages/WorkflowTransitionsPage.jsx';
import { AuthProvider } from '../../../lib/AuthContext.jsx';

const request = vi.fn();
vi.mock('../../../lib/api.js', () => ({
  request: (...a) => request(...a),
  can: (user, p) => Boolean(user?.permissions?.includes(p)),
  errorText: (e) => e?.message || 'Lỗi',
}));

function setup(ui, user) {
  localStorage.setItem('qlttxd_user', JSON.stringify(user));
  return render(<AuthProvider>{ui}</AuthProvider>);
}

const editor = {
  permissions: ['config.view', 'config.edit.security', 'config.edit.workflow'],
};

describe('customPages — MimeTypesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('empty → cảnh báo đỏ hệ thống từ chối mọi tệp tải lên', async () => {
    request.mockResolvedValue({ data: [] });
    setup(<MimeTypesPage />, editor);
    expect(
      await screen.findByText(
        'Không có loại tệp nào được phép — hệ thống sẽ từ chối mọi tệp tải lên.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('có dữ liệu → toggle gọi PUT đúng endpoint với is_active mới', async () => {
    request.mockImplementation((url, opts) => {
      if (!opts) return Promise.resolve({
        data: [
          { id: 7, mime_type: 'application/pdf', extension: '.pdf', is_active: true, magic_bytes_required: true },
        ],
      });
      return Promise.resolve({});
    });
    setup(<MimeTypesPage />, editor);

    const box = await screen.findByRole('checkbox', {
      name: 'Kích hoạt loại tệp application/pdf',
    });
    expect(box).toBeChecked();

    fireEvent.click(box); // optimistic update
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

describe('customPages — WorkflowTransitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('render ma trận chuyển trạng thái (hàng = from, cột = to)', async () => {
    request.mockImplementation((url) => {
      if (url.includes('/transitions')) {
        return Promise.resolve({
          data: [
            { id: 1, from_state: 'draft', to_state: 'reviewing', label: 'Gửi duyệt', sort_order: 1 },
            { id: 2, from_state: 'reviewing', to_state: 'approved', label: null, sort_order: 2 },
          ],
        });
      }
      return Promise.resolve({
        data: [
          { code: 'draft' },
          { code: 'reviewing' },
          { code: 'approved', is_terminal: true },
        ],
      });
    });
    setup(<WorkflowTransitionsPage />, editor);

    expect(await screen.findByRole('table')).toBeInTheDocument();

    // Hàng nguồn draft + cột đích reviewing/approved
    expect(screen.getByRole('rowheader', { name: 'draft' })).toBeInTheDocument();
    expect(screen.getAllByText('reviewing').length).toBeGreaterThan(0); // cột + hàng
    expect(screen.getAllByText('approved').length).toBeGreaterThan(0);

    // Ô hợp lệ bật/tắt + ô không khả dụng disabled
    expect(screen.getByRole('button', { name: 'draft → reviewing: đang bật, nhấp để đổi' })).toBeInTheDocument();
    const unavailable = screen.getByRole('button', { name: 'draft → approved: không khả dụng' });
    expect(unavailable).toBeDisabled();
  });
});
