import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowStatesPage } from '../pages/WorkflowStatesPage.jsx';
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

const editor = { permissions: ['config.view', 'config.edit.workflow'] };
const viewer = { permissions: ['config.view'] };

const states = [
  { id: 'u1', code: 'cho_tiep_nhan', label: 'Chờ tiếp nhận', is_terminal: false, sort_order: 1 },
  { id: 'u2', code: 'da_dong', label: 'Đã đóng', is_terminal: true, sort_order: 13 },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WorkflowStatesPage — view-only (không có quyền)', () => {
  it('hiển thị label dạng strong và "(chỉ xem)"', async () => {
    request.mockResolvedValue({ data: states });
    setup(<WorkflowStatesPage />, viewer);
    expect(await screen.findByText(/chỉ xem/)).toBeInTheDocument();
    expect(screen.getByText('Chờ tiếp nhận')).toBeInTheDocument();
    // không có nút sửa
    expect(screen.queryByRole('button', { name: /Sửa tên hiển thị/ })).not.toBeInTheDocument();
  });
});

describe('WorkflowStatesPage — sửa inline (có quyền config.edit.workflow)', () => {
  it('nhấp label → form inline → Lưu gọi PUT đúng endpoint + body', async () => {
    request.mockImplementation((url, opts) => {
      if (!opts) return Promise.resolve({ data: states });
      return Promise.resolve({
        data: { ...states[0], label: 'Chờ tiếp nhận mới' },
      });
    });
    setup(<WorkflowStatesPage />, editor);

    const btn = await screen.findByRole('button', { name: 'Sửa tên hiển thị của Chờ tiếp nhận' });
    fireEvent.click(btn);

    const input = await screen.findByRole('textbox', { name: 'Tên hiển thị mới cho cho_tiep_nhan' });
    fireEvent.change(input, { target: { value: 'Chờ tiếp nhận mới' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/v1/config/workflow/states/cho_tiep_nhan', {
        method: 'PUT',
        body: JSON.stringify({ ten_hien_thi: 'Chờ tiếp nhận mới' }),
      })
    );
    expect(await screen.findByText(/Đã đổi tên hiển thị của cho_tiep_nhan/)).toBeInTheDocument();
  });

  it('PUT lỗi → rollback về label cũ + hiện lỗi', async () => {
    request.mockImplementation((url, opts) => {
      if (!opts) return Promise.resolve({ data: states });
      return Promise.reject(new Error('Lưu thất bại'));
    });
    setup(<WorkflowStatesPage />, editor);

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa tên hiển thị của Chờ tiếp nhận' }));
    const input = await screen.findByRole('textbox', { name: 'Tên hiển thị mới cho cho_tiep_nhan' });
    fireEvent.change(input, { target: { value: 'Sai' } });
    fireEvent.submit(input.closest('form'));

    expect(await screen.findByText('Lưu thất bại')).toBeInTheDocument();
    // rollback: label cũ hiển thị lại dưới dạng nút sửa
    expect(await screen.findByRole('button', { name: 'Sửa tên hiển thị của Chờ tiếp nhận' })).toBeInTheDocument();
  });

  it('rỗng → nút Lưu bị vô hiệu', async () => {
    request.mockResolvedValue({ data: states });
    setup(<WorkflowStatesPage />, editor);

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa tên hiển thị của Chờ tiếp nhận' }));
    const input = await screen.findByRole('textbox', { name: 'Tên hiển thị mới cho cho_tiep_nhan' });
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
  });
});
