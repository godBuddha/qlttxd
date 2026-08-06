# SPEC T-09: Frontend Ảnh minh chứng

> Task: coder (frontend) | Priority: P1 | Dependency: T-01

## Mục tiêu

Hiển thị ảnh minh chứng trong chi tiết hồ sơ và báo cáo công dân.

## Files thay đổi

1. `app/frontend/src/main.jsx` — sửa `CaseDetail` + `CitizenPage`

## Chi tiết

### 1. CaseDetail — thêm tab Ảnh

Trong component `CaseDetail`, gọi thêm API để lấy ảnh:

```js
// GET /api/v1/ho-so/:id đã trả bao_cao có tep_dinh_kem
// Hoặc gọi riêng: GET /api/v1/bao-cao/:bao_cao_id/anh
```

Hiển thị gallery ảnh trong tab mới hoặc tab Tổng quan:

```jsx
{
  caseItem.bao_cao?.anh?.map((a) => (
    <img
      key={a.id}
      src={`/api/v1/uploads/${a.filename}`}
      alt={a.ten_goc}
      className="evidence-img"
    />
  ));
}
```

### 2. CitizenPage — hiển thị ảnh báo cáo

Trong `ReportTable`, thêm cột ảnh (thumbnail):

```jsx
<td>{r.anh_count || 0} ảnh</td>
```

### 3. CSS

```css
.evidence-img {
  max-width: 200px;
  max-height: 200px;
  object-fit: cover;
  border-radius: 4px;
  margin: 4px;
  cursor: pointer;
}
.evidence-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

## Acceptance Criteria

- [ ] Chi tiết hồ sơ hiển thị ảnh minh chứng
- [ ] Công dân thấy ảnh trong báo cáo
- [ ] Ảnh click để phóng to (lightbox đơn giản)
- [ ] Frontend build pass
