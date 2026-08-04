export function Notice({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type || 'info'}`} role="status">{notice.text}<button aria-label="Đóng thông báo" onClick={onClose}>×</button></div>;
}
