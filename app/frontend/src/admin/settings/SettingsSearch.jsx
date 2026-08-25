import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { SETTINGS_MANIFESTS, GROUP_LABELS } from '../../admin/settings-manifests/index.js';

/** Flat search index: one entry per manifest field (title + label + help + key). */
export function buildSearchIndex() {
  const entries = [];
  for (const m of SETTINGS_MANIFESTS) {
    for (const f of m.fields) {
      entries.push({
        manifestId: m.id,
        group: m.group,
        groupLabel: GROUP_LABELS[m.group] || m.group,
        title: m.title,
        key: f.key,
        label: f.label,
        help: f.help || '',
        haystack: [m.title, f.label, f.help, f.key].join(' ').toLowerCase(),
      });
    }
  }
  return entries;
}

/**
 * Ctrl/Cmd+K command palette for settings.
 * Arrow keys move the selection, Enter jumps to the page and highlights
 * the field (`.field-highlight` for 2s), Escape closes.
 */
export function SettingsSearch({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const index = useMemo(buildSearchIndex, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((e) => q.split(/\s+/).every((term) => e.haystack.includes(term)))
      .slice(0, 12);
  }, [index, query]);

  // Reset state each time the dialog opens; focus goes to the input.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const choose = (entry) => {
    onNavigate?.(entry);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  if (!open) return null;

  return (
    <div className="search-overlay" role="presentation">
      <div
        className="modal search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm cài đặt"
        onKeyDown={onKeyDown}
      >
        <div className="search-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="settings-search-results"
            aria-activedescendant={results[active] ? `search-result-${active}` : undefined}
            aria-label="Tìm kiếm cài đặt"
            placeholder="Tìm cấu hình theo tên hoặc mô tả…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="settings-search-results" className="search-result-list" role="listbox" aria-label="Kết quả tìm kiếm">
          {query.trim() === '' && (
            <li className="empty">Nhập từ khóa để tìm cấu hình — ví dụ "jwt", "bản đồ", "phân trang".</li>
          )}
          {query.trim() !== '' && results.length === 0 && (
            <li className="empty">Không tìm thấy cấu hình nào khớp "{query}".</li>
          )}
          {results.map((entry, i) => (
            <li
              key={`${entry.manifestId}.${entry.key}`}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === active}
              className={`search-result${i === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(entry)}
            >
              <span className="search-result-label">{entry.label}</span>
              <span className="search-result-path">
                {entry.groupLabel} / {entry.title}
              </span>
              <code className="state-code">{entry.key}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default SettingsSearch;
