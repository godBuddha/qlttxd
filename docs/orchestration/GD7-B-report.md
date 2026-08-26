# GĐ7-B Report — Docs-sync + Deploy verify + Full suite cuối

Ngày: 2026-08-26 · Nhánh: `resolve-pending` · Task: t_7d841da3

## PHẦN 1 — DOCS-SYNC

| # | Mục | Kết quả |
|---|-----|---------|
| 1 | `.env.example` bổ sung biến thiếu (DEF-004) | ✅ Xong — `app/backend/.env.example` |
| 2 | Sửa health endpoint sai trong docs | ✅ Không còn chỗ nào sai |
| 3 | CHANGELOG mục audit remediation | ✅ Xong — mục v0.3.4 (2026-08-26) |
| 4 | Runbook: migration 001–003 không có down | ✅ Xong — `docs/07-huong-dan-van-hanh.md` mục 6, dòng 7 mới |
| 5 | ORCH-01 Baseline Report cập nhật số suite | ✅ BE 309/309, FE 112/112 |

### Chi tiết 1 — .env.example

Grep thật trong code (`app/backend`, loại trừ test/node_modules):

- Code ứng dụng đọc trực tiếp: `FRONTEND_URL` (routes/auth.js:547, default `http://localhost:5173`), `LOG_LEVEL` (utils/logger.js:4, default `info`), `RATE_LIMIT_DISABLED` (utils/rate-limit.js:7, routes/auth.js), `QLTTXD_DEBUG_TOKENS` (routes/auth.js:579, chỉ khi NODE_ENV≠production), `TEST_ADMIN_PASSWORD` (test/test-config.js).
- Đọc qua pg driver (library-level): `PGCONNECT_TIMEOUT` (default 0), `PGSSLMODE` (default prefer).
- Các biến MAX_UPLOAD_MB, AUDIT_BATCH_SIZE, AUDIT_RETENTION_DAYS, REQUEST_TIMEOUT_MS, RATE_LIMIT_MAX **không còn được code đọc** (đã chuyển Settings Center theo HC-03) — giữ nguyên ghi chú "bỏ override qua env" kèm bảng fallback thật từ code:
  upload.max_mb=10 · audit.retention_days=7300 · audit.batch_size=500 · security.request_timeout_ms=30000 · rate_limit global 100/15m, write 30, user_max 200 · pool max=20, idle=30000ms, connect=5000ms.
- Biến test/dev đưa vào mục riêng "CHỈ DÙNG KHI TEST / DEV" với cảnh báo không bật ở production.

Không bịa giá trị nào — mọi default lấy từ grep code thực tế.

### Chi tiết 2 — health endpoint

`grep -rn "api/v1/health" docs/ README.md app/README.md`: chỉ còn hit ở
`docs/orchestration/ORCH-01-discovery-baseline.md:39` (câu chữ ĐÚNG: "KHÔNG phải /api/v1/health") và file spec task `docs/tasks/*.txt` (không phải docs chính). README.md và app/README.md đều ghi đúng `/health`. → Không cần sửa.

## PHẦN 2 — DEPLOY-VERIFY

| # | Mục | Kết quả |
|---|-----|---------|
| 1 | Docker | ❌ `which docker` → NO_DOCKER — không thể xác minh docker build trong môi trường hiện tại |
| 2 | docker build backend | Bỏ qua (xem hướng dẫn bên dưới) |
| 3 | Static SQL init vs migration 008 | ✅ Khớp |
| 4 | Full suite cuối | ✅ BE 309/309 PASS · FE 112/112 PASS + build OK |

### 3 — Static check SQL

`app/db/init/03-config-tables.sql` seed `role_state_permissions` cho
`case_handler`: đúng 4 trạng thái `da_tiep_nhan, dang_khac_phuc, da_khac_phuc,
da_lap_bien_ban` — khớp ma trận chốt của `sql/migrations/008_rbac_state_matrix_fix.up.sql` (DEF-009). Cả hai idempotent.

### 4 — Suite cuối (chạy thật lần cuối)

- Backend: `node --test --test-concurrency=1` với env chuẩn runbook:
  **tests 309 · pass 309 · fail 0** (duration ~70s)
- Frontend: `vitest run`: **Test Files 24 passed (24) · Tests 112 passed (112)**;
  `npm run build`: ✅ built in 2.50s, main chunk index-q9cyqaAy.js 397.49 kB (gzip 121.34 kB), SW cache `qlttxd-mt9xqd8c`.

### Hướng dẫn khi có môi trường Docker

```bash
cd app
cp .env.example .env   # điền POSTGRES_PASSWORD, JWT_SECRET ≥32 ký tự
docker compose build   # build image backend theo app/Dockerfile + db/frontend
docker compose up -d
curl -f http://localhost/health          # kỳ vọng {"status":"ok","db":"connected",...}
curl -f http://localhost/health/ready    # readiness sau khi migration xong
```

## ACCEPTANCE CHECKLIST

1. [x] `.env.example` đủ biến thiếu + comment tiếng Việt, không bịa giá trị
2. [x] Không còn "api/v1/health" sai trong docs chính
3. [x] CHANGELOG có mục audit remediation (v0.3.4)
4. [x] Suite cuối BE+FE PASS với số liệu rõ: 309/309 và 112/112
5. [x] Docker: ghi rõ không xác minh được (NO_DOCKER) + hướng dẫn đầy đủ

## Phát hiện khác

Không phát hiện bug mới ở tầng docs/deploy. Không sửa code BE/FE.
