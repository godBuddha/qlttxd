# QLTTXD — Hệ thống Quản lý Trật tự Xây dựng

## Tổng kết giai đoạn 1: Nghiên cứu + Thiết kế (hoàn thành 2026-08-02)

Team Hermes Agent 4 profiles (orchestrator / researcher / writer / coder) đã hoàn thành 6 task trên Kanban board, tạo đầy đủ bộ tài liệu nghiên cứu, đặc tả, thiết kế và khung mã nguồn ban đầu.

### Sản phẩm đã bàn giao

| Task | Profile      | Kết quả                                                                                                                              | File                                                                   |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| T1c  | orchestrator | Phân tích pháp lý: nhóm hành vi vi phạm, khung phạt, thẩm quyền, thời hiệu, quy trình Điều 81                                        | `docs/01-phan-tich-phap-ly.md` (33KB)                                  |
| T2   | researcher   | Quy trình nghiệp vụ end-to-end, trạng thái hồ sơ, RBAC, tham khảo OSS (Ushahidi, FixMyStreet, QGIS...)                               | `docs/02-quy-trinh-nghiep-vu.md` (6KB)                                 |
| T3   | writer       | Đặc tả nghiệp vụ: 10 use cases, 18 FR, 8 NFR, ràng buộc pháp lý                                                                      | `docs/03-dac-ta-nghiep-vu.md` (24KB)                                   |
| T4   | orchestrator | Thiết kế CSDL chi tiết + schema PostgreSQL 16/PostGIS thực thi được (19 bảng, seed theo Điều 16 NĐ16/2022)                           | `docs/04-thiet-ke-csdl.md` (27KB) + `sql/schema.sql` (31KB)            |
| T5   | writer       | Thiết kế giao diện: sitemap, wireframe ASCII, UX flow, UI kit                                                                        | `docs/05-thiet-ke-giao-dien.md` (10KB)                                 |
| T6   | coder        | Scaffold chạy được: backend Express 5 + pg (API /health, /api/v1/reports), frontend Vite + React + Leaflet, docker-compose (postgis) | `app/` (backend, frontend, db, docker-compose.yml, README.md, TODO.md) |

### Xác minh chất lượng

- Tất cả tài liệu UTF-8 chuẩn, tiếng Việt có dấu, 0 ký tự lỗi.
- `sql/schema.sql` đã test trên PostgreSQL 16 thực tế: cú pháp đúng, lỗi duy nhất khi test là thiếu extension PostGIS trong toolchain (môi trường test); khi chạy với image `postgis/postgis` (docker-compose) sẽ chạy sạch từ đầu đến cuối.
- Code T6 được review: cú pháp JS hợp lệ, package.json chuẩn.

### Ghi chú vận hành team

- Researcher/writer dùng gpt-5-nano: không đạt với nhiệm vụ phân tích pháp lý dài (lần chạy đầu file 01 lỗi encoding; lần 2 chép nhầm BRIEF). Giải pháp: giao lại cho orchestrator (deepseek-v4-flash) → chất lượng cao (33KB, đúng cấu trúc).
- Coder (pareto-code, min_coding_score 0.5) tự block task cần review (`review-required`) → orchestrator review thủ công rồi `unblock` + `complete`.

### Bước tiếp theo (xem `app/TODO.md`)

1. Cài PostGIS cho toolchain (hoặc dùng docker-compose) + chạy `sql/schema.sql`
2. Migration (node-pg-migrate / Knex), module auth JWT + RBAC
3. Module biên bản, quyết định xử phạt, theo dõi khắc phục (theo `docs/03` FR-xx)
4. Bản đồ GIS: truy vấn ST_* quanh vị trí vi phạm
5. Triển khai: systemd/docker-compose production, sao lưu, audit log
