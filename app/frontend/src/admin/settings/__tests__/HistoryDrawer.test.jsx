import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryDrawer } from '../HistoryDrawer.jsx';

const api = vi.fn();

const FIELD = { key: 'auth.jwt_access_ttl', label: 'Tuổi token truy cập', type: 'duration' };

const HISTORY_ROWS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    category: 'auth',
    key: 'jwt_access_ttl',
    old_value: '15m',
    new_value: '5m',
    action: 'update',
    thoi_gian: '2026-08-20T10:00:00Z',
    username: 'admin',
    full_name: 'Nguyễn Quản Trị',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    category: 'auth',
    key: 'jwt_access_ttl',
    old_value: '5m',
    new_value: '15m',
    action: 'rollback',
    thoi_gian: '2026-08-19T09:00:00Z',
    username: 'admin',
    full_name: null,
  },
];

describe('HistoryDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockResolvedValue({ data: HISTORY_ROWS, total: 2 });
  });

  it('fetches per-key history and renders both entries', async () => {
    render(<HistoryDrawer field={FIELD} api={api} onClose={() => {}} />);
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      `/api/v1/config/history?category=auth&key=jwt_access_ttl&limit=50`
    ));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Tuổi token truy cập');
    // old → new pairs for both rows
    expect(dialog).toHaveTextContent('15m');
    expect(dialog).toHaveTextContent('5m');
    expect(screen.getAllByRole('button', { name: /Hoàn tác về bản này/ })).toHaveLength(2);
  });

  it('rollback button calls the rollback endpoint after confirmation', async () => {
    api.mockResolvedValue({ data: HISTORY_ROWS, total: 2 });
    const onRolledBack = vi.fn();
    render(
      <HistoryDrawer field={FIELD} api={api} onClose={() => {}} onRolledBack={onRolledBack} />
    );

    const rollbackButtons = await screen.findAllByRole('button', { name: /Hoàn tác về bản này/ });
    fireEvent.click(rollbackButtons[0]);

    // Confirmation step appears before the API call.
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(confirm.querySelector('button')); // "Xác nhận"

    await waitFor(() => expect(api).toHaveBeenCalledWith(
      '/api/v1/config/rollback/11111111-1111-4111-8111-111111111111',
      { method: 'POST' }
    ));
    await waitFor(() => expect(onRolledBack).toHaveBeenCalled());
  });

  it('shows an error notice when history cannot be loaded', async () => {
    api.mockRejectedValue(new Error('Thiếu tham số category và key'));
    render(<HistoryDrawer field={FIELD} api={api} onClose={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Thiếu tham số category và key');
  });

  it('Escape closes the drawer via Dialog focus trap', async () => {
    const onClose = vi.fn();
    render(<HistoryDrawer field={FIELD} api={api} onClose={onClose} />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
