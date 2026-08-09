import { useState } from 'react';

const CATEGORIES = [
  { key: 'auth', label: 'Xác thực', icon: '🔑', desc: 'JWT, cookie, mật khẩu' },
  { key: 'upload', label: 'Tải lên', icon: '📎', desc: 'Kích thước, định dạng tệp' },
  { key: 'rate-limit', label: 'Giới hạn tốc độ', icon: '⏱️', desc: 'Rate limiting API' },
  { key: 'security', label: 'Bảo mật', icon: '🛡️', desc: 'Timeout, HSTS, CORS' },
  { key: 'ui', label: 'Giao diện', icon: '🎨', desc: 'Bản đồ, theme, ngôn ngữ' },
  { key: 'audit', label: 'Nhật ký', icon: '📋', desc: 'Retention, batch size' },
  { key: 'notification', label: 'Thông báo', icon: '🔔', desc: 'Worker, SSE heartbeat' },
  { key: 'export', label: 'Xuất dữ liệu', icon: '📤', desc: 'MIME types xuất file' },
  { key: 'validation', label: 'Quy tắc kiểm tra', icon: '✅', desc: 'Validation rules' },
];

// Simple Link component for sidebar navigation
function NavLink({ to, active, onClick, children }) {
  const handleClick = () => {
    if (onClick) onClick();
    window.history.pushState({}, '', to);
  };
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '8px 16px',
        border: 'none',
        background: active ? '#e3f2fd' : 'transparent',
        color: active ? '#1a56db' : 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        borderLeft: active ? '3px solid #1a56db' : '3px solid transparent',
        fontWeight: active ? 600 : 400,
      }}
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
    >
      <span style={{ marginRight: 8 }}>{children[0]}</span>
      <div>
        <div>{children[1]}</div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          {children[2] || ''}
        </small>
      </div>
    </button>
  );
}

// Category card for dashboard view
function CategoryCard({ cat, onClick }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex="0"
      aria-label={`Cài đặt ${cat.label}`}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{cat.icon}</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{cat.label}</div>
      <small style={{ color: 'var(--muted, #6c757d)' }}>{cat.desc}</small>
    </div>
  );
}

export function SettingsCenter({ api, notify }) {
  const [activeTab, setActiveTab] = useState(
    () => window.location.pathname.split('/').pop() || 'auth'
  );

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cài đặt hệ thống</h2>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 260,
            minWidth: 260,
            borderRight: '1px solid var(--border)',
            padding: '12px 0',
            background: '#f8f9fa',
          }}
        >
          <nav aria-label="Danh mục cài đặt">
            {CATEGORIES.map((cat) => (
              <NavLink
                key={cat.key}
                to={`/admin/settings/${cat.key}`}
                active={activeTab === cat.key}
                onClick={() => setActiveTab(cat.key)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span />
              </NavLink>
            ))}
          </nav>
        </aside>
        {/* Main content — quick overview cards */}
        <main style={{ flex: 1, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>
            Danh mục cài đặt
          </h3>
          <section className="panel" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.key}
                  cat={cat}
                  onClick={() => setActiveTab(cat.key)}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
