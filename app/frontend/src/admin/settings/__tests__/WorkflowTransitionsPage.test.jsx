import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowTransitionsPage } from '../pages/WorkflowTransitionsPage.jsx';
import { AuthProvider } from '../../../lib/AuthContext.jsx';

// Mock tầng API — trang gọi request() trực tiếp.
const request = vi.fn();
vi.mock('../../../lib/api.js', () => ({
  request: (...a) => request(...a),
  can: (user, p) => Boolean(user?.permissions?.includes(p)),
  errorText: (e) => e?.message || 'Lỗi',
}));

const transitions = [
  { id: 1, from_state: 'moi', to_state: 'dang_xu_ly', sort_order: -1, label: '' },
  { id: 2, from_state: 'dang_xu_ly', to_state: 'hoan_thanh', sort_order: 1, label: '' },
];
const states = [
  { code: 'moi', label: 'Mới', is_terminal: false },
  { code: 'dang_xu_ly', label: 'Đang xử lý', is_terminal: false },
  { code: 'hoan_thanh', label: 'Hoàn thành', is_terminal: true },
];

function mockApi() {
  request.mockImplementation((url, opts) => {
    if (String(url).includes('/workflow/transitions') && !opts) {
      return Promise.resolve({ data: transitions });
    }
    if (String(url).includes('/workflow/states')) {
      return Promise.resolve({ data: states });
    }
    return Promise.resolve({});
  });
}

function setup(user) {
  localStorage.setItem('qlttxd_user', JSON.stringify(user));
  return render(
    <AuthProvider>
      <WorkflowTransitionsPage />
    </AuthProvider>
  );
}

const editor = { permissions: ['config.view', 'config.edit.workflow'] };

describe('WorkflowTransitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('render đúng ô bật/tắt từ API và hàng terminal tô xám', async () => {
    setup(editor);
    // Ô hợp lệ đang bật (sort_order >= 0)
    const onCell = await screen.findByRole('button', {
      name: 'dang_xu_ly → hoan_thanh: đang bật, nhấp để đổi',
    });
    expect(onCell).toHaveAttribute('aria-pressed', 'true');
    // Ô hợp lệ đang tắt
    expect(
      screen.getByRole('button', { name: 'moi → dang_xu_ly: đang tắt, nhấp để đổi' })
    ).toHaveAttribute('aria-pressed', 'false');
    // Ô không tồn tại bị vô hiệu
    expect(
      screen.getByRole('button', { name: 'moi → hoan_thanh: không khả dụng' })
    ).toBeDisabled();
    // Hàng terminal có class tô xám
    const terminalRow = screen.getByRole('button', {
      name: 'hoan_thanh → moi: không khả dụng',
    }).closest('tr');
    expect(terminalRow).toHaveClass('wf-row-terminal');
  });

  it('click ô → hộp xác nhận hiện cảnh báo → Xác nhận gọi PUT', async () => {
    setup(editor);
    const cell = await screen.findByRole('button', {
      name: 'dang_xu_ly → hoan_thanh: đang bật, nhấp để đổi',
    });
    fireEvent.click(cell);
    // Hộp xác nhận với cảnh báo bắt buộc
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Đổi này ảnh hưởng hồ sơ đang mở'
    );
    // Chưa PUT trước khi xác nhận
    expect(request).not.toHaveBeenCalledWith(
      expect.stringContaining('/transitions/'),
      expect.objectContaining({ method: 'PUT' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/v1/config/workflow/transitions/2', {
        method: 'PUT',
        body: JSON.stringify({ sort_order: -1 }),
      })
    );
  });
});
