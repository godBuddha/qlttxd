# ORCH-01 — Phát hiện & Kiểm toán Nền tảng (Discovery + Baseline)

Mục tiêu: xác định trạng thái THỰC của dự án trước khi sửa bất cứ gì. Không tin giả định.

## 1. Khám phá hạ tầng (đã kiểm chứng 2026-08-25)

- Workspace: /workspace/ssd · Repo: /workspace/ssd/qlttxd (git → github.com/godBuddha/qlttxd)
- Nhánh làm việc: resolve-pending; master = bản ổn định; mỗi wave xong merge qua
- Backend: Node.js v24.18.1 + Express, tại app/backend (290 test đơn vị, --test-concurrency=1)
- Frontend: React 19 + Vite + Leaflet, tại app/frontend (107 test vitest)
- DB: PostgreSQL 16.14 user-space tại toolchain/pgdata, socket /tmp:5432, database qlttxd
- Migrations: sql/migrations/ (007 mới nhất) + app/db/init cho Docker deploy
- Triển khai: Docker (Caddyfile edge + docker-compose.yml) + script update
- Điều phối: Hermes v0.20.5 Kanban, profiles coder/orchestrator/researcher/writer/security/deployment

## 2. Trạng thái khởi đầu (baseline)

- Commit nền: 7fb1d3e (Settings Center hoàn tất 5 wave)
- Tests nền: FE 107/107 · BE 290/290 · build OK
- Tính năng lõi đã xác minh các đợt trước: đăng nhập JWT + RBAC 27 quyền, hồ sơ vi phạm với máy trạng thái 15 bước, biên bản/quyết định/khắc phục, thông báo SSE, nhật ký audit có retention, xuất dữ liệu, bản đồ
- Nợ đã biết (chưa xử lý):
  - N1: PUT /workflow/states/:code chưa có → trang shell v2 chỉ xem được (Wave 3 ghi nhận)
  - N2: PUT mime-types is_active chưa có → toggle sẽ rollback khi lỗi (Wave 3 ghi nhận)
  - N3: HSTS_MAX_AGE cần đặt env khi deploy thật (mặc định 1 năm)

## 3. Việc phải làm trong giai đoạn này

1. Chạy lại toàn bộ kiểm tra nền để xác nhận baseline còn đúng (không tin số cũ): BE full suite, FE vitest, build, DB migrate check, server boot + /health
2. Liệt kê cây thư mục hiện hành: routes, services, middleware, jobs, migrations, frontend routes/pages/components
3. Đối chiếu nhánh resolve-pending vs master vs origin (không lệch nhánh, không unpushed)
4. Rà .env.example vs code thực dùng (biến nào docs có mà code bỏ, biến nào code đọc mà docs thiếu)
5. Ghi BASELINE REPORT vào file này (phần dưới) — mọi con số lấy từ lần chạy thực

## 4. Baseline Report (điền sau khi chạy)

- [ ] BE suite: __/__
- [ ] FE vitest: __/__
- [ ] Build: OK/FAIL
- [ ] Server boot + health: OK/FAIL
- [ ] Git sync state: clean/dirty
- [ ] Env drift: danh sách

(ORCHESTRATOR tự chạy lệnh và điền — không chấp nhận ghi "theo tài liệu cũ")
