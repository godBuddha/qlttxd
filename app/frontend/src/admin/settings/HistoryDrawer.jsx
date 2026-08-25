import { useEffect, useState, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { errorText, dateText } from '../../lib/api.js';
import { Dialog } from '../../components/Dialog.jsx';

/**
 * Right-side drawer showing the change history of one config field.
 * GET /api/v1/config/history?category=X&key=Y (endpoint requires both params).
 * Rollback calls POST /api/v1/config/rollback/:historyId after confirmation.
 */
export function HistoryDrawer({ field, api, onClose, onRolledBack }) {
  const [category, key] = field.key.split('.');
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // history entry pending confirm
  const [rollingBack, setRollingBack] = useState(false);
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api(
        `/api/v1/config/history?category=${encodeURIComponent(category)}&key=${encodeURIComponent(key)}&limit=50`
      );
      // Endpoint supports category+key; keep a FE filter as belt-and-braces.
      const rows = Array.isArray(res?.data) ? res.data : [];
      setEntries(rows.filter((r) => r.key === key && r.category === category));
    } catch (e) {
      setError(errorText(e));
    }
  }, [api, category, key]);

  useEffect(() => {
    load();
  }, [load]);

  const rollback = async (entry) => {
    setRollingBack(true);
    try {
      await api(`/api/v1/config/rollback/${entry.id}`, { method: 'POST' });
      setConfirming(null);
      setStatus({ type: 'success', text: 'Đã hoàn tác về giá trị này.' });
      await load();
      onRolledBack?.();
    } catch (e) {
      setStatus({ type: 'error', text: errorText(e) });
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <Dialog open onClose={onClose} label={`Lịch sử thay đổi của ${field.label}`} className="history-drawer">
      <div className="history-drawer-panel">
        <header className="history-drawer-header">
          <div>
            <p className="eyebrow">Lịch sử thay đổi</p>
            <h3>{field.label}</h3>
            <code className="state-code">{field.key}</code>
          </div>
          <button type="button" className="text-button" onClick={onClose} aria-label="Đóng lịch sử">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {status && (
          <div
            className={`notice ${status.type === 'success' ? 'success' : 'error'}`}
            role={status.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <span>{status.text}</span>
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span>
          </div>
        )}

        {entries === null && !error && (
          <div className="loading" aria-busy="true">
            Đang tải lịch sử…
          </div>
        )}

        {entries !== null && entries.length === 0 && (
          <p className="empty">Chưa có thay đổi nào được ghi nhận cho cấu hình này.</p>
        )}

        {entries !== null && entries.length > 0 && (
          <ul className="history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="history-item">
                <div className="history-meta">
                  <time dateTime={entry.thoi_gian}>{dateText(entry.thoi_gian)}</time>
                  <span>{entry.full_name || entry.username || 'Hệ thống'}</span>
                  <span className="badge">{actionLabel(entry.action)}</span>
                </div>
                <div className="history-values">
                  <ValueChip label="Cũ" value={entry.old_value} />
                  <span aria-hidden="true">→</span>
                  <ValueChip label="Mới" value={entry.new_value} />
                </div>
                <button
                  type="button"
                  className="transition-btn"
                  onClick={() => setConfirming(entry)}
                  disabled={rollingBack}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Hoàn tác về bản này
                </button>

                {confirming?.id === entry.id && (
                  <div className="history-confirm" role="alertdialog" aria-label="Xác nhận hoàn tác">
                    <p>
                      Đặt "{field.label}" về giá trị{' '}
                      <strong className="value-mono">{formatValue(entry.old_value)}</strong>?
                    </p>
                    <div className="flex-row">
                      <button type="button" onClick={() => rollback(entry)} disabled={rollingBack}>
                        {rollingBack ? 'Đang hoàn tác…' : 'Xác nhận'}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setConfirming(null)}
                        disabled={rollingBack}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function actionLabel(action) {
  if (action === 'update') return 'Cập nhật';
  if (action === 'rollback') return 'Hoàn tác';
  if (action === 'create') return 'Tạo';
  return action || '';
}

/** Short text form of a stored JSON value. */
export function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  return s === '' ? '(rỗng)' : s;
}

function ValueChip({ label, value }) {
  return (
    <span className="value-chip">
      <span className="sr-only">{label}: </span>
      <span aria-hidden="true">{label} </span>
      <span className="value-mono">{formatValue(value)}</span>
    </span>
  );
}
