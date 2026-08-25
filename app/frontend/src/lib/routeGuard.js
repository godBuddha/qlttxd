/**
 * Wave 3 route guard: khi flag features.settings_center_v2 bật, mọi route
 * /admin/settings* (giao diện cũ) được chuyển vào Settings Shell v2.
 * Pure function để test được mà không cần render toàn bộ App (main.jsx).
 *
 * Trả về path đích nếu cần redirect, null nếu giữ nguyên route cũ
 * (flag false hoặc đã ở trong shell v2).
 */
export function settingsV2RedirectPath(pathname) {
  // Đã ở trong shell v2 (/admin/settings/v2...) → không redirect.
  if (!/^\/admin\/settings(?!\/v2)(?:\/|$)/.test(pathname)) return null;
  const rest = pathname.replace(/^\/admin\/settings\/?/, '');
  return rest ? `/admin/settings/v2/${rest}` : '/admin/settings/v2';
}
