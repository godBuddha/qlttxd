import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './Dialog.jsx';

function Harness({ onKeyDown, label, labelledBy, initialFocusRef }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>mở dialog</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        labelledBy={labelledBy}
        onKeyDown={onKeyDown}
        initialFocusRef={initialFocusRef}
      >
        <h2 id="dlg-title">Tiêu đề thì nghiệm</h2>
        <button>Nút đầu</button>
        <a href="#x">Liên kết</a>
        <button>Nút cuối</button>
      </Dialog>
    </>
  );
}

describe('Dialog (A11Y-A1)', () => {
  it('renders role=dialog + aria-modal + accessible name', async () => {
    render(<Harness labelledBy="dlg-title" />);
    const btn = screen.getByText('mở dialog');
    fireEvent.click(btn);
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveAttribute('aria-labelledby', 'dlg-title');
  });

  it('moves focus into the dialog on open', async () => {
    render(<Harness />);
    const btn = screen.getByText('mở dialog');
    fireEvent.click(btn);
    // first focusable child (<a href> is filtered before buttons in query order? use buttons)
    await screen.findByRole('dialog');
    const first = screen.getAllByRole('button').find((b) => b.textContent === 'Nút đầu');
    expect(document.activeElement).toBe(first);
  });

  it('Escape closes and restores focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByText('mở dialog');
    // simulate a keyboard user: focus the trigger, then activate it
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    const first = screen.getAllByRole('button').find((b) => b.textContent === 'Nút đầu');
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab: Shift+Tab from first wraps to last, Tab from last wraps to first', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('mở dialog'));
    await screen.findByRole('dialog');
    const buttons = screen.getAllByRole('button').filter((b) => /Nút/.test(b.textContent));
    const firstBtn = buttons[0];
    const lastBtn = buttons[buttons.length - 1];
    // Shift+Tab on the first: wrap to last
    firstBtn.focus();
    fireEvent.keyDown(firstBtn, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
    // Tab on the last: wrap to first
    fireEvent.keyDown(lastBtn, { key: 'Tab' });
    expect(document.activeElement).toBe(firstBtn);
  });

  it('forwards onKeyDown before default handling (e.g. arrows)', async () => {
    const handler = vi.fn((e) => e.preventDefault());
    render(<Harness onKeyDown={handler} />);
    fireEvent.click(screen.getByText('mở dialog'));
    await screen.findByRole('dialog');
    const first = screen.getAllByRole('button').find((b) => b.textContent === 'Nút đầu');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledTimes(1);
    // defaults were prevented, so the dialog did not close
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });
});
