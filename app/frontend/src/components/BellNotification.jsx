import { useState, useEffect, useRef } from 'react';
import { API_BASE, dateText } from '../lib/api.js';

export function BellNotification({ api }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const loadCount = () =>
    api('/api/v1/thong-bao/unread-count')
      .then((r) => setCount(r.count || 0))
      .catch(() => {});

  const loadLatest = () =>
    api('/api/v1/thong-bao?limit=15')
      .then((r) => setItems(r.data || []))
      .catch(() => {});

  useEffect(() => {
    loadCount();
    loadLatest();

    let es = null;
    let pollTimer = null;
    let disposed = false;

    // Fallback to classic polling if SSE cannot be established.
    const startPolling = () => {
      if (pollTimer || disposed) return;
      loadCount();
      pollTimer = setInterval(() => {
        loadCount();
        if (open) loadLatest();
      }, 30000);
    };

    try {
      const token = localStorage.getItem('qlttxd_token');
      const streamUrl = `${API_BASE}/api/v1/thong-bao/stream?token=${encodeURIComponent(token || '')}`;
      es = new EventSource(streamUrl);
      es.onmessage = (e) => {
        let notif;
        try {
          notif = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!notif || !notif.id) return;
        setCount((c) => c + 1);
        setItems((old) => [notif, ...old.filter((x) => x.id !== notif.id)].slice(0, 15));
      };
      es.onerror = () => {
        // SSE failed (e.g. proxy buffering / auth / network) -> fall back to polling.
        try {
          es?.close();
        } catch {}
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      disposed = true;
      try {
        es?.close();
      } catch {}
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api('/api/v1/thong-bao?limit=15')
      .then((r) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id) {
    try {
      await api(`/api/v1/thong-bao/${id}/mark-read`);
      setItems((old) => old.map((x) => (x.id === id ? { ...x, trang_thai: 'da_doc' } : x)));
      setCount((c) => Math.max(0, c - 1));
    } catch {}
  }
  async function markAll() {
    try {
      await api('/api/v1/thong-bao/mark-all-read');
      setItems((old) => old.map((x) => ({ ...x, trang_thai: 'da_doc' })));
      setCount(0);
    } catch {}
  }

  return (
    <div className="bell-wrapper" ref={ref}>
      <button className="bell-btn" onClick={() => setOpen(!open)} aria-label="Thông báo">
        🔔{count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="bell-dropdown">
          <div className="bell-header">
            <strong>Thông báo</strong>
            {count > 0 && (
              <button className="text-button" onClick={markAll}>
                Đọc tất cả
              </button>
            )}
          </div>
          {loading ? (
            <p className="empty" style={{ padding: 16 }}>
              Đang tải…
            </p>
          ) : items.length === 0 ? (
            <p className="empty" style={{ padding: 16 }}>
              Không có thông báo.
            </p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={n.trang_thai === 'chua_doc' ? 'unread' : ''}
                  onClick={() => {
                    if (n.trang_thai === 'chua_doc') markRead(n.id);
                  }}
                >
                  <b>{n.tieu_de}</b>
                  {n.noi_dung && <span>{n.noi_dung}</span>}
                  <small>{dateText(n.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
