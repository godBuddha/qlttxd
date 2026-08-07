import { useRef } from 'react';

/**
 * WAI-ARIA tabs pattern (automatic activation), ref A11Y-A4 / UX-12.
 *
 * - `role="tablist"` container, each tab `role="tab"` with `id`, `aria-selected`,
 *   `aria-controls`, and a roving `tabIndex` (only the selected tab is in the tab order).
 * - ArrowLeft/Right (and Home/End) navigate tabs, but ONLY while a tab has focus:
 *   the keydown handler is bound to the tablist element, not `window`, so arrow keys
 *   never hijack scroll or unrelated controls elsewhere on the page.
 * - Panels are produced with the sibling <TabPanel> wrapper, carrying `role="tabpanel"`,
 *   the matching `id`/`aria-labelledby`, and `hidden` when inactive.
 *
 * @param {string}  id        base id prefix (used to build `${id}-tab-<key>` / `${id}-panel-<key>`)
 * @param {string}  [label]   accessible name for the tablist (`aria-label`)
 * @param {Array<{key: string, label: string}>} tabs
 * @param {string}  active    key of the currently selected tab
 * @param {(key: string) => void} onChange  called when the selected tab changes
 * @param {string}  [className]  overrides the default `tabs` class
 * @param {object}  [style]      extra inline style for the tablist
 */
export function Tabs({ id, label, tabs, active, onChange, className = 'tabs', style }) {
  const listRef = useRef(null);

  function activate(key) {
    onChange(key);
    // Move focus to the newly selected tab (all tab buttons stay mounted, so the
    // DOM node always exists; roving tabIndex updates on the re-render it triggers).
    listRef.current?.querySelector(`[data-tab-key="${key}"]`)?.focus();
  }

  function onKeyDown(e) {
    const idx = tabs.findIndex((t) => t.key === active);
    if (idx < 0) return;
    let next;
    switch (e.key) {
      case 'ArrowRight':
        next = tabs[(idx + 1) % tabs.length];
        break;
      case 'ArrowLeft':
        next = tabs[(idx - 1 + tabs.length) % tabs.length];
        break;
      case 'Home':
        next = tabs[0];
        break;
      case 'End':
        next = tabs[tabs.length - 1];
        break;
      default:
        return;
    }
    if (!next) return;
    e.preventDefault();
    activate(next.key);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={className}
      style={style}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={selected}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'active' : ''}
            data-tab-key={t.key}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Panel associated with a tab (see <Tabs>). Renders `role="tabpanel"`, the matching
 * `id` (referenced by the tab's `aria-controls`) and `aria-labelledby` back to its tab,
 * and `hidden={!active}` so inactive panels leave the accessibility tree.
 *
 * @param {string}  id        base id prefix (same as the <Tabs> it belongs to)
 * @param {string}  tabKey    the matching tab key
 * @param {boolean} active    whether this panel is currently shown
 */
export function TabPanel({ id, tabKey, active, children }) {
  return (
    <div
      id={`${id}-panel-${tabKey}`}
      role="tabpanel"
      aria-labelledby={`${id}-tab-${tabKey}`}
      hidden={!active}
    >
      {children}
    </div>
  );
}