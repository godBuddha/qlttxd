# Thiết kế giao diện hệ thống QLTTXD (T5)

Bản ghi này mô tả thiết kế giao diện cho hệ thống quản lý trật tự xây dựng (QLTTXD). Đọc kỹ BRIEF.md và các tài liệu tham khảo trước khi viết: BRIEF.md, docs/03-dac-ta-nghiep-vu.md, docs/01-phan-tich-phap-ly.md.

## 1. Nguyên tắc thiết kế

- Mobile-first và responsive: chú trọng trải nghiệm trên thiết bị di động, sau đó mở rộng lên tablet và desktop với breakpoints 360px, 768px, 1200px.
- Accessibility: tuân thủ WCAG 2.1 AA; đủ màu tương phản, hỗ trợ keyboard, mô tả hình ảnh (alt).
- RBAC UI: giao diện hiển thị dữ liệu và thao tác theo vai trò (công dân, cán bộ tiếp nhận, cán bộ xác minh, lãnh đạo, quản trị).
- Hiệu suất và khả năng mở rộng: tối giản giao diện, tải dữ liệu từ REST API, lazy-load và pagination.
- Thiết kế tokens: màu sắc, typography, spacing được chuẩn hoá để đồng bộ trên toàn hệ thống.

> Mọi tài liệu viết bằng tiếng Việt, rõ ràng, có cấu trúc heading và tham chiếu đến các nguồn liên quan.

## 2. Sitemap (mô tả cây điều hướng)

- Portal công dân
- Admin nội bộ
  - Dashboard
  - Vi phạm
  - Biên bản
  - Hồ sơ
  - Thống kê
  - Cấu hình & quản trị
- Dữ liệu tham khảo
- Thiết kế và tài liệu tham khảo

## 3. Màn hình chính (mô tả tổng quan)

- Trang chủ admin (Dashboard): tóm tắt vi phạm, số biên bản, yêu cầu xử lý, thống kê theo ngày/tuần/tháng.
- Danh sách vi phạm: bảng danh sách, lọc nhanh, tìm kiếm, nháy để xem chi tiết, chức năng phê duyệt/áp dụng biện pháp.
- Chi tiết vi phạm: thông tin vi phạm, hình ảnh đính kèm, vị trí trên bản đồ, lịch sử xử lý.
- Lập biên bản: form điền thông tin biên bản, đính kèm văn bản/hình ảnh, xác nhận bởi cán bộ.
- Hồ sơ người dân: danh sách người dân vi phạm, tìm kiếm, xem chi tiết, lịch sử vi phạm.
- Bản đồ vi phạm: bản đồ GIS hiển thị vị trí vi phạm và các lớp dữ liệu liên quan (PostGIS + Leaflet/MapLibre).

## 4. Wireframe ASCII cho các màn hình quan trọng

Dưới đây là các wireframe ở dạng ASCII để định hình bố cục nhanh cho 5 màn hình chính. Mọi bảng điều khiển và form sẽ áp dụng các thành phần UI chuẩn trong UI kit ở mục 6.

### 4.1 Màn hình Dashboard (Admin)

```
+-----------------------------------------------------------+
| Header: QLTTXD Admin                                         |
+----------------------+----------------------+-----------------+
| Sidebar              | Tổng quan           | Thống kê        |
| - Dashboard          | Vi phạm mới: 12      | Doanh thu: 0    |
| - Vi phạm            | Biên bản mới: 5      | Mức phạt: 45     |
| - Biên bản           | Đã xử lý: 30          |  - Xem chi tiết  |
| - Hồ sơ              | Chưa xử lý: 7         |                 |
+----------------------+----------------------+-----------------+
| Content:               | Thống kê theo ngày     | Thông tin nhanh |
|  - Cards:                |                     |                 |
|     • Vi phạm mới today   |                    |                 |
|     • Biên bản hôm nay    |                    |                 |
|     • Số vụ/gt (mục)     |                    |                 |
+-----------------------------------------------------------+
```

### 4.2 Màn hình Danh sách Vi phạm

```
+--------------------------------------------------------------+
| Header: Danh sách Vi phạm                                   |
+----------------------+-----------------+--------------+-------+
| Mã vi phạm          | Địa điểm        | Loại vi phạm | Thời  |
| VN-2024-001          | P. 12, Q.11      | Xây dựng sai  | 2 ngày |
| VN-2024-002          | P. 9, Q.2        | Cưỡng chế      | 1 ngày |
+----------------------+-----------------+--------------+-------+
| Tìm kiếm: [_____ ]  [  Lọc  ]  [  Export  ]                 |
+--------------------------------------------------------------+
| Hệ điều hành | Chi tiết | Hành động |                        |
+------------+-----------+-----------+------------------------|
```

### 4.3 Màn hình Chi tiết Vi phạm

```
+-----------------------------------------------------------+
| Vi phạm #VN-2024-001                                      |
+-----------------------------------------------------------+
| Địa điểm: P. 12, Q.11                                        |
| Loại: Xây dựng trái phép                                         |
| Mức phạt: 50 triệu đồng                                      |
| Trạng thái: Đang xác minh                                         |
+-----------------------------------------------------------+
|  Ảnh: [ảnh1.jpg] [ảnh2.jpg] [ảnh3.jpg]                   |
|  Vị trí bản đồ: [map placeholder]                          |
+-----------------------------------------------------------+
| Lịch sử xử lý:                                             |
| - 2024-07-25: Tiếp nhận                                     |
| - 2024-07-28: Xác minh                                      |
+-----------------------------------------------------------+
| Actions: [Xác minh] [Lập biên bản] [Ghi chú]                  |
+-----------------------------------------------------------+
```

### 4.4 Màn hình Lập Biên bản

```
+-----------------------------------------------------------+
| Lập Biên Bản cho Vi phạm VN-2024-001                    |
+-----------------------------------------------------------+
| Đối tượng: Nguyễn Văn A                                  |
| Vai trò: Chủ thầu                                               |
| Nội dung biên bản: ...                                   |
| Ngày: 2024-07-29                                            |
| Tài liệu đính kèm: [upload supports]                        |
+-----------------------------------------------------------+
| Nút: Xác nhận | Hủy | Lưu nháp                               |
+-----------------------------------------------------------+
```

### 4.5 Màn hình Hồ sơ người dân

```
+-----------------------------------------------------------+
| Hồ sơ: Nguyễn Văn A                                        |
+-----------------------------------------------------------+
| Điện thoại: 0908-000-000                                      |
| Địa chỉ: P. 12, Q.11                                             |
| Danh sách vi phạm: VN-2024-001, VN-2024-002                  |
+-----------------------------------------------------------+
| Hoạt động:  - Ghi chú -  - Lịch sử xử lý -                     |
+-----------------------------------------------------------+
```

> Ghi chú: trên thực tế sẽ có nhiều màn hình khác như Cấu hình hệ thống, Báo cáo thống kê, Quản trị người dùng, v.v. Các wireframe trên là khung tham khảo để đồng bộ hoá UIFamily (UI kit) và dữ liệu mô hình.

## 5. UX Flow chính

1. Báo cáo vi phạm (người dân) → 2) Cán bộ tiếp nhận xác minh ban đầu → 3) Tạo biên bản và đính kèm tài liệu → 4) Gửi quyết định xử phạt và cập nhật hồ sơ → 5) Theo dõi tiến độ khắc phục và đóng hồ sơ.
2. Quy trình duyệt/giám sát: Người quản trị xem báo cáo, lọc theo khu vực, thao tác phê duyệt biên bản, và xuất báo cáo thống kê.
3. Lưu ý: Mỗi màn hình phải có breadcrumb, điều hướng rõ ràng, và trạng thái tải khi dữ liệu đang đồng bộ.

## 6. Component/UI kit đề xuất

- Bảng dữ liệu (DataTable): phân trang, lọc chéo cột, sắp xếp, exporting.
- Form: nhập liệu nhanh, tự động validate (ràng buộc địa chỉ, định danh, ngày).
- Map picker: chọn vị trí trên bản đồ (PostGIS/Leaflet hoặc MapLibre).
- Upload ảnh/document: drag-and-drop, giới hạn kích thước, xem trước.
- Timeline trạng thái: thể hiện các giai đoạn xử lý hồ sơ.
- Thông báo/Modal: cảnh báo, xác nhận hành động.

## 7. Màu sắc, typography, icon

- Màu chủ đạo: Xanh dương đậm (#1f6feb) – nhấn mạnh các hành động chính; xanh lá (#2ecc71) cho trạng thái tốt; đỏ (#e74c3c) cho cảnh báo; xám nhạt (#f2f4f7) cho nền khi trạng thái người dùng.
- Màu nền và chữ: nền trắng (#ffffff), chữ đen (#111111) hoặc xám đậm (#1f2937) cho văn bản cơ bản; text muted (#6b7280) cho mô tả.
- Font chữ: Inter hoặc system-ui, truy cập nhanh và thân thiện với màn hình
- Icon: bộ icon đơn giản, thể hiện rõ trạng thái và hành động (ví dụ: báo cáo, map, file, người dùng).

## 8. Yêu cầu kĩ thuật và tích hợp

- Dữ liệu và logic liên quan tới vi phạm, biên bản và người dân được mô hình hoá trong cơ sở dữ liệu (PostgreSQL + PostGIS cho bản đồ).
- Frontend: React/Next.js hoặc Vue + MapLibre/Leaflet cho bản đồ.
- Auth/RBAC: Roles: citizen, officer, leader, admin; UI hiển thị tính năng phù hợp with role.
- Accessibility: alt text cho ảnh, labels cho inputs, đủ contrast, navigation via keyboard.
- Design tokens: export trong token.json để chia sẻ giữa modules.

## 9. Tham khảo và liên kết

- BRIEF.md: /workspace/ssd/qlttxd/BRIEF.md
- docs/03-dac-ta-nghiep-vu.md
- docs/01-phan-tich-phap-ly.md

Khi bạn nhận được phê duyệt, tôi sẽ chi tiết hoá từng màn hình bằng mô tả hành động, phản hồi người dùng, và các trạng thái hợp lệ.
