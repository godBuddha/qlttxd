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
  { key: 'workflow-states', label: 'Trạng thái workflow', icon: '🔄', desc: 'Danh sách trạng thái' },
  { key: 'workflow-transitions', label: 'Chuyển trạng thái', icon: '🔀', desc: 'Quy tắc chuyển đổi' },
  { key: 'role-permissions', label: 'Quyền theo vai trò', icon: '👥', desc: 'Phân quyền RBAC' },
];

// Simple Link component for sidebar navigation
function NavLink({ to, active, onClick, children }) {
  const handleClick = () => {
    if (onClick) onClick();
    window.history.pushState({}, '', to);
  };
  return (
    <button
      className={active ? 'selected' : ''}
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
    >
      <span className="nav-icon">{children[0]}</span>
      <div>
        <div>{children[1]}</div>
        <small className="card-desc">
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
      className="settings-card"
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
      <div className="card-icon">{cat.icon}</div>
      <div className="card-label">{cat.label}</div>
      <div className="card-desc">{cat.desc}</div>
    </div>
  );
}

export function SettingsCenter({ _api, _notify }) {
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
      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-sidebar">
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
        <main className="settings-main">
          <h3>Danh mục cài đặt</h3>
          <section className="panel">
            <div className="settings-grid">
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
