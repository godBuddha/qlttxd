# Kết quả kiểm thử backend QLTTXD

Ngày kiểm thử: 2026-08-02

## Phạm vi đã triển khai

- Xác thực JWT: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- RBAC từ các bảng `users`, `roles`, `permissions`, `user_roles`, `role_permissions`; middleware Bearer authentication và kiểm tra quyền.
- Danh mục công khai: loại vi phạm, hành vi, mức phạt, quận/huyện, phường/xã.
- Báo cáo vi phạm có multipart ảnh (`anh`, tối đa 5), PostGIS Point 4326, tự dò quận/phường bằng `ST_Contains`, mã `BC-YYYY-xxxxxx`, và tệp đính kèm.
- Hồ sơ xử lý: tạo từ báo cáo hoặc nhập tay, tạo người vi phạm, mã `HS-YYYY-xxxxxx`, lọc/phân trang, chi tiết và chuyển trạng thái hợp lệ.
- Biên bản, quyết định (tính khung phạt và giảm 1/2 cho cá nhân), khắc phục hậu quả và cập nhật trạng thái hồ sơ.
- Thống kê tổng quan theo trạng thái, quận/huyện và tháng.
- Audit log cho đăng nhập, tạo/cập nhật dữ liệu nghiệp vụ.

## Lệnh đã chạy

```sh
cd /workspace/ssd/qlttxd/app/backend
env PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres \
  JWT_SECRET=test-secret-that-is-long-enough-for-jwt \
  UPLOAD_DIR=/tmp/qlttxd-test-uploads \
  /workspace/ssd/toolchain/node/bin/node --test test/server.test.js
```

## Kết quả end-to-end (backend chạy thật trên port 3101 trong test)

| Bước | Kết quả |
|---|---|
| Đăng nhập admin đúng / sai | 200 cùng JWT có quyền `case.update`; mật khẩu sai 401 |
| Tạo báo cáo | 201, có mã `BC-YYYY-xxxxxx`, Point PostGIS trả `{lat,lng}` |
| Tạo hồ sơ từ báo cáo | 201, có mã `HS-YYYY-xxxxxx` |
| Chuyển trạng thái | 200, `cho_tiep_nhan` → `cho_xac_minh` |
| Lập biên bản | 201, hồ sơ thành `da_lap_bien_ban` |
| Ban hành quyết định | 201, tính được số tiền phạt và hồ sơ thành `da_ra_quyet_dinh` |
| Tạo/cập nhật khắc phục | 201/200, hoàn tất chuyển hồ sơ thành `da_khac_phuc` |
| Thống kê tổng quan | 200, có các mảng theo trạng thái/quận/tháng |

Kết quả runner: **3 passed, 0 failed**.

## Lỗi gặp phải và cách xử lý

- PostgreSQL báo `inconsistent types deduced for parameter $1` trong biểu thức `CASE` của API cập nhật khắc phục. Đã ép kiểu `$1::varchar` trong cả phép gán và so sánh.
- Lệnh khởi chạy server nền bị môi trường Hermes chặn do cơ chế bảo vệ gateway. Bộ kiểm thử tích hợp vẫn khởi tạo Express thật, lắng nghe `127.0.0.1:3101`, gọi API qua `fetch`, và kết nối PostgreSQL/PostGIS thật qua socket `/tmp`.
- Review độc lập yêu cầu siết kiểm tra trạng thái trước khi lập biên bản. API hiện chỉ chấp nhận lập biên bản ở trạng thái `cho_lap_bien_ban`; kiểm thử đã đi qua đầy đủ các chuyển đổi trước bước này.

## Hạn chế vận hành

- Mã tuần tự `BC`/`HS`/`BB`/`QD` được cấp phát bằng PostgreSQL sequence qua hàm `next_business_code`, loại bỏ race condition `COUNT + 1`. Sequence có thể tạo khoảng trống sau rollback/lỗi request, nhưng không tạo mã trùng — đây là hành vi chấp nhận được cho mã định danh nghiệp vụ.
- Boundary trong `sql/seed.sql` là hình chữ nhật **giả lập** để kiểm thử `ST_Contains`, không phải ranh giới hành chính/pháp lý. Production phải nạp nguồn GIS có thẩm quyền và được phê duyệt.

## Hardening DB và migration readiness (2026-08-02)

Đã kiểm chứng trên PostgreSQL 16.14/PostGIS 3.6.3 thật qua socket `/tmp`:

- `bash sql/setup-db.sh qlttxd` tái tạo sạch schema + seed trên database test rỗng; script in cảnh báo xoá dữ liệu, validate tên DB và từ chối reset `qlttxd_prod` nếu không có opt-in rõ ràng.
- `sql/verify-db.sql` PASS: PostgreSQL >=16, PostGIS, 19 bảng, FK, 3 GiST index, 4 geometry columns SRID 4326, `MultiPolygon`, `ST_Contains` seed point, 6 quận, 12 phường và 5 user demo.
- `node --test test/server.test.js` PASS: 3/3 test, gồm luồng tạo báo cáo/hồ sơ/biên bản/quyết định/khắc phục với mã sequence.
- `sql/migrations/001_atomic_business_codes.up.sql` và `.down.sql` đã được chạy apply → rollback → apply lại trên `qlttxd`; migration ghi version vào `schema_migrations`, căn sequence sau mã đã tồn tại và có rollback tường minh.

Quy trình production: backup đã được kiểm chứng → deploy backend tương thích → apply migration `.up.sql` bằng user migration → chạy `verify-db.sql` (trừ sequence check nếu không muốn tiêu thụ một giá trị) → chỉ sau đó mở traffic. Không chạy `setup-db.sh` cho production.
