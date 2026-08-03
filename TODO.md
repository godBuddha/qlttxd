# TODO hoàn thiện QLTTXD

## Ưu tiên trước khi triển khai thật

- [ ] Hợp nhất bootstrap `db/init/001_reports.sql` với `sql/schema.sql` sau khi thiết kế CSDL chính thức có sẵn; dùng migration có version, rollback và dữ liệu seed.
- [ ] Mô hình hóa đầy đủ hồ sơ, đối tượng vi phạm, ảnh/tài liệu, phân công, lịch sử trạng thái, biên bản, quyết định xử phạt, khắc phục, khiếu nại và audit log.
- [ ] Cài PostGIS chuẩn, SRID 4326, chỉ mục GIST và các truy vấn GIS (lọc trong ranh giới hành chính, bán kính, clustering, thống kê theo khu vực).
- [ ] Xây JWT: đăng ký/đăng nhập/refresh/revoke, bcrypt, rate limit, reset mật khẩu và MFA phù hợp.
- [ ] Áp dụng RBAC/least privilege cho `citizen`, `intake_officer`, `inspector`, `manager`, `admin`; kiểm soát cả API lẫn giao diện.
- [ ] Bổ sung workflow có kiểm soát chuyển trạng thái: tiếp nhận → xác minh → lập biên bản → phê duyệt quyết định → theo dõi khắc phục → đóng; ghi audit bất biến cho mọi thay đổi.
- [ ] Xây module biên bản và quyết định: mẫu biểu, số văn bản, phê duyệt/chữ ký số, PDF, thông báo và theo dõi giao nhận.
- [ ] Đưa upload vào lớp dịch vụ: MIME magic-byte, antivirus, giới hạn quota, tên tệp an toàn, xóa tệp mồ côi; chuyển MinIO self-host khi scale.
- [ ] Không công khai `/uploads`: dùng quyền truy cập theo hồ sơ, URL ký hoặc streaming có xác thực.

## Sản phẩm và vận hành

- [ ] Hoàn thiện danh sách/tìm kiếm/lọc báo cáo, chi tiết hồ sơ, phân công cán bộ, timeline và trang dashboard thống kê.
- [ ] Thêm lớp bản đồ: ranh giới hành chính, cụm điểm, lọc theo thời gian/trạng thái/loại vi phạm; thay tile demo bằng nhà cung cấp/tile server được phép self-host.
- [ ] Tạo báo cáo CSV/PDF/GIS, phân quyền xuất dữ liệu và che dữ liệu cá nhân khi cần.
- [ ] Viết OpenAPI, validation request (Zod/Joi hoặc JSON Schema), chuẩn hóa mã lỗi, phân trang/cursor và logging có cấu trúc.
- [ ] Thêm test unit, integration với PostGIS, E2E cho các vai trò; đưa test/lint/security scan vào CI.
- [ ] Thiết lập backup PostgreSQL + object storage, kiểm thử restore, retention, mã hóa secret và giám sát/alerting.
- [ ] Tách cấu hình dev/staging/prod, reverse proxy TLS, CSP/CORS, rate limiting, quản lý secret; không dùng mật khẩu mặc định Docker.
- [ ] Rà soát Nghị định 16/2022/NĐ-CP, thẩm quyền và biểu mẫu cùng đơn vị nghiệp vụ/pháp chế trước khi tự động hóa quyết định xử phạt.
