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

## 4. Baseline Report — ĐÃ XÁC MINH 2026-08-26 (orchestrator tự chạy lại, không dựa lời agent)

- [x] BE suite: **309/309 PASS** (0 fail — cập nhật sau FIX-BATCH-2, trước đó 290/290)
- [x] FE vitest: **112/112 PASS** (cập nhật sau FIX-BATCH-2, trước đó 107/107)
- [x] Build: **OK** (vite build thành công, cache qlttxd-mt993ymq trở đi)
- [x] Server boot + health: **OK** — endpoint là `/health` (KHÔNG phải /api/v1/health); trả `{"status":"ok","db":"connected","uptime":6,"version":"0.3.2"}`
- [x] Git sync state: sạch trừ file spec task (docs/tasks/*.txt) — đã commit định kỳ
- [x] Env drift (đo thật): .env.example có 15 biến; code đọc ~59 biến (nhiều biến là noise của thư viện: DOTENV_*, npm_*, SCARF*, ETHEREAL*). Biến NGHIÊP VỤ code đọc nhưng .env.example thiếu:
  - AUDIT_BATCH_SIZE, AUDIT_RETENTION_DAYS
  - CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL (khác với key trong DB config — cần rà có còn dùng không)
  - FRONTEND_URL, LOG_LEVEL, MAX_UPLOAD_MB, REQUEST_TIMEOUT_MS
  - PGCONNECT_TIMEOUT, PGSSLMODE, RATE_LIMIT_DISABLED, RATE_LIMIT_MAX
  - QLTTXD_DEBUG_TOKENS (cờ debug token — cần đánh giá rủi ro nếu bật ở prod)
  - TEST_ADMIN_PASSWORD

→ Ghi nhận vào sổ lỗi: DEF-004 · P3 · DOCUMENTATION · DISCOVERED · .env.example thiếu ~12 biến nghiệp vụ code đang đọc.

Ghi chú thêm từ xác minh: health trả version "0.3.2" — KHỚP package.json hiện tại (không phải hardcode cũ vì W4 đã chuyển lib/version.js đọc package.json).

Baseline = ĐẠT. Không phát hiện P0/P1 mới ở tầng nền.
