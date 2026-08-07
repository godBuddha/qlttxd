import { ArrowLeft } from 'lucide-react';

export function NotFound({ navigate }) {
  return (
    <div className="panel" style={{ margin: '40px auto', maxWidth: 500, textAlign: 'center' }}>
      <h2>404 — Không tìm thấy trang</h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <button onClick={() => navigate('dashboard')}><ArrowLeft size={16} aria-hidden="true"/> Về trang chính</button>
    </div>
  );
}
