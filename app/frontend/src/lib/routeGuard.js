/**
 * Wave 4 route guard: mọi route /admin/settings* (giao diện cũ) được chuyển
 * vào Settings Shell v2. Giao diện cũ đã bị xóa nên redirect là vô điều kiện.
 * Pure function để test được mà không cần render toàn bộ App (main.jsx).
 *
 * Lưu ý về flag `features.settings_center_v2`: key này VẪN ĐƯỢC GIỮ trong DB
 * (không xóa) chỉ để tương thích ngược với các bản cài đặt cũ; nó không còn
 * điều khiển việc chuyển hướng nữa và sẽ được nghỉ hưu sau 1 phiên bản.
 *
 * Trả về path đích nếu cần redirect, null nếu đã ở trong shell v2.
 */
export function settingsV2RedirectPath(pathname) {
  // Đã ở trong shell v2 (/admin/settings/v2...) → không redirect.
  if (!/^\/admin\/settings(?!\/v2)(?:\/|$)/.test(pathname)) return null;
  const rest = pathname.replace(/^\/admin\/settings\/?/, '');
  return rest ? `/admin/settings/v2/${rest}` : '/admin/settings/v2';
}
