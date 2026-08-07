import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceGallery } from './CaseDetail.jsx';

const IMAGES = [
  { id: 1, duong_dan: 'ev/a.png', ten_goc: 'Anh 1' },
  { id: 2, duong_dan: 'ev/b.png', ten_goc: 'Anh 2' },
  { id: 3, duong_dan: 'ev/c.png', ten_goc: 'Anh 3' },
];

describe('EvidenceGallery lightbox (A11Y-A2)', () => {
  beforeEach(() => {
    // EvidenceImage does an authenticated fetch; keep it pending (never
    // settle) so it renders its loading placeholder and never re-renders
    // after the test. The thumbnail <button> provides the accessible name.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  it('renders thumbnails as focusable buttons (keyboard-open via Tab+Enter)', () => {
    render(<EvidenceGallery images={IMAGES} />);
    const thumbs = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('evidence-thumb'));
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0]).toHaveAttribute('aria-label', 'Xem ảnh phóng to: Anh 1');
    expect(thumbs[0].tabIndex).toBe(0); // native button, keyboard focusable
  });

  it('opens a dialog with aria labels, no nameless glyph buttons', () => {
    render(<EvidenceGallery images={IMAGES} />);
    const thumbs = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('evidence-thumb'));
    fireEvent.click(thumbs[1]);
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveAttribute('aria-label', 'Ảnh minh chứng: Anh 2');
    // every control has an accessible name
    fireEvent.click(screen.getByLabelText('Đóng ảnh phóng to'));
    fireEvent.click(thumbs[1]);
    expect(screen.getByLabelText('Ảnh trước')).toBeInTheDocument();
    expect(screen.getByLabelText('Ảnh sau')).toBeInTheDocument();
    // caption shows the current image name
    expect(screen.getByText('Anh 2')).toBeInTheDocument();
  });

  it('ArrowLeft/Right navigates without shifting focus off a control', () => {
    render(<EvidenceGallery images={IMAGES} />);
    const thumbs = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('evidence-thumb'));
    fireEvent.click(thumbs[1]); // open Anh 2; focus lands on the close button
    const close = screen.getByLabelText('Đóng ảnh phóng to');
    // ArrowRight -> Anh 3
    fireEvent.keyDown(close, { key: 'ArrowRight' });
    expect(screen.getByText('Anh 3')).toBeInTheDocument();
    expect(document.activeElement).toBe(close); // focus has not drifted
    // ArrowLeft -> Anh 2
    fireEvent.keyDown(close, { key: 'ArrowLeft' });
    expect(screen.getByText('Anh 2')).toBeInTheDocument();
    expect(document.activeElement).toBe(close);
  });

  it('Escape closes and restores focus to the triggering thumbnail', async () => {
    render(<EvidenceGallery images={IMAGES} />);
    const thumbs = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('evidence-thumb'));
    // simulate a keyboard user: focus the thumbnail, then activate it (Tab+Enter)
    thumbs[0].focus();
    fireEvent.click(thumbs[0]);
    const close = screen.getByLabelText('Đóng ảnh phóng to');
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumbs[0]);
  });
});
