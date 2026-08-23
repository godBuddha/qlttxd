# Phase 2 — Classification (A / B / C / D / E)

Quy ước:
- **A — Infrastructure (.env only):** secret/kết nối vật lý. Không bao giờ qua UI, không vào DB.
- **B — Runtime (DB):** admin đổi được lúc chạy, áp dụng toàn hệ thống.
- **C — System (Settings UI):** cấu hình hiển thị/tổ chức, có thể per-user/workspace.
- **D — Developer:** build/CLI/debug, không dành cho end-user.
- **E — Không cấu hình:** hardcode là đúng. Phải kèm lý do.

## 2.1 Bảng phân loại toàn bộ

| # | Mục | Hiện tại | Nơi nên ở | Lý do |
|---|---|---|---|---|
| 1 | POSTGRES_PASSWORD | .env | **A** | Secret vật lý DB |
| 2 | JWT_SECRET | .env (+fallback random) | **A** | Secret ký token; fallback chỉ cho dev/test |
| 3 | SMTP_PASS | .env | **A** | Secret |
| 4 | PGHOST/PORT/DB/USER/PASSWORD, DATABASE_URL | .env | **A** | Kết nối vật lý |
| 5 | UPLOAD_DIR | .env | **A** | Đường dẫn mount volume |
| 6 | PORT/HOST backend | .env | **A** | Binding mạng container |
| 7 | TRUST_PROXY | .env | **A** | Topology mạng |
| 8 | DOMAIN, HTTP_PORT, HTTPS_PORT | .env → Caddy | **A** | Infra TLS |
| 9 | LOG_LEVEL | .env | **A/D** | Vận hành; có thể nâng lên B sau nếu cần đổi nóng |
| 10 | NODE_ENV | env | **D** | Chuẩn Node runtime |
| 11 | RATE_LIMIT_DISABLED | env | **D/E test-only** | Chỉ tồn tại nhánh test; cấm set production (thêm check fail-fast nếu NODE_ENV=production) |
| 12 | QLTTXD_DEBUG_TOKENS | env | **D** | Debug; phải bị chặn khi production |
| 13 | rate_limit.* (6 key) | DB seed + env override rải rác | **B** | Đổi theo tải, không restart |
| 14 | auth.jwt_access_ttl / jwt_refresh_ttl / sse_token_ttl | DB ✅ nhưng SQL insert `interval '7 days'` hardcode | **B** | HC-01: phải đọc cùng một nguồn |
| 15 | auth.bcrypt_rounds | DB ✅ | **B** | Lưu ý: chỉ áp dụng khi *hash mới*; ghi chú trong UI |
| 16 | cookie.max_age_ms / same_site | DB ✅ | **B** | |
| 17 | pool.* | DB ✅ | **B** | Cảnh báo UI: đổi max cần restart pool để có hiệu lực đầy đủ |
| 18 | security.request_timeout_ms, cors_max_age, forced_shutdown_ms | DB ✅ | **B** | |
| 19 | security.hsts_max_age | DB ✅ nhưng Caddyfile hardcode riêng | **B (backend) + A (Caddy)** | Ghi chú rõ ranh giới: header HSTS do Caddy chặn trước |
| 20 | upload.max_mb, body_limit_json/url | DB ✅ + env override MAX_UPLOAD_MB | **B** | Bỏ env override sau khi migrate |
| 21 | cleanup.* (5 key) | DB ✅ | **B** | |
| 22 | notification.worker_* | DB ✅ | **B** | |
| 23 | sse.* (3 key) | DB ✅ | **B** | |
| 24 | pagination.* (6 key) | DB ✅ | **B** | |
| 25 | audit.retention_days/batch_size/archive_dir/interval_ms | DB ✅ + env override | **B** | |
| 26 | ui.home_lat/home_lng | DB seed nhưng **không consumer** | **B** | HC-02: frontend Map phải đọc |
| 27 | ui.language / theme | DB seed | **C** | Per-user override; global = default |
| 28 | workflow_states (15) | Code + DB song song | **B (source of truth = DB)** | Code chỉ giữ fallback khởi động |
| 29 | workflow_transitions | Code Object.freeze + DB | **B** | Như trên |
| 30 | role_state_permissions | Code ROLE_PERMISSIONS + DB | **B** | Như trên |
| 31 | AUDIT_TABLES/LABELS/ACTIONS/LABELS (FE) | constants.js | **E** hiện tại → **C** khi đa ngôn ngữ | Là nhãn tiếng Việt của UI |
| 32 | STATE_LABELS (FE/BE) | Code | **E (fallback)** — display name chính nằm ở `workflow_states.label` | Tránh 3 nguồn sự thật |
| 33 | BUSINESS_CODE_SEQUENCES (BE) | Object.freeze | **E** | Format mã hồ sơ là nghiệp vụ pháp lý cố định (NĐ16); đổi = phá dữ liệu cũ |
| 34 | API_BASE (VITE_API_BASE_URL) | build-time env | **D/A** | Build artifact |
| 35 | VITE_PROXY_TARGET | vite.config | **D** | Dev-only |
| 36 | SW cache version | tự sinh build | **D/E** | Không bao giờ cấu hình tay |
| 37 | CORS_ORIGIN | .env | **A** | Bảo mật origin list |
| 38 | FRONTEND_URL | .env | **A** | Dùng tạo link email |
| 39 | SMTP_HOST/PORT/USER | .env | **A** (secret user/pass) + **B** (host/port/port optional) | Khuyến nghị: tách smtp.enabled/host/port sang B khi bật email |
| 40 | Magic numbers còn lại (interval '7 days' ×3) | routes/auth.js | ❌ **Bug** → **B** | HC-01 |

## 2.2 Danh mục E chi tiết — vì sao KHÔNG được cấu hình

1. **BUSINESS_CODE_SEQUENCES** — định dạng `ma_ho_so` gắn với quy định hồ sơ địa bàn/năm; thay đổi làm vỡ tính duy nhất và truy vết văn bản pháp lý.
2. **Enum trạng thái trong SQL CHECK constraint** — schema-level integrity; thêm trạng thái = migration mới có review, không phải click UI.
3. **Magic-byte whitelist cứng trong upload validator (JPEG/PNG/GIF/WebP)** — an ninh nội dung; danh sách mở rộng phải đi qua review bảo mật + migration `allowed_mime_types`, không phải toggle nhanh.
4. **Fallback random JWT_SECRET** — chỉ tồn tại để test không crash; bắt buộc warn log + cấm khi NODE_ENV=production (fail-fast).
5. **SW cache versioning** — cơ chế chống stale cache; cấu hình tay sẽ phá chính mục đích.
6. **Nhãn ngôn ngữ tiếng Việt mặc định (labels)** — bản thân text label không phải "config" cho hệ đơn ngữ; khi có yêu cầu đa ngôn ngữ sẽ chuyển sang i18n resource (lớp C), không phải system_config.

## 2.3 Ánh xạ nhóm AI trong đề bài → QLTTXD

| Nhóm trong đề bài | Trạng thái QLTTXD | Quyết định thiết kế |
|---|---|---|
| Providers / Model Routing / Temperature / Top-P / Max Token / Fallback Models / Vision / Audio / OCR / Translation / Embedding / Reranker / RAG / Vector DB / Chunking / MCP / Function Calling / Agent Registry / Prompt Library | **Không tồn tại** | N/A — loại khỏi phạm vi; giữ chỗ trống IA (section "Nâng cao – tương lai", disabled) nếu sau này bổ sung |
| Redis / Cache TTL / Queue / Worker Count | Không có Redis; queue = bảng `notifications` + worker poll | Chỉ cấu hình B phần worker_poll_interval_ms (đã có). Cache section: N/A |
| S3 / MinIO | Không có | N/A — Storage section chỉ gồm UPLOAD_DIR (A) + max_mb (B) |
| OAuth / Telegram / Slack / Discord | Không có | Giữ dạng *khe cắm* trong thiết kế IA (disabled cards), không sinh config giả |
| Feature Flags / Experimental | Chưa có bảng | Thiết kế mới: category `features` (B) — xem 04 §Gap-3 |
