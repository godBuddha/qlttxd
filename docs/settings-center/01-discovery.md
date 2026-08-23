# Phase 1 — Configuration Discovery

> Kết quả quét tĩnh thực tế trên codebase tại commit `e916328`. Mọi con số dưới đây đều truy vết được bằng lệnh grep kèm theo.

## 1.1 Environment Variables (backend)

Lệnh kiểm chứng:
```bash
grep -rn "process.env" app/backend --include="*.js" | grep -v node_modules | grep -v test
```

### Nhóm Database/Infra (hợp lệ — lớp A)

| # | Biến | Vị trí tiêu thụ | Ghi chú |
|---|---|---|---|
| 1 | `PGHOST` | server.js (createPool, config-service notify client), test helpers ×3 | Unix socket `/tmp` được dùng ở dev |
| 2 | `PGPORT` | server.js ×2 | |
| 3 | `PGDATABASE` | server.js ×2 | |
| 4 | `PGUSER` | server.js ×2 | |
| 5 | `PGPASSWORD` | server.js ×2 | |
| 6 | `DATABASE_URL` | config-service.js (notify DSN) | Ưu tiên hơn PG* khi có |
| 7 | `JWT_SECRET` | utils/helpers.js (`secret()`), fallback random 32 byte | Lớp A bắt buộc |
| 8 | `NODE_ENV` | 6 vị trí (log level, error stack, cookie secure) | Chuẩn Node, giữ nguyên |
| 9 | `UPLOAD_DIR` | upload.js ×2 | Đường dẫn vật lý → env |

### Nhóm cần di chuyển sang DB (lớp B) — đang là env

| # | Biến | Vị trí | Key DB tương ứng (đÃ CÓ trong system_config) |
|---|---|---|---|
| 10 | `MAX_UPLOAD_MB` | upload.js | `upload.max_mb` ✅ seed rồi |
| 11 | `AUDIT_RETENTION_DAYS` | server.js, audit-retention.js | `audit.retention_days` ✅ |
| 12 | `AUDIT_BATCH_SIZE` | audit-retention.js | `audit.batch_size` ✅ |
| 13 | `RATE_LIMIT_MAX` | routes/auth.js (forgot limiter) | `rate_limit.forgot_max` ✅ |
| 14 | `REQUEST_TIMEOUT_MS` | server.js | `security.request_timeout_ms` ✅ |

→ Đây là **điểm nghẽn thiết kế hiện tại**: env override DB, nên admin sửa trong Settings không có hiệu lực nếu .env còn set giá trị. Xem 03-HC-01.

### Nhóm dev/test-only (không đưa vào Settings)

`RATE_LIMIT_DISABLED`, `QLTTXD_DEBUG_TOKENS`, `JWT_SECRET` fallback `'qlttxd-secret-key-2026-min32chars'` (chỉ nhánh test), `npm_package_version`.

### Nhóm SMTP / thông báo

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL` — notification email. **Chưa có key DB** cho SMTP host/port; chỉ có channel `email` với flag `smtp_configured`. → cần bổ sung category `smtp.*` nếu bật email thật (xem 04 §Gap).

### Nhóm CORS/Server

`PORT`, `HOST`, `TRUST_PROXY`, `CORS_ORIGIN`, `LOG_LEVEL`, `DOMAIN` — lớp Infra hợp lệ.

## 1.2 Database `system_config` (đã seed — 53 key / 12 category)

Lệnh kiểm chứng: `grep -c "^('global'" sql/migrations/005_system_config.up.sql`

| Category | Số key | Ví dụ key | Backend đọc? | Frontend đọc? |
|---|---|---|---|---|
| auth | 5 | jwt_access_ttl, jwt_refresh_ttl, sse_token_ttl, bcrypt_rounds, reset_token_expiry_ms | ✅ | — |
| rate_limit | 6 | global_window_ms, global_max, write_max, user_max, auth_max, forgot_max | ✅ | — |
| cookie | 5 | max_age_ms, same_site, http_only_refresh… | ✅ | — |
| pool | 3 | max, idle_timeout_ms, connect_timeout_ms | ✅ | — |
| security | 4 | request_timeout_ms, hsts_max_age, cors_max_age, forced_shutdown_ms | ✅ | — |
| upload | 3 | max_mb, body_limit_json, body_limit_url | ✅ | — |
| cleanup | 5 | token_blocklist_interval_ms, reset_token_interval_ms… | ✅ | — |
| notification | 2 | worker_batch_size, worker_poll_interval_ms | ✅ | — |
| sse | 3 | heartbeat_ms, poll_ms, poll_limit | ✅ | — |
| pagination | 6 | users_default/max, ban_do_default/max, notifications_default/max | ✅ | — |
| audit | 4 | retention_days, batch_size, archive_dir, interval_ms | ✅ | — |
| ui | 4 | home_lat, home_lng, language, theme | ⚠️ **KHÔNG ai đọc home_lat/lng** | ⚠️ constants.js vẫn hardcode HOME |

**Phát hiện quan trọng:** `ui.home_lat/lng` đã seed từ T2 nhưng đến T4b vẫn chưa có consumer → cấu hình "chết". Đây là finding HC-02.

## 1.3 Workflow configuration

- **15 states** nằm song song ở 3 nơi: SQL enum (`sql/schema.sql`), backend `utils/constants.js` (Set + labels), frontend `lib/constants.js`. Migration 005 tạo bảng `workflow_states` seed 15 dòng.
- **Transitions matrix:** hardcoded `TRANSITIONS` Object.freeze ở cả backend lẫn frontend; DB có bảng `workflow_transitions`.
- **Role × state permissions:** hardcoded `ROLE_PERMISSIONS` trong `utils/workflow-rules.js`; DB có `role_state_permissions` (seed admin full).
- **Trạng thái di chuyển:** backend đã có `loadRolePermissions()` + fallback; frontend đã có getter động qua ConfigProvider nhưng **fallback tĩnh vẫn là nguồn sự thật khi API lỗi** (thiết kế chấp nhận được — ghi nhận).

## 1.4 Frontend

Lệnh kiểm chứng: `grep -E "^export const" app/frontend/src/lib/constants.js`

| Export | Loại giá trị | Ghi chú |
|---|---|---|
| `HOME = [21.0285, 105.8542]` | Tọa độ Hà Nội | **Hardcode chết** — DB đã có `ui.home_lat/lng` |
| `STATES`, `STATE_LABELS` | 15 mục | Có getter động `getStates(configService)` |
| `TRANSITIONS` | Object.freeze | Có `getTransitions()` |
| `AUDIT_TABLES/LABELS`, `AUDIT_ACTIONS/ACTION_LABELS` | Metadata hiển thị | Nên ở lớp E (nhãn ngôn ngữ UI) hoặc C nếu muốn đa ngôn ngữ |
| `API_BASE` (api.js) | `import.meta.env.VITE_API_BASE_URL` | Build-time, hợp lệ lớp D/A |

`vite.config.js`: proxy target từ `VITE_PROXY_TARGET`, SW cache version tự sinh — lớp D hợp lệ.

## 1.5 Infrastructure

| File | Giá trị cấu hình | Phân loại đề xuất |
|---|---|---|
| docker-compose.yml | POSTGRES_PASSWORD, JWT_SECRET, ports 80/443, volume names | A (env-only) |
| Caddyfile | DOMAIN, upstream `backend:3001`, HSTS max-age 31536000 | Infra; HSTS nên theo dõi `security.hsts_max_age` (hiện lệch: Caddy hardcode, backend đọc DB) |
| Dockerfile (backend) | healthcheck `127.0.0.1:3001/health` | E — phải khớp PORT mặc định container |
| nginx.conf | proxy_pass port 3001 | Infra (đã fix port bug trước đó) |
| .env.example ×3 | 20 biến mẫu | A/D |

## 1.6 Những thứ KHÔNG tồn tại (tránh tưởng tượng)

Đề bài gốc liệt kê nhiều nhóm thuộc hệ AI (Model Router, Temperature, Top-P, Embedding, RAG, Vector DB, MCP...). Quét thực tế: **QLTTXD không có LLM/AI pipeline** → các nhóm này đánh dấu **N/A** trong Phase 2 và loại khỏi phạm vi. Tương tự: Redis, S3/MinIO, OAuth provider, Telegram/Slack/Discord webhook — hiện không có trong code, chỉ xuất hiện như *khe mở rộng* trong thiết kế Phase 4.
