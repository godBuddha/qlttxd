# Kết quả kiểm thử T12: Đăng ký admin lần đầu + Quản trị người dùng & phân quyền

Ngày kiểm thử: 2026-08-03

## Phạm vi đã triển khai

### Backend (server.js)

**Public endpoints (không auth):**

- `GET /api/v1/auth/setup-status` → `{ needsSetup: true/false }` — kiểm tra xem hệ thống đã có admin chưa
- `POST /api/v1/auth/setup-admin` → tạo admin đầu tiên + auto-login (trả token+user)
  - Validate: username 3-50, password ≥8 có chữ+chữ số, full_name, email hoặc phone
  - Transaction + `pg_advisory_xact_lock(hashtext('setup_admin'))` chống race condition
  - Đã có admin → 409

**Admin endpoints (require `admin.users` permission):**

- `GET /api/v1/admin/users` — danh sách user + roles (KHÔNG trả password_hash)
- `POST /api/v1/admin/users` — tạo user: username, full_name, email, phone, password, is_active, roles[]
- `PATCH /api/v1/admin/users/:id` — sửa: full_name, email, phone, is_active, roles[], password
- `GET /api/v1/admin/roles` — roles kèm permissions (nhóm theo module)
- `PATCH /api/v1/admin/roles/:id/permissions` — ghi đè role_permissions (body: `{ permission_ids: [] }`)
- `GET /api/v1/admin/permissions` — toàn bộ permissions nhóm theo module

**Ràng buộc bảo mật:**

- Không cho khóa/xóa admin cuối cùng (đếm user có role admin >= 2 mới cho phép)
- Không cho tự gỡ quyền admin khi chỉ còn 1 admin
- Audit log cho mọi hành động tạo/sửa user, sửa role permissions
- Hỗ trợ cả `Authorization: Bearer` và `X-Auth-Token` header

### Frontend (main.jsx + styles.css)

- `SetupAdminPage`: form Họ tên / Username / Email / SĐT / Mật khẩu / Xác nhận → POST setup-admin → auto-login
- `AdminUsersPage`: bảng user + nút Tạo tài khoản (modal) + Sửa (roles, is_active, đổi mật khẩu) + Khóa/Mở
- `AdminRolesPage`: danh sách role → click → checkbox permissions nhóm theo module → Lưu
- Sidebar: thêm "Quản trị" group khi `can(user, 'admin.users')`
- `request()`: đổi header `Authorization: Bearer` → `X-Auth-Token: <token>`
- App mount → gọi setup-status → needsSetup=true → SetupAdminPage

### SQL (seed.sql)

- Xóa 5 user demo (admin, leader.hn, handler.hn, verifier.hn, citizen.nga)
- Giữ nguyên roles, permissions, GIS quận/phường

## Lệnh đã chạy

```sh
cd /workspace/ssd/qlttxd/app/backend
node reset-db.js  # Reset DB (schema + seed không có user demo)
node --test test/setup-admin.test.js
node --test test/server.test.js
node --test test/admin-users.test.js
node --test test/admin-roles.test.js
node --test test/security-rbac.test.js
```

## Kết quả test

| Test file             | Kết quả    |
| --------------------- | ---------- |
| setup-admin.test.js   | 7/7 PASS   |
| server.test.js        | 4/4 PASS   |
| admin-users.test.js   | 11/11 PASS |
| admin-roles.test.js   | 6/6 PASS   |
| security-rbac.test.js | 5/5 PASS   |

**Tổng: 33/33 test PASS**

## Files đã thay đổi

- `/workspace/ssd/qlttxd/sql/seed.sql` — Xóa user demo, giữ roles+permissions+GIS
- `/workspace/ssd/qlttxd/app/backend/server.js` — Thêm 8 endpoints mới + X-Auth-Token support
- `/workspace/ssd/qlttxd/app/frontend/src/main.jsx` — SetupAdminPage, AdminUsersPage, AdminRolesPage, X-Auth-Token
- `/workspace/ssd/qlttxd/app/frontend/src/styles.css` — CSS cho modal, nav-group, role-list, permission-grid, checkbox
- `/workspace/ssd/qlttxd/app/backend/test/setup-admin.test.js` — TẠO MỚI
- `/workspace/ssd/qlttxd/app/backend/test/admin-users.test.js` — TẠO MỚI
- `/workspace/ssd/qlttxd/app/backend/test/admin-roles.test.js` — TẠO MỚI
- `/workspace/ssd/qlttxd/app/backend/test/server.test.js` — Refactor dùng setup-admin
- `/workspace/ssd/qlttxd/app/backend/test/security-rbac.test.js` — Refactor dùng admin API tạo user
- `/workspace/ssd/qlttxd/app/backend/reset-db.js` — TẠO MỚI (helper script)

## Hạn chế

- Chưa có E2E test cho frontend flow setup → login → tạo user → phân quyền
- Chưa test concurrent setup-admin (race condition) — code đã có advisory lock nhưng chưa có test concurrent
