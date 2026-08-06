# SPEC REFACTOR-002: Tách main.jsx thành component modules

> Task: coder | Priority: P1 | Dependency: REFACTOR-001

## Mục tiêu

Tách main.jsx (903 dòng) thành component files riêng. Thêm React.lazy cho code splitting.

## Cấu trúc mới

```
app/frontend/src/
  main.jsx              (< 100 dòng: App shell + routing + render)
  components/
    Layout.jsx          (header, sidebar, app-shell)
    Login.jsx           (Login + SetupAdminPage)
    ForgotPassword.jsx  (ForgotPasswordPage + ResetPasswordPage)
    MapView.jsx         (Leaflet map component)
    Notice.jsx          (notification toast)
    Loading.jsx         (loading spinner)
    Status.jsx          (status badge)
    BellNotification.jsx (bell icon + dropdown)
  pages/
    CitizenPage.jsx     (citizen report form)
    Dashboard.jsx       (overview dashboard)
    CaseList.jsx        (case list + filters)
    CaseDetail.jsx      (case detail + tabs)
    BanDoPage.jsx       (global map)
    ReportPage.jsx      (statistics + export)
    OfficerReports.jsx  (officer report list)
    ProfilePage.jsx     (profile + password change)
  admin/
    AdminUsersPage.jsx
    AdminRolesPage.jsx
    AdminAuditLogPage.jsx
    AdminLocationsPage.jsx
    AdminCatalogPage.jsx
  lib/
    api.js              (request function + helpers)
    constants.js        (STATES, STATE_LABELS, PERMISSION_LABELS, etc.)
  styles.css            (unchanged)
```

## Quy tắc

- KHÔNG thay đổi UI behavior
- KHÔNG thay đổi routing logic
- Dùng React.lazy + Suspense cho admin pages
- Mỗi component file export default
- constants.js chứa STATES, STATE_LABELS, AUDIT_*, NHOM_LABELS, PERMISSION_LABELS, MODULE_LABELS
- api.js chứa request(), errorText(), dateText(), money(), can()
- Vite build phải clean

## Acceptance Criteria

- main.jsx < 100 dòng
- Mỗi component < 150 dòng
- Vite build clean
- Không thay đổi UI behavior
- React.lazy cho admin pages
- Bundle size giảm ≥ 20%
