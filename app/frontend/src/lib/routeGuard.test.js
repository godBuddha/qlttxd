import { describe, it, expect } from 'vitest';
import { settingsV2RedirectPath } from './routeGuard.js';

describe('route guard: /admin/settings* → Settings Shell v2 khi flag bật', () => {
  it('flag bật: redirect các route settings cũ vào shell v2', () => {
    expect(settingsV2RedirectPath('/admin/settings')).toBe('/admin/settings/v2');
    expect(settingsV2RedirectPath('/admin/settings/')).toBe('/admin/settings/v2');
    expect(settingsV2RedirectPath('/admin/settings/auth')).toBe(
      '/admin/settings/v2/auth'
    );
    expect(settingsV2RedirectPath('/admin/settings/workflow-states')).toBe(
      '/admin/settings/v2/workflow-states'
    );
  });

  it('không redirect khi đã ở trong shell v2', () => {
    expect(settingsV2RedirectPath('/admin/settings/v2')).toBeNull();
    expect(settingsV2RedirectPath('/admin/settings/v2/auth')).toBeNull();
    // Prefix tương tự nhưng không phải settings (ví dụ /admin/settingsfoo)
    expect(settingsV2RedirectPath('/admin/users')).toBeNull();
  });

  it('regex khớp đúng logic trong main.jsx: chỉ route /admin/settings(?!/v2)', () => {
    // Route ngoài settings → không đổi
    expect(settingsV2RedirectPath('/dashboard')).toBeNull();
    expect(settingsV2RedirectPath('/cases/abc')).toBeNull();
    // Deep link nhiều cấp giữ nguyên phần đuôi
    expect(settingsV2RedirectPath('/admin/settings/a/b')).toBe(
      '/admin/settings/v2/a/b'
    );
  });
});
