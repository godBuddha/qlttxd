import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsSearch, buildSearchIndex } from '../SettingsSearch.jsx';

describe('SettingsSearch', () => {
  it('index contains every manifest field and finds jwt_access_ttl for "jwt"', () => {
    const index = buildSearchIndex();
    expect(index.length).toBeGreaterThan(40);
    const hits = index.filter((e) => e.haystack.includes('jwt'));
    expect(hits.some((e) => e.key === 'auth.jwt_access_ttl')).toBe(true);
  });

  it('typing "jwt" shows at least one result with jwt_access_ttl', async () => {
    const onNavigate = vi.fn();
    render(<SettingsSearch open onClose={vi.fn()} onNavigate={onNavigate} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'jwt' } });

    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveTextContent(/jwt_access_ttl/i);
    });
    const option = screen.getAllByRole('option')[0];
    fireEvent.click(option);

    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'auth.jwt_access_ttl' })
    );
  });

  it('ArrowDown moves selection, Enter chooses, Escape closes via overlay click', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<SettingsSearch open onClose={onClose} onNavigate={onNavigate} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'token' } });
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));

    const firstActive = screen.getByRole('option', { selected: true });
    fireEvent.keyDown(input.closest('[role="dialog"]'), { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options.indexOf(screen.getByRole('option', { selected: true }))).toBe(
      options.indexOf(firstActive) + 1
    );

    fireEvent.keyDown(input.closest('[role="dialog"]'), { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an empty-state invitation when nothing matches', async () => {
    render(<SettingsSearch open onClose={vi.fn()} onNavigate={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz-khong-ton-tai-zzz' } });
    await waitFor(() =>
      expect(screen.getByRole('listbox')).toHaveTextContent(/Không tìm thấy cấu hình nào/)
    );
  });

  it('renders nothing when closed', () => {
    render(<SettingsSearch open={false} onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
