import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RolePermissionsPage } from '../pages/RolePermissionsPage.jsx';
import { AuthProvider } from '../../../lib/AuthContext.jsx';

const request = vi.fn();
vi.mock('../../../lib/api.js', () => ({
  request: (...a) => request(...a),
  can: (user, p) => Boolean(user?.permissions?.includes(p)),
  errorText: (e) => e?.message || 'Lỗi',
}));

const matrixResp = {
  data: { admin: { moi: true, dang_xu_ly: false } },
  roles: [{ code: 'admin', name: 'Quản trị viên' }],
  states: [
    { code: 'moi', label: 'Mới' },
    { code: 'dang_xu_ly', label: 'Đang xử lý' },
  ],
};

function setup(user) {
  localStorage.setItem('qlttxd_user', JSON.stringify(user));
  return render(
    <AuthProvider>
      <RolePermissionsPage />
    </AuthProvider>
  );
}

const editor = { permissions: ['config.view', 'config.edit.workflow'] };

describe('RolePermissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue(matrixResp);
  });

  it('render ma trận vai trò × trạng thái đúng trạng thái ban đầu', async () => {
    setup(editor);
    const on = await screen.findByRole('checkbox', {
      name: 'admin được thao tác ở trạng thái moi',
    });
    expect(on).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'admin được thao tác ở trạng thái dang_xu_ly' })
    ).not.toBeChecked();
  });

  it('toggle checkbox → PUT payload đúng; lỗi thì rollback', async () => {
    setup(editor);
    const box = await screen.findByRole('checkbox', {
      name: 'admin được thao tác ở trạng thái dang_xu_ly',
    });
    // Optimistic update ngay khi click
    fireEvent.click(box);
    expect(box).toBeChecked();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/v1/config/workflow/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({
          assignments: [{ role_id: 'admin', state_code: 'dang_xu_ly', allowed: true }],
        }),
      })
    );
    expect(
      await screen.findByText(/Đã cấp quyền cho vai trò "admin"/)
    ).toBeInTheDocument();

    // Lỗi → rollback về false
    request.mockRejectedValueOnce(new Error('Lỗi mạng'));
    fireEvent.click(box); // bỏ chọn lại (đang checked)
    await waitFor(() => expect(box).not.toBeChecked());
    expect(await screen.findByText('Lỗi mạng')).toBeInTheDocument();
  });
});
