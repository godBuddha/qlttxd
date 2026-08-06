# SPEC T-08: Frontend Danh mục CRUD

> Task: coder (frontend) | Priority: P1 | Dependency: T-01

## Mục tiêu

Trang admin CRUD danh mục: loại vi phạm, hành vi vi phạm, mức phạt (3 tab).

## Files thay đổi

1. `app/frontend/src/main.jsx` — thêm `AdminCatalogPage`
2. `app/frontend/src/styles.css` — CSS cho catalog

## Chi tiết

### Component `AdminCatalogPage`

- 3 tab: Loại vi phạm | Hành vi | Mức phạt
- Mỗi tab: bảng dữ liệu + form thêm/sửa + nút xóa
- API endpoints đã có sẵn:
  - `GET /api/v1/danh-muc/loai-vi-pham` (public)
  - `GET /api/v1/danh-muc/hanh-vi` (public, filter theo loai_vi_pham_id)
  - `GET /api/v1/danh-muc/muc-phat` (public, filter theo hanh_vi_id)
- Cần thêm endpoints admin CRUD cho catalog (POST/PATCH/DELETE):
  - `POST /api/v1/admin/loai-vi-pham`
  - `PATCH /api/v1/admin/loai-vi-pham/:id`
  - `DELETE /api/v1/admin/loai-vi-pham/:id`
  - Tương tự cho hanh-vi, muc-phat

### Menu

Thêm vào nav (chỉ khi `can(user, 'admin.users')`):

```jsx
<button
  className={route.page === 'admin-catalog' ? 'selected' : ''}
  onClick={() => nav('admin-catalog')}
>
  📚 Danh mục
</button>
```

## Acceptance Criteria

- [ ] 3 tab hiển thị dữ liệu từ DB
- [ ] Thêm/sửa/xóa hoạt động
- [ ] Validate form (tên bắt buộc, số hợp lệ)
- [ ] Chỉ admin thấy menu
- [ ] Frontend build pass
