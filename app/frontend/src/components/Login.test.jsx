import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login.jsx';

vi.mock('../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, request: vi.fn() };
});

import { request } from '../lib/api.js';

beforeEach(() => {
  request.mockReset();
});

describe('Login', () => {
  it('render tiêu đề QLTTXD và form đăng nhập', () => {
    render(<Login onLogin={() => {}} notice={null} />);
    expect(screen.getByRole('heading', { name: 'QLTTXD' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
  });

  it('render notice khi được cung cấp', () => {
    render(<Login onLogin={() => {}} notice={{ type: 'info', text: 'Chào mừng' }} />);
    expect(screen.getByText('Chào mừng')).toBeInTheDocument();
  });

  it('submit form gọi request và gọi onLogin + lưu token', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    request.mockResolvedValue({
      token: 'tk-1',
      refreshToken: 'rt-1',
      user: { id: 1, username: 'admin' },
    });
    render(<Login onLogin={onLogin} notice={null} />);

    await user.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const [, opts] = request.mock.calls[0];
    const sent = JSON.parse(opts.body);
    expect(sent).toEqual({ username: 'admin', password: 'secret' });

    expect(onLogin).toHaveBeenCalledWith({ id: 1, username: 'admin' });
    expect(localStorage.getItem('qlttxd_token')).toBe('tk-1');
  });

  it('hiện thông báo lỗi khi đăng nhập thất bại', async () => {
    const user = userEvent.setup();
    request.mockRejectedValue(new Error('Sai tài khoản hoặc mật khẩu'));
    render(<Login onLogin={() => {}} notice={null} />);

    await user.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await user.type(screen.getByLabelText('Mật khẩu'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Sai tài khoản hoặc mật khẩu')).toBeInTheDocument();
  });

  it('hiện trạng thái đang đăng nhập trong lúc busy', async () => {
    const user = userEvent.setup();
    let resolveReq;
    request.mockReturnValue(
      new Promise((res) => {
        resolveReq = res;
      })
    );
    render(<Login onLogin={() => {}} notice={null} />);

    await user.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Đang đăng nhập…')).toBeInTheDocument();
    await act(async () => {
      resolveReq({ token: 'x', user: {} });
    });
  });
});
