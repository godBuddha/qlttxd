import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratedForm } from '../GeneratedForm.jsx';
import auth from '../../settings-manifests/auth.json';

// Mock the API layer — GeneratedForm receives `api` prop directly.
const api = vi.fn();

// Admin user with the auth edit permission → save button visible.
const adminUser = { permissions: ['config.view', 'config.edit.auth'] };

function mockConfigRows() {
  api.mockImplementation((url) => {
    if (String(url).includes('/api/v1/config?category=auth')) {
      return Promise.resolve([
        { key: 'jwt_access_ttl', value: '5m' },
        { key: 'jwt_refresh_ttl', value: '7d' },
        { key: 'sse_token_ttl', value: '60s' },
        { key: 'bcrypt_rounds', value: 10 },
        { key: 'reset_token_expiry_ms', value: 900000 },
      ]);
    }
    if (String(url).includes('/api/v1/config?category=cookie')) {
      return Promise.resolve([
        { key: 'max_age_ms', value: 604800000 },
        { key: 'same_site', value: 'lax' },
      ]);
    }
    return Promise.resolve([]);
  });
}

describe('GeneratedForm (auth manifest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigRows();
  });

  it('renders one control per manifest field with labels', async () => {
    render(<GeneratedForm manifest={auth} api={api} user={adminUser} />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2)); // auth + cookie
    for (const field of auth.fields) {
      expect(screen.getByText(field.label)).toBeInTheDocument();
    }
    // Duration input for jwt_access_ttl carries the DB value.
    const ttlInput = await screen.findByLabelText(/Tuổi token truy cập/);
    expect(ttlInput).toHaveValue(5);
  });

  it('enables Lưu thay đổi only after an edit and PUTs the right bulk payload', async () => {
    api.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // initial load
    api.mockResolvedValueOnce({ updated: 1 }); // bulk PUT
    api.mockResolvedValue([]); // reload after save

    render(<GeneratedForm manifest={auth} api={api} user={adminUser} />);
    const saveBtn = await screen.findByRole('button', { name: 'Lưu thay đổi' });
    expect(saveBtn).toBeDisabled();

    // Change bcrypt_rounds 10 -> 12
    const rounds = screen.getByLabelText(/Số vòng bcrypt/);
    fireEvent.change(rounds, { target: { value: '12' } });
    expect(saveBtn).toBeEnabled();

    fireEvent.click(saveBtn);
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      '/api/v1/config/bulk',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          items: [{ category: 'auth', key: 'bcrypt_rounds', value: 12 }],
        }),
      })
    ));
  });

  it('shows a red error and keeps data when the API rejects the save', async () => {
    api.mockResolvedValue([]);
    render(<GeneratedForm manifest={auth} api={api} user={adminUser} />);
    const saveBtn = await screen.findByRole('button', { name: 'Lưu thay đổi' });

    const rounds = screen.getByLabelText(/Số vòng bcrypt/);
    fireEvent.change(rounds, { target: { value: '13' } });
    api.mockRejectedValueOnce(new Error('Bạn không có quyền cập nhật danh mục auth'));
    fireEvent.click(saveBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bạn không có quyền cập nhật danh mục auth');
    // Draft is kept: the input still shows the attempted value.
    expect(rounds).toHaveValue(13);
  });

  it('Escape reverts unsaved changes back to loaded values', async () => {
    render(<GeneratedForm manifest={auth} api={api} user={adminUser} />);
    const saveBtn = await screen.findByRole('button', { name: 'Lưu thay đổi' });
    const rounds = await screen.findByLabelText(/Số vòng bcrypt/);
    expect(rounds).toHaveValue(10); // loaded from DB

    fireEvent.change(rounds, { target: { value: '14' } });
    expect(saveBtn).toBeEnabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(saveBtn).toBeDisabled());
    expect(rounds).toHaveValue(10);
  });
});
