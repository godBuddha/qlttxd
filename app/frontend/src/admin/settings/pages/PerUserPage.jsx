import { useEffect, useState } from 'react';

/**
 * PerUserPage — cài đặt theo từng người dùng (nhóm "workspace", route v2/preferences).
 *
 * Lưu ý (theo spec Wave 3, mục 7): backend PUT /api/v1/config/:category/:key
 * chưa hỗ trợ scope=user → tạm lưu localStorage cho theme + ngôn ngữ.
 * Khi API hỗ trợ scope user, chuyển sang lưu server và giữ localStorage làm fallback.
 */

const STORAGE_KEY = 'qlttxd_user_preferences';

const LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

function readPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      language: parsed.language === 'en' ? 'en' : 'vi',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { language: 'vi', theme: 'light' };
  }
}

export function PerUserPage() {
  const [prefs, setPrefs] = useState(readPrefs);
  const [notice, setNotice] = useState(null);

  // Đồng bộ class trên <html> để giao diện phản ánh ngay (hiện chỉ light).
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', prefs.theme === 'dark');
    document.documentElement.lang = prefs.language;
  }, [prefs]);

  function update(patch) {
    const next = { ...prefs, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPrefs(next);
      setNotice('Đã lưu cài đặt của bạn trên trình duyệt này.');
    } catch {
      setNotice('Không thể lưu cài đặt (localStorage bị chặn).');
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Cài đặt cá nhân</h2>
          <p className="settings-subtitle">
            Áp dụng cho riêng tài khoản của bạn trên trình duyệt này.
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="form-field" id="field-ui-language">
          <label htmlFor="peruser-language">Ngôn ngữ</label>
          <select
            id="peruser-language"
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field" id="field-ui-theme">
          <label htmlFor="peruser-theme">Giao diện</label>
          <select
            id="peruser-theme"
            value={prefs.theme}
            disabled
            aria-disabled="true"
            title="Hiện chỉ hỗ trợ giao diện sáng (light)"
          >
            <option value="light">Sáng (light)</option>
            <option value="dark">Tối (dark) — sắp ra mắt</option>
          </select>
          <p className="field-hint">Giao diện tối đang được phát triển.</p>
        </div>

        {notice && (
          <div className="notice success" role="status">
            <span>{notice}</span>
          </div>
        )}
      </div>
    </>
  );
}
