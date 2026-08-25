import { useConfig } from '../lib/ConfigContext.jsx';

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

/**
 * Wave 2 opt-in banner: switches to the manifest-driven settings shell.
 * Always visible to users with config.view so the new UI stays reachable
 * even when the features.settings_center_v2 flag is still false.
 */
export function SettingsV2Banner({ navigate, flagOn }) {
  return (
    <div className="settings-v2-banner" role="status">
      <span>
        Đang thử nghiệm giao diện Cài đặt mới{flagOn ? '' : ' (chưa bật mặc định)'}.
      </span>
      <button type="button" onClick={() => navigate('admin-settings-v2')}>
        Dùng giao diện Cài đặt mới (thử nghiệm)
      </button>
    </div>
  );
}

// Sidebar navigation item — calls navigate instead of pushState
function NavLink({ cat, navigate, children }) {
  return (
    <button
      onClick={() => navigate('admin-settings-' + cat.key)}
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

// Category card for dashboard view — calls navigate
function CategoryCard({ cat, navigate }) {
  return (
    <div
      className="settings-card"
      onClick={() => navigate('admin-settings-' + cat.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('admin-settings-' + cat.key);
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

export function SettingsCenter({ _api, _notify, navigate }) {
  // features.settings_center_v2 drives the banner copy; the switch stays
  // reachable either way so users can always go back to the classic UI.
  const { getConfig } = useConfig();
  const flagOn = Boolean(getConfig('features', 'settings_center_v2', false));
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cài đặt hệ thống</h2>
        </div>
      </div>
      <SettingsV2Banner navigate={navigate} flagOn={flagOn} />
      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <nav aria-label="Danh mục cài đặt">
            {CATEGORIES.map((cat) => (
              <NavLink
                key={cat.key}
                cat={cat}
                navigate={navigate}
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
                  navigate={navigate}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
