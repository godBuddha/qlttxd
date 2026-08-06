import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api.js';

// Fetches an attachment blob with the auth header and renders it as an object
// URL. This avoids putting the JWT in a query string (?token=) which would leak
// into browser history, server logs and the Referer header.
export function EvidenceImage({ duongDan, alt, className, onClick, loading, style }) {
  const [src, setSrc] = useState(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('qlttxd_token');
    const filename = String(duongDan || '')
      .split('/')
      .pop();
    if (!filename) {
      setFailed(true);
      return undefined;
    }
    fetch(`${API_BASE}/api/v1/attachments/${encodeURIComponent(filename)}/view`, {
      headers: { 'X-Auth-Token': token || '' },
    })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.blob();
      })
      .then((blob) => {
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [duongDan]);
  if (failed || !src) return <span className={className} style={style} aria-hidden="true" />;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      loading={loading}
      style={style}
    />
  );
}
