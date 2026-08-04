# SPEC T-07: Frontend Audit Log Page

> Task: coder (frontend) | Priority: P1 | Dependency: T-04

## Mục tiêu
Trang admin xem audit log với filter và phân trang.

## Files thay đổi
1. `app/frontend/src/main.jsx` — thêm `AdminAuditLogPage`
2. `app/frontend/src/styles.css` — CSS cho audit log

## Chi tiết

### Component `AdminAuditLogPage`
- Gọi `GET /api/v1/admin/audit-log?page=1&limit=50`
- Bảng hiển thị: thời gian, người dùng, hành động, bảng bị tác động, ID bản ghi, chi tiết (JSON)
- Filter: dropdown bảng (ho_so, bao_cao_vi_pham, users, quan_huyen, phuong_xa, ...), dropdown hành động (create, update, delete, login, ...)
- Phân trang: nút Previous/Next
- Hiển thị chi tiết JSON trong modal hoặc expand row

### Menu
Thêm vào nav (chỉ khi `can(user, 'admin.users')`):
```jsx
<button className={route.page === 'admin-audit' ? 'selected' : ''} onClick={() => nav('admin-audit')}>📋 Nhật ký hệ thống</button>
```

### Route
```jsx
{route.page === 'admin-audit' && <AdminAuditLogPage api={api} notify={notify} />}
```

## Acceptance Criteria
- [ ] Trang hiển thị bảng audit log
- [ ] Filter theo bảng/hành động hoạt động
- [ ] Phân trang hoạt động
- [ ] Chỉ admin thấy menu (admin.users permission)
- [ ] Frontend build pass
