import { useEffect, useRef } from 'react';

// Elements that can receive keyboard focus inside a dialog.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Do not rely on layout rects (they are all 0 in jsdom). Reject only explicit
// hidden/disabled state; a rendered dialog's children are visible by default.
function isFocusable(el) {
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hasAttribute('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function getFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

// Reusable accessible modal dialog (A11Y-A1 / A11Y-A2):
//   - role="dialog" + aria-modal + accessible name (label or labelledBy)
//   - focus is moved into the dialog on open
//   - Tab / Shift+Tab are trapped inside while open
//   - Escape closes
//   - focus is restored to the previously focused element (the trigger) on close
//   - background scroll is locked while open
// Optional `onKeyDown` lets the consumer handle extra keys (e.g. ArrowLeft/Right
// for a lightbox); call `e.preventDefault()` there to stop default handling.
export function Dialog({
  open,
  onClose,
  children,
  className,
  label,
  labelledBy,
  initialFocusRef,
  onKeyDown,
  onOverlayClick,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // Capture the currently focused element so we can give focus back on close.
  useEffect(() => {
    if (open) restoreRef.current = document.activeElement;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const first = getFocusable(panel)[0];
      (first || panel).focus();
    }

    // Lock background scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDownCapture = (e) => {
      // Let the consumer handle keys (e.g. arrows for a lightbox) first.
      if (onKeyDown) onKeyDown(e);
      if (e.defaultPrevented) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const els = getFocusable(panel);
      if (!els.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDownCapture, true);
    return () => {
      document.removeEventListener('keydown', onKeyDownCapture, true);
      document.body.style.overflow = prevOverflow;
      const restore = restoreRef.current;
      if (restore && typeof restore.focus === 'function') restore.focus();
    };
  }, [open, onClose, initialFocusRef, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className={className ? `dialog-overlay ${className}` : 'dialog-overlay'}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      ref={panelRef}
      tabIndex={-1}
      onClick={onOverlayClick}
    >
      {children}
    </div>
  );
}
