export function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div
      className={`notice ${notice.type || 'info'}`}
      aria-live="polite"
      role={notice?.type === 'error' ? 'alert' : 'status'}
    >
      {notice.text}
      <button aria-label="Đóng thông báo" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
