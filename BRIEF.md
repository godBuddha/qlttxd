# DỰ ÁN: Hệ thống Quản lý Trật tự Xây dựng (QLTTXD)

## 1. Mô tả tổng quan

Xây dựng **hệ thống phần mềm mã nguồn mở, tự self-host** để quản lý trật tự xây dựng
cho chính quyền địa phương (phường/xã/quận/huyện). Hệ thống giúp:

- Người dân **báo cáo vi phạm trật tự xây dựng** kèm **ảnh** và **vị trí trên bản đồ**.
- Cán bộ địa chính - xây dựng **tiếp nhận, xác minh, lập biên bản, xử lý** theo
  quy định pháp luật (Nghị định 16/2022/NĐ-CP).
- Lãnh đạo **theo dõi, giám sát, thống kê** tình hình vi phạm trên địa bàn.
- **Phân quyền người dùng** rõ ràng (công dân / cán bộ / lãnh đạo / quản trị).

## 2. Các tài liệu pháp lý (đã có sẵn trong `taplieu/`)

| File                          | Nội dung                                         | Vai trò               |
| ----------------------------- | ------------------------------------------------ | --------------------- |
| `taplieu/ND50-xaydung.md`     | Luật Xây dựng 50/2014/QH13                       | Nền tảng              |
| `taplieu/ND62.md`             | Luật sửa đổi bổ sung 62/2020/QH14                | Nền tảng              |
| `taplieu/ND15-2021.md`        | Nghị định 15/2021 (quản lý dự án, GPXD)          | Thủ tục               |
| `taplieu/ND15-2021-phuluc.md` | Phụ lục + mẫu văn bản NĐ 15                      | Mẫu biểu              |
| `taplieu/ND16-2022.md`        | **Nghị định 16/2022 — Xử phạt VPHC về xây dựng** | **Cốt lõi nghiệp vụ** |

## 3. Yêu cầu cốt lõi (theo chủ đầu tư)

1. **Mã nguồn mở + tự self-host** (không phụ thuộc cloud bên thứ ba).
2. **Phân quyền người dùng** (RBAC): công dân, cán bộ tiếp nhận, cán bộ xác minh,
   lãnh đạo, quản trị hệ thống.
3. **Bản đồ** đánh dấu vị trí vi phạm (GIS/PostGIS + Leaflet/MapLibre).
4. **Gửi ảnh hoạt động vi phạm** (tải ảnh lên, lưu trữ, xem lại, đính kèm hồ sơ).
5. Quy trình xử lý: tiếp nhận → xác minh → lập biên bản → ra quyết định xử phạt →
   theo dõi khắc phục (tháo dỡ/cưỡng chế) → đóng hồ sơ.
6. Thống kê, báo cáo cho lãnh đạo.

## 4. Công việc cần team thực hiện (thứ tự)

| #   | Profile    | Đầu ra                                                                               | File                                          |
| --- | ---------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| T1  | researcher | Phân tích pháp lý: nhóm hành vi vi phạm, khung phạt, biện pháp khắc phục, thẩm quyền | `docs/01-phan-tich-phap-ly.md`                |
| T2  | researcher | Quy trình nghiệp vụ đầy đủ + vai trò + tham khảo OSS tương tự                        | `docs/02-quy-trinh-nghiep-vu.md`              |
| T3  | writer     | Đặc tả nghiệp vụ (actors, use cases, yêu cầu chức năng/phi chức năng)                | `docs/03-dac-ta-nghiep-vu.md`                 |
| T4  | writer     | Thiết kế CSDL (ERD + schema PostgreSQL/PostGIS)                                      | `docs/04-thiet-ke-csdl.md` + `sql/schema.sql` |
| T5  | writer     | Thiết kế giao diện (sitemap, wireframe, UX flow)                                     | `docs/05-thiet-ke-giao-dien.md`               |
| T6  | coder      | Khung dự án (cấu trúc thư mục, stack đề xuất, scaffold)                              | `app/`                                        |

## 5. Stack đề xuất (định hướng, có thể điều chỉnh)

- Backend: Node.js (Express/Fastify) **hoặc** Python (FastAPI)
- Database: PostgreSQL 16 + PostGIS (có sẵn toolchain trong workspace)
- Frontend: React/Next.js hoặc Vue + Leaflet/MapLibre GL
- Auth/RBAC: tự xây dựng hoặc Keycloak (self-host)
- Lưu ảnh: filesystem/object storage self-host (MinIO)

## 6. Nguyên tắc làm việc

- Đọc kỹ tài liệu trong `taplieu/` trước khi viết.
- Mọi tài liệu viết bằng **tiếng Việt**, rõ ràng, có cấu trúc heading.
- Ghi đúng đường dẫn file output như bảng ở mục 4.
- Không tạo file ngoài phạm vi đã giao.
