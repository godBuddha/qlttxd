# QLTTXD — COMPLETE CONFIGURATION AUDIT & SETTINGS CENTER REDESIGN

> **Bản rà soát cấu hình toàn hệ thống + Thiết kế lại Settings Center cấp doanh nghiệp**
> Phạm vi: `qlttxd/` — backend (Node.js/Express), frontend (React/Vite), SQL schema, Docker/Caddy/nginx, công cụ build.
> Không phải mã triển khai — đây là tài liệu kiến trúc để đội engineering thực thi.

---

## MỤC LỤC

1. [Phase 1 — Configuration Discovery](#phase-1)
2. [Phase 2 — Classification](#phase-2)
3. [Phase 3 — Hardcode Detection Report](#phase-3)
4. [Phase 4 — Settings Center Redesign](#phase-4)
5. [Phase 5 — UI Specification](#phase-5)
6. [Phase 6 — Implementation Roadmap](#phase-6)

---

<a id="phase-1"></a>
## PHASE 1 — CONFIGURATION DISCOVERY

### 1.1. Infrastructure / Environment Variables (`.env`)

| # | Biến | File tham chiếu | Giá trị mặc định | Mô tả |
|---|------|----------------|------------------|-------|
| 1 | `JWT_SECRET` | `utils/helpers.js:8` | random fallback (dev) | Khóa ký JWT, tối thiểu 32 ký tự |
| 2 | `PGHOST` | `server.js:214` | — | Host PostgreSQL |
| 3 | `PGPORT` | `server.js:215` | — | Port PostgreSQL |
| 4 | `PGDATABASE` | `server.js:216` | — | Tên database |
| 5 | `PGUSER` | `server.js:217` | — | User PostgreSQL |
| 6 | `PGPASSWORD` | `server.js:218` | — | Password PostgreSQL |
| 7 | `PORT` | `server.js:226` | `3000` | Port nghe backend |
| 8 | `HOST` | `server.js:227` | `0.0.0.0` | Bind address backend |
| 9 | `CORS_ORIGIN` | `server.js:59` | — (empty = no CORS) | Danh sách origin cách nhau bởi dấu phẩy |
| 10 | `TRUST_PROXY` | `server.js:58` | `1` | Số hop proxy hoặc boolean |
| 11 | `AUDIT_RETENTION_DAYS` | `server.js:53` | `7300` (20 năm) | Số ngày giữ audit log |
| 12 | `REQUEST_TIMEOUT_MS` | `server.js:178` | `30000` | Timeout toàn cục mỗi request |
| 13 | `UPLOAD_DIR` | `utils/upload.js:8` | `./uploads` | Thư mục lưu file upload |
| 14 | `MAX_UPLOAD_MB` | `utils/upload.js:20` | `10` | Kích thước tối đa mỗi file (MB) |
| 15 | `LOG_LEVEL` | `utils/logger.js:4` | `info` | debug/info/warn/error |
| 16 | `NODE_ENV` | nhiều file | — | production/development/test |
| 17 | `RATE_LIMIT_DISABLED` | `utils/rate-limit.js:4`, `auth.js:20` | `false` | Tắt rate limit toàn bộ |
| 18 | `QLTTXD_DEBUG_TOKENS` | `auth.js:21,571` | `false` | Lộ dev_token reset password |
| 19 | `RATE_LIMIT_MAX` | `auth.js:494` | `200` | Giới hạn forgot-password |
| 20 | `SMTP_HOST` | `lib/email.js:11`, `auth.js:538` | — | Host SMTP |
| 21 | `SMTP_PORT` | `lib/email.js:17` | `587` | Port SMTP |
| 22 | `SMTP_USER` | `lib/email.js:22` | — | Username SMTP |
| 23 | `SMTP_PASS` | `lib/email.js:23` | — | Password SMTP |
| 24 | `SMTP_FROM` | `lib/email.js:41` | `QLTTXD <no-reply@HOST>` | Email người gửi |
| 25 | `FRONTEND_URL` | `auth.js:539` | `http://localhost:5173` | URL frontend cho reset link |
| 26 | `VITE_API_BASE_URL` | `frontend/src/lib/api.js:1` | `''` (same-origin) | Base URL API cho frontend |
| 27 | `VITE_PROXY_TARGET` | `frontend/vite.config.js:47,51` | `http://127.0.0.1:3001` | Proxy target Vite dev |
| 28 | `HTTP_PORT` | `docker-compose.yml:49` | `80` | Port Caddy HTTP |
| 29 | `HTTPS_PORT` | `docker-compose.yml:50` | `443` | Port Caddy HTTPS |
| 30 | `DOMAIN` | `docker-compose.yml:52`, `Caddyfile:1` | `localhost` | Domain Caddy |
| 31 | `POSTGRES_PASSWORD` | `docker-compose.yml:14` | — (required) | Password DB cho Docker |

### 1.2. Hardcoded trong mã nguồn — Backend

#### 1.2.1. Connection Pool (`server.js:212-222`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| `max` | `20` | `server.js:219` |
| `idleTimeoutMillis` | `30000` (30s) | `server.js:220` |
| `connectionTimeoutMillis` | `5000` (5s) | `server.js:221` |

#### 1.2.2. Rate Limiting (`utils/rate-limit.js`, `rate-limit-user.js`, `auth.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| `windowMs` (global) | `15 * 60 * 1000` (15 phút) | `rate-limit.js:9` |
| `max` (global) | `100` | `rate-limit.js:17` |
| `max` (write) | `30` | `rate-limit.js:18` |
| `max` (user) | `200` | `rate-limit-user.js:9` |
| `windowMs` (user) | `15 * 60 * 1000` | `rate-limit-user.js:8` |
| `max` (auth/login) | `10` | `auth.js:25` |
| `windowMs` (auth) | `15 * 60 * 1000` | `auth.js:24` |
| `max` (forgot-password) | `200` (from env) | `auth.js:494` |
| `standardHeaders` | `true` | `rate-limit.js:11` |
| `legacyHeaders` | `false` | `rate-limit.js:12` |

#### 1.2.3. JWT / Token (`auth.js`, `thong-bao.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| Access token `expiresIn` | `'5m'` (5 phút) | `auth.js:159,244,338` |
| Refresh token `expiresIn` | `'7d'` (7 ngày) | `auth.js:167,252,346` |
| SSE token `expiresIn` | `'60s'` | `thong-bao.js:20` |
| Cookie `maxAge` | `7 * 24 * 60 * 60 * 1000` (7 ngày) | `auth.js:182,191,267,276,361,370` |
| Cookie `sameSite` | `'lax'` | `auth.js:181,190,266,275,360,369` |
| Cookie `httpOnly` (refresh) | `true` | `auth.js:179,264,358` |
| Cookie `httpOnly` (CSRF) | `false` | `auth.js:188,273,367` |
| Cookie `path` | `'/'` | `auth.js:183,192,268,277,362,371` |
| Reset token expiry | `15 * 60 * 1000` (15 phút) | `auth.js:527` |
| bcrypt rounds | `10` | `auth.js:138,413,602`; `admin-users.js:69,194` |

#### 1.2.4. Cleanup Jobs / Intervals
| Module | Thông số | Giá trị | Vị trí |
|--------|----------|---------|--------|
| `TokenBlocklist` | CLEANUP_INTERVAL_MS | `30 * 60 * 1000` (30 phút) | `token-blocklist.js:3` |
| `TokenBlocklist` | ttlMs (JTI TTL) | `8 * 60 * 60 * 1000` (8 giờ) | `token-blocklist.js:11` |
| `ResetTokenCleanup` | CLEANUP_INTERVAL_MS | `60 * 60 * 1000` (1 giờ) | `reset-token-cleanup.js:3` |
| `UserTokensCleanup` | CLEANUP_INTERVAL_MS | `60 * 60 * 1000` (1 giờ) | `user-tokens-cleanup.js:3` |
| `UserTokensCleanup` | maxAgeDays | `30` | `user-tokens-cleanup.js:19` |
| `AuditRetention` | DEFAULT_RETENTION_DAYS | `7300` (20 năm) | `audit-retention.js:9` |
| `AuditRetention` | BATCH_SIZE | `500` | `audit-retention.js:10` |
| `AuditRetention` | ARCHIVE_DIR | `'audit_archive'` | `audit-retention.js:11` |
| `AuditRetention` | intervalMs | `24 * 60 * 60 * 1000` (24h) | `audit-retention.js:36` |
| `NotificationWorker` | BATCH_SIZE | `10` | `notification-worker.js:5` |
| `NotificationWorker` | POLL_INTERVAL_MS | `30 * 1000` (30s) | `notification-worker.js:6` |

#### 1.2.5. SSE / Notification Stream (`thong-bao.js`, `BellNotification.jsx`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| SSE heartbeat interval | `30000` (30s) | `thong-bao.js:125` |
| SSE poll interval | `5000` (5s) | `thong-bao.js:126` |
| SSE poll LIMIT | `50` | `thong-bao.js:106` |
| Poll fallback interval | `30000` (30s) | `BellNotification.jsx:50` |
| SSE retry interval | `300000` (5 phút) | `BellNotification.jsx:57` |
| Reconnect delays | `[1000, 2000, 4000]` | `BellNotification.jsx:92` |
| Max reconnect attempts | `3` | `BellNotification.jsx:91` |
| Bell dropdown limit | `15` | `BellNotification.jsx:18` |

#### 1.2.6. Express Body Limits (`server.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| JSON body limit | `'1mb'` | `server.js:87` |
| URL-encoded limit | `'10kb'` | `server.js:88` |

#### 1.2.7. Helmet / Security Headers (`server.js:142-157`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| `defaultSrc` | `["'self'"]` | `server.js:145` |
| `frameAncestors` | `["'none'"]` | `server.js:147` |
| `objectSrc` | `["'none'"]` | `server.js:148` |
| `imgSrc` | `["'self'", "https://*.tile.openstreetmap.org", "data:"]` | `server.js:149` |
| `scriptSrc` | `["'self'"]` | `server.js:150` |
| `styleSrc` | `["'self'", "'unsafe-inline'"]` | `server.js:151` |
| `baseUri` | `["'self'"]` | `server.js:146` |
| HSTS maxAge | `31536000` (1 năm) | `server.js:156` |
| HSTS includeSubDomains | `true` | `server.js:156` |
| CORS Max-Age | `86400` (24h) | `server.js:71` |
| CORS Methods | `GET,POST,PATCH,PUT,DELETE,OPTIONS` | `server.js:69` |
| CORS Headers | `Content-Type,Authorization,X-Auth-Token,X-Request-Id` | `server.js:70` |

#### 1.2.8. Upload / File Filter (`utils/upload.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| Max file size | `MAX_UPLOAD_MB * 1024 * 1024` | `upload.js:20` |
| Allowed MIME | `image/*` (any image) | `upload.js:21` |
| Magic bytes kiểm | JPEG, PNG, GIF, WEBP | `upload.js:24-37` |
| Filename pattern | `{timestamp}-{uuid}{ext}` | `upload.js:13-16` |

#### 1.2.9. Workflow / State Machine (`utils/constants.js`, `utils/workflow-rules.js`)
| Thông số | Vị trí |
|----------|--------|
| `STATES` (15 trạng thái) | `constants.js:3-19` |
| `STATE_LABELS` (15 nhãn tiếng Việt) | `constants.js:20-36` |
| `TRANSITIONS` (ma trận chuyển trạng thái) | `constants.js:37-55` |
| `BUSINESS_CODE_SEQUENCES` (BC/HS/BB/QD) | `constants.js:56-61` |
| `AUDIT_ACTIONS` (20 action codes) | `constants.js:63-96` |
| `ROLE_PERMISSIONS` (matrix role→state) | `workflow-rules.js:15-40` |
| Alias `da_xac_minh` → `cho_xac_minh` | `workflow-rules.js:58` |

#### 1.2.10. Business Code Format (`sql/schema.sql:78-84`)
| Thông số | Giá trị |
|----------|---------|
| Format | `{PREFIX}-{YYYY}-{000000}` (6 chữ số) |
| Sequence start | `1` |
| Increment | `1` |
| Cycle | `NO CYCLE` |

#### 1.2.11. Notification Pagination (`thong-bao.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| Default limit | `20` | `thong-bao.js:31` |
| Max limit | `100` | `thong-bao.js:31` |
| Min limit | `1` | `thong-bao.js:31` |

#### 1.2.12. User Pagination (`admin-users.js`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| Default limit | `50` | `admin-users.js:18` |
| Max limit | `200` | `admin-users.js:18` |

#### 1.2.13. Validation Rules (hardcoded regex/limits)
| Rule | Giá trị | Vị trí |
|------|---------|--------|
| Username length | 3-50 ký tự | `auth.js:104`, `admin-users.js:48` |
| Password min length | 8 ký tự | `auth.js:107` |
| Password complexity | chữ + số | `auth.js:110` |
| Full name max | 200 ký tự | `auth.js:114` |
| Email regex | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `admin-users.js:57`, `ho-so.js:39` |
| Phone regex | `^\d{9,11}$` | `admin-users.js:59` |
| CMND/CCCD | `^\d{9,12}$` | `ho-so.js:37` |
| SDT (người VP) | `^\d{9,11}$` | `ho-so.js:38` |
| Mô tả max | 10000 ký tự | `ho-so.js:49` |
| Ghi chú max | 5000 ký tự | `ho-so.js:51` |
| Địa chỉ max (nvp) | 1000 ký tự | `ho-so.js:40` |

#### 1.2.14. Attachment Content Types (`auth.js:430-436`)
| Thông số | Giá trị |
|----------|---------|
| `.jpg/.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |

#### 1.2.15. Geolocation (`CitizenPage.jsx`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| Max photos per report | `5` | `CitizenPage.jsx:229` |
| enableHighAccuracy | `true` | `CitizenPage.jsx:81` |
| timeout | `10000` (10s) | `CitizenPage.jsx:81` |
| maximumAge | `30000` (30s) | `CitizenPage.jsx:81` |

#### 1.2.16. DB Schema Constraints (PostgreSQL ENUM / CHECK)
| Thông số | Vị trí |
|----------|--------|
| `trang_thai_ho_so` ENUM (15 giá trị) | `schema.sql:252-268` |
| `nhom_cong_trinh` CHECK IN (1,2,3) | `schema.sql:206` |
| `bien_ban.trang_thai` CHECK | `schema.sql:328-329` |
| `quyet_dinh.trang_thai` CHECK | `schema.sql:351-352` |
| `khac_phuc.trang_thai` CHECK | `schema.sql:370-372` |
| `thong_bao.kenh` CHECK IN ('portal','email','sms') | `schema.sql:392` |
| `thong_bao.trang_thai` CHECK | `schema.sql:393-394` |
| `loai_chu_the` CHECK IN ('ca_nhan','to_chuc') | `schema.sql:241` |

#### 1.2.17. Forced Shutdown (`server.js:244-247`)
| Thông số | Giá trị |
|----------|---------|
| Force shutdown timeout | `10000` (10s) |

### 1.3. Hardcoded trong mã nguồn — Frontend

#### 1.3.1. Map / GIS (`constants.js`, `MapView.jsx`, `BanDoPage.jsx`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| `HOME` (tâm bản đồ) | `[21.0285, 105.8542]` (Hà Nội) | `constants.js:1` |
| Tile URL | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | `MapView.jsx:24`, `BanDoPage.jsx:41` |
| Tile attribution | `© OpenStreetMap contributors` | `MapView.jsx:25`, `BanDoPage.jsx:42` |
| Default zoom (point) | `16` | `MapView.jsx:22` |
| Default zoom (no point) | `12` | `MapView.jsx:22`, `BanDoPage.jsx:40` |
| Marker radius | `8` / `9` | `MapView.jsx:47`, `BanDoPage.jsx:62` |
| Marker weight | `2` | `MapView.jsx:49`, `BanDoPage.jsx:64` |
| Marker fillColor | `#1f6feb` | `MapView.jsx:50` |
| Marker fillOpacity | `1` | `MapView.jsx:51` |
| Polygon color | `#1f6feb` | `MapView.jsx:71` |
| Polygon fillOpacity | `0.15` | `MapView.jsx:71` |
| MARKER_COLORS (12 trạng thái) | 12 mã màu hex | `BanDoPage.jsx:9-22` |

#### 1.3.2. Design Tokens / CSS Variables (`styles.css:1-29`)
| Token | Giá trị | Loại |
|-------|---------|------|
| `--primary-color` | `#1f6feb` | Color |
| `--primary-hover` | `#1858bd` | Color |
| `--primary-light` | `#e7f0fe` | Color |
| `--primary-dark` | `#125ab0` | Color |
| `--text-primary` | `#172033` | Color |
| `--text-secondary` | `#667085` | Color |
| `--text-muted` | `#475467` | Color |
| `--bg-page` | `#f3f6fb` | Color |
| `--bg-surface` | `#fff` | Color |
| `--bg-header` | `#104d92` | Color |
| `--sidebar-bg` | `#fff` | Color |
| `--sidebar-width` | `244px` | Layout |
| `--border-color` | `#e3e8f0` | Color |
| `--border-light` | `#dce3ed` | Color |
| `--color-success` | `#12a55c` | Color |
| `--color-success-text` | `#17683e` | Color |
| `--color-error` | `#da3633` | Color |
| `--color-error-text` | `#b42318` | Color |
| `--color-warning` | `#9a6500` | Color |
| `--border-radius` | `7px` | Layout |
| `--border-radius-lg` | `10px` | Layout |
| Font family | `Inter, ui-sans-serif, ...` | Typography |
| Content max-width | `1460px` | Layout |
| Button min-height | `44px` | A11Y |
| Input min-height | `44px` | A11Y |
| Focus outline | `3px solid #b8d5ff` | A11Y |
| Badge border-radius | `999px` | Layout |
| Badge font-size | `.76rem` | Typography |
| Breakpoint tablet | `1000px` | Responsive |
| Breakpoint mobile | `767px` | Responsive |

#### 1.3.3. App Navigation / Routing (`main.jsx:66-105`)
| Route key | Path |
|-----------|------|
| home | `/` |
| dashboard | `/dashboard` |
| cases | `/cases` |
| case | `/cases/:id` |
| citizen | `/citizen` |
| admin-users | `/admin/users` |
| admin-roles | `/admin/roles` |
| admin-audit | `/admin/audit-log` |
| admin-locations | `/admin/locations` |
| admin-catalog | `/admin/catalog` |
| report | `/report` |
| profile | `/profile` |
| officer-reports | `/officer-reports` |
| ban-do | `/ban-do` |

#### 1.3.4. localStorage Keys (`api.js`, `AuthContext.jsx`)
| Key | Vị trí |
|-----|--------|
| `qlttxd_token` | `api.js:22,62`, `AuthContext.jsx:28` |
| `qlttxd_user` | `api.js:23`, `AuthContext.jsx:9,34` |

#### 1.3.5. Cookie Names
| Cookie | Vị trí |
|--------|--------|
| `qlttxd_refresh_token` | `auth.js:178,263,357`, `api.js:5` |
| `qlttxd_csrf` | `auth.js:187,272,366`, `server.js:102`, `api.js:5` |

#### 1.3.6. Frontend Constants (duplicated from backend)
| Hằng số | Vị trí |
|----------|--------|
| `STATES` (15 trạng thái) | `frontend constants.js:3-19` |
| `STATE_LABELS` (15 nhãn) | `frontend constants.js:21-37` |
| `TRANSITIONS` (ma trận) | `frontend constants.js:39-57` |
| `AUDIT_TABLES` (9 bảng) | `frontend constants.js:59-70` |
| `AUDIT_TABLE_LABELS` | `frontend constants.js:71-82` |
| `AUDIT_ACTIONS` (7 action) | `frontend constants.js:83-92` |
| `AUDIT_ACTION_LABELS` | `frontend constants.js:93-102` |
| `ROLE_PERMISSIONS` (replicate) | `CaseDetail.jsx:82-86` |

#### 1.3.7. HTML Meta (`index.html`)
| Thông số | Giá trị |
|----------|---------|
| `lang` | `vi` |
| `title` | `QLTTXD - Báo cáo vi phạm` |
| `description` | `Hệ thống quản lý trật tự xây dựng - QLTTXD` |
| `og:title` | `QLTTXD - Quản lý Trật tự Xây dựng` |
| `og:description` | `Hệ thống quản lý trật tự xây dựng cho chính quyền địa phương` |

#### 1.3.8. Khắc phục trạng thái list (`CaseDetail.jsx:678-685`)
```javascript
['chua_thuc_hien','dang_thuc_hien','da_thuc_hien','qua_han','cuong_che','da_kiem_tra']
```

#### 1.3.9. Service Worker (`public/sw.js`)
| Thông số | Giá trị |
|----------|---------|
| Cache prefix | `qlttxd-` |
| Build version fallback | `'dev'` |
| Pre-cache URLs | `['/', '/index.html']` |

#### 1.3.10. Vite Config (`vite.config.js`)
| Thông số | Giá trị |
|----------|---------|
| Test environment | `jsdom` |
| Test globals | `true` |
| Test pattern | `src/**/*.test.{js,jsx,ts,tsx}` |
| Exclude | `node_modules, dist, e2e` |

### 1.4. Docker / Infrastructure Configuration

#### 1.4.1. Docker Compose (`app/docker-compose.yml`)
| Thông số | Giá trị | Vị trí |
|----------|---------|--------|
| PostGIS image | `postgis/postgis:16-3.4` | `docker-compose.yml:10` |
| Backend port (internal) | `3001` | `docker-compose.yml:28` |
| DB healthcheck interval | `10s` | `docker-compose.yml:20` |
| DB healthcheck timeout | `5s` | `docker-compose.yml:21` |
| DB healthcheck retries | `5` | `docker-compose.yml:22` |
| Restart policy | `unless-stopped` | `docker-compose.yml:23,42,58` |
| Volume names | `postgres_data, uploads_data, caddy_data, caddy_config` | `docker-compose.yml:60-63` |

#### 1.4.2. Backend Dockerfile
| Thông số | Giá trị |
|----------|---------|
| Base image | `node:24-alpine` |
| Healthcheck interval | `30s` |
| Healthcheck timeout | `5s` |
| Start period | `10s` |
| Retries | `3` |
| Exposed port | `3001` |

#### 1.4.3. Frontend Dockerfile (nginx)
| Thông số | Giá trị |
|----------|---------|
| Base image (build) | `node:24-alpine` |
| Base image (runtime) | `nginx:alpine` |
| Exposed port | `80` |

#### 1.4.4. Caddy Dockerfile
| Thông số | Giá trị |
|----------|---------|
| Base image (runtime) | `caddy:2.8-alpine` |
| Exposed ports | `80, 443` |

#### 1.4.5. nginx.conf
| Thông số | Giá trị | Vấn đề |
|----------|---------|--------|
| `server_name` | `localhost` | Hardcoded |
| `proxy_pass` (API) | `http://backend:3000` | **BUG: port sai — backend chạy 3001** |
| `proxy_pass` (uploads) | `http://backend:3000` | **BUG: port sai** |

#### 1.4.6. Caddyfile
| Thông số | Giá trị |
|----------|---------|
| Domain | `{$DOMAIN:localhost}` |
| HSTS header | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `no-referrer` |
| API proxy | `http://backend:3001` |

#### 1.4.7. ESLint / Prettier
| File | Mục đích |
|------|----------|
| `.eslintrc.json` | Cấu hình lint backend |
| `eslint.config.js` | Cấu hình lint frontend (flat config) |
| `.prettierrc` | Format code |
| `.prettierignore` | Files bỏ qua format |

---

<a id="phase-2"></a>
## PHASE 2 — CLASSIFICATION

### Category A — Infrastructure Configuration (.env only)

| # | Cấu hình | Lý do |
|---|----------|-------|
| A1 | `JWT_SECRET` | Secret — phải trong env, không bao giờ DB/UI |
| A2 | `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` | DB connection — infra |
| A3 | `POSTGRES_PASSWORD` | Docker DB password |
| A4 | `SMTP_HOST/PORT/USER/PASS/FROM` | Email credentials — secret |
| A5 | `CORS_ORIGIN` | Infra — phụ thuộc deployment domain |
| A6 | `TRUST_PROXY` | Infra — phụ thuộc network topology |
| A7 | `UPLOAD_DIR` | Filesystem path — infra |
| A8 | `LOG_LEVEL` | Infra — operator control |
| A9 | `FRONTEND_URL` | Infra — URL reset link |
| A10 | `DOMAIN` | Infra — Caddy domain |
| A11 | `HTTP_PORT/HTTPS_PORT` | Infra — ports |
| A12 | `VITE_API_BASE_URL` | Build-time infra — frontend API URL |
| A13 | `VITE_PROXY_TARGET` | Dev-only infra — proxy |
| A14 | `NODE_ENV` | Runtime environment — infra |
| A15 | `PORT/HOST` | Infra — server bind |

### Category B — Runtime Configuration (Database)

| # | Cấu hình | Lý do |
|---|----------|-------|
| B1 | JWT access token TTL (`5m`) | Nên tùy chỉnh theo chính sách bảo mật tổ chức |
| B2 | JWT refresh token TTL (`7d`) | Nên tùy chỉnh |
| B3 | SSE token TTL (`60s`) | Nên tùy chỉnh |
| B4 | bcrypt rounds (`10`) | Nên tùy chỉnh — cân bằng performance/security |
| B5 | Rate limit windowMs / max (global, write, user, auth) | Nên tùy chỉnh theo tải thực tế |
| B6 | `RATE_LIMIT_DISABLED` / `QLTTXD_DEBUG_TOKENS` | Feature flag — nên là DB config |
| B7 | Pool max connections (`20`) | Nên tùy chỉnh theo tài nguyên |
| B8 | Pool idleTimeoutMillis (`30000`) | Nên tùy chỉnh |
| B9 | Pool connectionTimeoutMillis (`5000`) | Nên tùy chỉnh |
| B10 | `MAX_UPLOAD_MB` | Nên tùy chỉnh |
| B11 | Upload allowed MIME types | Nên tùy chỉnh |
| B12 | Body limit JSON (`1mb`) / URL-encoded (`10kb`) | Nên tùy chỉnh |
| B13 | `AUDIT_RETENTION_DAYS` | Chính sách lưu trữ — DB config |
| B14 | AuditRetention BATCH_SIZE / intervalMs | Nên tùy chỉnh |
| B15 | AuditRetention ARCHIVE_DIR | Nên tùy chỉnh |
| B16 | TokenBlocklist TTL (`8h`) / cleanup interval | Nên tùy chỉnh |
| B17 | ResetTokenCleanup interval / maxAge | Nên tùy chỉnh |
| B18 | UserTokensCleanup interval / maxAgeDays | Nên tùy chỉnh |
| B19 | NotificationWorker BATCH_SIZE / POLL_INTERVAL_MS | Nên tùy chỉnh |
| B20 | SSE heartbeat (`30s`) / poll (`5s`) / poll LIMIT (`50`) | Nên tùy chỉnh |
| B21 | Bell poll interval / retry / reconnect delays | Nên tùy chỉnh |
| B22 | Request timeout (`30s`) | Nên tùy chỉnh |
| B23 | Cookie maxAge / sameSite / httpOnly / secure | Nên tùy chỉnh |
| B24 | Reset token expiry (`15m`) | Nên tùy chỉnh |
| B25 | Forced shutdown timeout (`10s`) | Nên tùy chỉnh |
| B26 | HSTS maxAge (`31536000`) | Nên tùy chỉnh |
| B27 | CORS Max-Age (`86400`) | Nên tùy chỉnh |
| B28 | `RATE_LIMIT_MAX` (forgot-password) | Nên tùy chỉnh |
| B29 | Pagination defaults (users=50/200, notifications=20/100) | Nên tùy chỉnh |
| B30 | States / State Labels / Transitions | Nên là DB config (workflow engine) |
| B31 | Workflow role permissions (ROLE_PERMISSIONS matrix) | Nên là DB config |
| B32 | Business code format / sequences | Nên là DB config |
| B33 | Audit actions | Nên là DB config |
| B34 | Validation rules (username/password/field lengths) | Nên là DB config |
| B35 | Helmet CSP directives | Nên tùy chỉnh (runtime) |
| B36 | Notification channel types (`portal/email/sms`) | Nên là DB config |

### Category C — System Configuration (Settings UI)

| # | Cấu hình | Lý do |
|---|----------|-------|
| C1 | Theme colors (CSS variables) | Người dùng/admin tùy chỉnh giao diện |
| C2 | Font family | Cấu hình appearance |
| C3 | `--sidebar-width` | Cấu hình layout |
| C4 | Content max-width (`1460px`) | Cấu hình layout |
| C5 | Border radius values | Cấu hình appearance |
| C6 | Breakpoints (1000px, 767px) | Cấu hình responsive |
| C7 | HTML lang (`vi`) | Cấu hình localization |
| C8 | HTML title / meta description | Cấu hình branding |
| C9 | OGP meta tags | Cấu hình SEO |
| C10 | Map HOME coordinates | Cấu hình bản đồ |
| C11 | Map tile URL / attribution | Cấu hình provider bản đồ |
| C12 | Map zoom defaults | Cấu hình bản đồ |
| C13 | Map marker colors | Cấu hình hiển thị |
| C14 | App name (`QLTTXD`) | Cấu hình branding |
| C15 | App favicon path | Cấu hình branding |
| C16 | Max photos per report (`5`) | Cấu hình nghiệp vụ |
| C17 | Geolocation options | Cấu hình bản đồ |
| C18 | Service worker cache strategy | Cấu hình PWA |
| C19 | Service worker cache version | Cấu hình PWA |
| C20 | Navigation routes / sidebar menu | Cấu hình hệ thống |

### Category D — Developer Configuration (config files, CLI)

| # | Cấu hình | Lý do |
|---|----------|-------|
| D1 | ESLint rules (`.eslintrc.json`, `eslint.config.js`) | Dev-only |
| D2 | Prettier config (`.prettierrc`) | Dev-only |
| D3 | `.prettierignore` / `.gitignore` | Dev-only |
| D4 | Vite test config (jsdom, globals, patterns) | Dev-only |
| D5 | Vite proxy config | Dev-only |
| D6 | SW build version plugin | Build tool |
| D7 | Docker image versions (node:24-alpine, nginx:alpine, caddy:2.8, postgis:16-3.4) | Infra manifest |
| D8 | Docker healthcheck params | Infra manifest |
| D9 | Volume names | Infra manifest |
| D10 | Docker restart policy | Infra manifest |

### Category E — Should NEVER be configurable

| # | Cấu hình | Lý do giữ hardcoded |
|---|----------|---------------------|
| E1 | **bcrypt rounds minimum** (không thấp hơn 10) | Bảo mật — rounds thấp = hash yếu. Cho phép tăng nhưng KHÔNG cho phép giảm dưới 10. |
| E2 | **JWT algorithm** (HS256) | Thay đổi algorithm = phá vỡ toàn bộ token hiện có. Chỉ DevOps/SRE thay đổi qua code review. |
| E3 | **CORS allow-credentials** (`true`) | Không bao giờ tắt — frontend phụ thuộc cookie cho refresh/CSRF. Tắt = hệ thống gãy. |
| E4 | **Cookie `httpOnly` cho refresh token** (`true`) | Bảo mật XSS. Tắt = lộ token cho JavaScript. |
| E5 | **Cookie `path: '/'`** | Đường dẫn cookie — thay đổi = mất cookie. |
| E6 | **Helmet `objectSrc: 'none'`** | Bảo mật — chặn plugin/object nhúng. |
| E7 | **Helmet `frameAncestors: 'none'`** | Bảo mật — chống clickjacking. |
| E8 | **Magic bytes validation** (JPEG/PNG/GIF/WEBP) | Bảo mật — xác thực file upload thật. Thay đổi = chấp nhận file giả mạo. |
| E9 | **UUID regex** trong route params | Định dạng ID cố định. |
| E10 | **`is_active` default** cho users | Mặc định an toàn — tài khoản mới phải active. |
| E11 | **PostGIS SRID 4326** | Hệ tọa độ WGS84 — toàn bộ logic GIS phụ thuộc. |
| E12 | **`gen_random_uuid()`** cho primary keys | Phương pháp sinh ID cố định. |
| E13 | **Sanitize function** (XSS prevention) | Bảo mật cốt lõi — không tắt. |
| E14 | **CSRF middleware** | Bảo mật — không tắt được. |
| E15 | **Password minimum complexity** (chữ + số) | Chính sách bảo mật tối thiểu. |
| E16 | **Audit logging** (`audit()` helper) | Tuân thủ pháp luật — không tắt. |
| E17 | **SQL `NO CYCLE` cho sequences** | Mã nghiệp vụ không lặp lại. |
| E18 | **`deleted_at` soft delete** pattern | Nguyên tắc dữ liệu. |
| E19 | **Token blocklist mechanism** | Bảo mật thu hồi token. |
| E20 | **HSTS `includeSubDomains`** | Bảo mật TLS. |
| E21 | **Service worker cache bypass cho API** | Dữ liệu phải fresh. |

---

<a id="phase-3"></a>
## PHASE 3 — HARDCODE DETECTION REPORT

Bảng dưới liệt kê **mọi** giá trị hardcoded cần di chuyển sang cấu hình tập trung.

| # | Cấu hình | Vị trí hiện tại | Lý do hardcode | Rủi ro | Vị trí đề xuất | Độ khó di chuyển | Ưu tiên | Kế hoạch di chuyển | Tác động | Phụ thuộc | Risk Score |
|---|----------|-----------------|----------------|--------|----------------|-------------------|---------|---------------------|----------|------------|------------|
| H1 | Pool `max=20` | `server.js:219` | Không env | Pool tràn dưới tải cao | DB config (B7) | Thấp | **P0** | Thêm `PG_POOL_MAX` env + DB setting | Tăng/giảm pool | DB connection limit | 8 |
| H2 | Pool `idleTimeoutMillis=30000` | `server.js:220` | Không env | Connection giữ lâu | DB config (B8) | Thấp | P2 | Thêm `PG_POOL_IDLE_TIMEOUT_MS` | Pool tuning | — | 3 |
| H3 | Pool `connectionTimeoutMillis=5000` | `server.js:221` | Không env | Hang trên DB chậm | DB config (B9) | Thấp | P1 | Thêm `PG_POOL_CONNECT_TIMEOUT_MS` | Startup failure | — | 5 |
| H4 | JWT access TTL `5m` | `auth.js:159,244,338` | Hardcode | Không đổi được | DB config (B1) | Trung bình | **P0** | Thêm bảng `system_config`, đọc từ DB | Token lifetime | Refresh logic | 9 |
| H5 | JWT refresh TTL `7d` | `auth.js:167,252,346` | Hardcode | — | DB config (B2) | Trung bình | **P0** | Như H4 | Cookie maxAge phải sync | — | 9 |
| H6 | SSE token TTL `60s` | `thong-bao.js:20` | Hardcode | — | DB config (B3) | Thấp | P2 | DB config | SSE connection | — | 4 |
| H7 | bcrypt rounds `10` | `auth.js`, `admin-users.js` (7 vị trí) | Hardcode | Performance/security | DB config (B4) | Trung bình | P1 | DB config với min=10 | Hash time | — | 7 |
| H8 | Rate limit `windowMs=900000` | `rate-limit.js:9`, `rate-limit-user.js:8`, `auth.js:24` | Hardcode | Không tùy chỉnh | DB config (B5) | Trung bình | P1 | DB config per-tier | Throttling | Redis (nếu scale) | 8 |
| H9 | Rate limit `max` (100/30/200/10) | `rate-limit.js:17-18`, `rate-limit-user.js:9`, `auth.js:25` | Hardcode | — | DB config (B5) | Trung bình | P1 | DB config per-tier | Throttling | — | 8 |
| H10 | `RATE_LIMIT_DISABLED` | `rate-limit.js:4` | Env — OK | — | Keep env (A) hoặc DB flag (B6) | Thấp | P3 | Chuyển sang DB feature flag | Dev/test | — | 2 |
| H11 | `QLTTXD_DEBUG_TOKENS` | `auth.js:21,571` | Env | Lộ token nếu quên tắt | DB flag + audit log (B6) | Thấp | **P0** | Chuyển sang DB, log warning | Security | — | 10 |
| H12 | `MAX_UPLOAD_MB=10` | `upload.js:20` | Env — OK | — | Giữ env hoặc DB (B10) | Thấp | P2 | — | — | — | 3 |
| H13 | Upload MIME `image/*` | `upload.js:21` | Hardcode | Không thêm PDF/docx | DB config (B11) | Trung bình | P1 | DB table `allowed_mime_types` | File type policy | — | 6 |
| H14 | Magic bytes check | `upload.js:24-37` | Hardcode (E8) | **KHÔNG di chuyển** | Keep hardcoded (E) | — | — | — | — | — | 0 |
| H15 | JSON body limit `1mb` | `server.js:87` | Hardcode | Request lớn bị reject | DB config (B12) | Thấp | P2 | DB config | Large payloads | — | 4 |
| H16 | URL-encoded limit `10kb` | `server.js:88` | Hardcode | — | DB config (B12) | Thấp | P3 | DB config | — | — | 2 |
| H17 | `AUDIT_RETENTION_DAYS` | `server.js:53` | Env — OK | — | Giữ env + DB override (B13) | Thấp | P2 | — | — | — | 2 |
| H18 | AuditRetention `BATCH_SIZE=500` | `audit-retention.js:10` | Hardcode | — | DB config (B14) | Thấp | P2 | — | DB load | — | 3 |
| H19 | AuditRetention `intervalMs=24h` | `audit-retention.js:36` | Hardcode | — | DB config (B14) | Thấp | P2 | — | — | — | 2 |
| H20 | AuditRetention `ARCHIVE_DIR` | `audit-retention.js:11` | Hardcode | — | DB config (B15) | Thấp | P2 | — | File location | — | 2 |
| H21 | TokenBlocklist `CLEANUP_INTERVAL_MS=30m` | `token-blocklist.js:3` | Hardcode | — | DB config (B16) | Thấp | P3 | — | — | — | 2 |
| H22 | TokenBlocklist `ttlMs=8h` | `token-blocklist.js:11` | Hardcode | — | DB config (B16) | Thấp | P2 | — | Token revocation window | — | 4 |
| H23 | ResetTokenCleanup interval `1h` | `reset-token-cleanup.js:3` | Hardcode | — | DB config (B17) | Thấp | P3 | — | — | — | 1 |
| H24 | UserTokensCleanup `maxAgeDays=30` | `user-tokens-cleanup.js:19` | Hardcode | — | DB config (B18) | Thấp | P3 | — | — | — | 1 |
| H25 | NotificationWorker `BATCH_SIZE=10` | `notification-worker.js:5` | Hardcode | — | DB config (B19) | Thấp | P2 | — | Email throughput | — | 2 |
| H26 | NotificationWorker `POLL_INTERVAL_MS=30s` | `notification-worker.js:6` | Hardcode | — | DB config (B19) | Thấp | P2 | — | Email latency | — | 2 |
| H27 | SSE heartbeat `30s` | `thong-bao.js:125` | Hardcode | — | DB config (B20) | Thấp | P3 | — | Connection keepalive | — | 1 |
| H28 | SSE poll `5s` | `thong-bao.js:126` | Hardcode | — | DB config (B20) | Thấp | P3 | — | DB query frequency | — | 2 |
| H29 | SSE poll LIMIT `50` | `thong-bao.js:106` | Hardcode | — | DB config (B20) | Thấp | P3 | — | — | — | 1 |
| H30 | Bell poll `30s` | `BellNotification.jsx:50` | Hardcode | — | DB config (B21) | Thấp | P3 | Fetch from `/api/v1/config` | — | — | 1 |
| H31 | Bell retry `5m` / reconnect `[1s,2s,4s]` | `BellNotification.jsx:57,92` | Hardcode | — | DB config (B21) | Thấp | P3 | — | — | — | 1 |
| H32 | Request timeout `30s` | `server.js:178` | Env + hardcode default | — | DB config (B22) | Thấp | P2 | — | Long requests | — | 3 |
| H33 | Cookie `maxAge=7d` | `auth.js:182,267,361` (6 vị trí) | Hardcode (dup) | Không sync với refresh TTL | DB config (B23) — sync với H5 | Trung bình | **P0** | Gộp với H4/H5 | Auth behavior | JWT refresh TTL | 9 |
| H34 | Cookie `sameSite=lax` | `auth.js:181,266,360` (6 vị trí) | Hardcode | — | DB config (B23) | Trung bình | P1 | — | CSRF posture | CSRF logic | 7 |
| H35 | Reset token expiry `15m` | `auth.js:527` | Hardcode | — | DB config (B24) | Thấp | P2 | — | Reset window | — | 4 |
| H36 | Forced shutdown `10s` | `server.js:247` | Hardcode | — | DB config (B25) | Thấp | P3 | — | Graceful shutdown | — | 1 |
| H37 | HSTS maxAge `31536000` | `server.js:156`, `Caddyfile:3` | Hardcode (dup) | — | DB config (B26) | Thấp | P2 | — | TLS policy | — | 3 |
| H38 | CORS Max-Age `86400` | `server.js:71` | Hardcode | — | DB config (B27) | Thấp | P3 | — | Preflight caching | — | 1 |
| H39 | Pagination defaults (50/200, 20/100) | `admin-users.js:18`, `thong-bao.js:31` | Hardcode | — | DB config (B29) | Thấp | P2 | — | UI consistency | — | 2 |
| H40 | `STATES` / `STATE_LABELS` (15) | Backend `constants.js` + Frontend `constants.js` | Hardcode + **DUPLICATE** | Thay đổi workflow = sửa 2 nơi | DB table `workflow_states` (B30) | **Cao** | **P1** | Tạo bảng DB + API `/api/v1/config/workflow` | Workflow engine | Frontend refactor | 9 |
| H41 | `TRANSITIONS` matrix | Backend `constants.js` + Frontend `constants.js` | Hardcode + **DUPLICATE** | — | DB table `workflow_transitions` (B30) | **Cao** | P1 | Tạo bảng DB + API | Workflow logic | H40 | 9 |
| H42 | `ROLE_PERMISSIONS` matrix | Backend `workflow-rules.js` + Frontend `CaseDetail.jsx:82-86` | Hardcode + **DUPLICATE** | — | DB table `role_state_permissions` (B31) | **Cao** | P1 | Tạo bảng DB + API | RBAC granularity | H40, H41 | 10 |
| H43 | `BUSINESS_CODE_SEQUENCES` | `constants.js:56-61` | Hardcode | — | DB table `business_code_config` (B32) | Trung bình | P2 | — | Code generation | — | 3 |
| H44 | `AUDIT_ACTIONS` | Backend `constants.js:63-96` | Hardcode | — | DB table `audit_actions` (B33) | Trung bình | P2 | — | Audit taxonomy | — | 2 |
| H45 | `AUDIT_TABLES` / `AUDIT_TABLE_LABELS` | Frontend `constants.js:59-82` | Hardcode | — | API `/api/v1/config/audit` (B33) | Thấp | P3 | Fetch from API | Audit UI | H44 | 2 |
| H46 | Validation rules (username 3-50, pw 8, etc.) | `auth.js`, `admin-users.js`, `ho-so.js` | Hardcode (dup) | — | DB table `validation_rules` (B34) | **Cao** | P2 | Tạo bảng + middleware đọc config | Form validation | Frontend sync | 6 |
| H47 | Helmet CSP directives | `server.js:142-157` | Hardcode | Thêm domain tile map = sửa code | DB config (B35) | Trung bình | P1 | DB JSON config | Security headers | — | 7 |
| H48 | `HOME` coordinates | Frontend `constants.js:1` | Hardcode | Mỗi tỉnh khác nhau | Settings UI (C10) + API | Thấp | P2 | Fetch from `/api/v1/config/map` | Map center | — | 3 |
| H49 | Tile URL | `MapView.jsx:24`, `BanDoPage.jsx:41` (dup) | Hardcode (dup) | Đổi provider = sửa 2 nơi | Settings UI (C11) + API | Thấp | P2 | Fetch from config API | Map provider | CSP H47 | 5 |
| H50 | Marker colors (12) | `BanDoPage.jsx:9-22` | Hardcode | — | Settings UI (C13) | Thấp | P3 | Fetch from config API | Visual | — | 2 |
| H51 | CSS design tokens (21) | `styles.css:1-29` | Hardcode | — | Settings UI (C1-C5) — CSS variables injected | Trung bình | P2 | API returns theme JSON, inject CSS vars | Theme | — | 4 |
| H52 | Font family | `styles.css:25` | Hardcode | — | Settings UI (C2) | Thấp | P3 | — | Typography | — | 2 |
| H53 | `--sidebar-width` | `styles.css:14` | Hardcode | — | Settings UI (C3) | Thấp | P3 | — | Layout | — | 1 |
| H54 | Content max-width `1460px` | `styles.css:43` | Hardcode | — | Settings UI (C4) | Thấp | P3 | — | Layout | — | 1 |
| H55 | Breakpoints `1000px/767px` | `styles.css:132-133` | Hardcode | — | Settings UI (C6) | Thấp | P3 | — | Responsive | — | 1 |
| H56 | HTML `lang=vi` | `index.html:2` | Hardcode | — | Settings UI (C7) | Thấp | P3 | Runtime inject `<html lang>` | Localization | — | 2 |
| H57 | HTML title / meta | `index.html:6-9` | Hardcode | — | Settings UI (C8, C9) | Thấp | P3 | Runtime inject `<title>` | Branding | — | 2 |
| H58 | App name `QLTTXD` | `main.jsx:237`, `index.html:6` | Hardcode | — | Settings UI (C14) | Thấp | P3 | Fetch from config | Branding | — | 2 |
| H59 | Max photos `5` | `CitizenPage.jsx:229` | Hardcode | — | Settings UI (C16) + API | Thấp | P2 | Fetch from config API | Upload policy | H13 | 4 |
| H60 | Geolocation options | `CitizenPage.jsx:81` | Hardcode | — | Settings UI (C17) | Thấp | P3 | — | Map accuracy | — | 1 |
| H61 | Khắc phục status list | `CaseDetail.jsx:678-685` | Hardcode | — | DB config (B30) — sync with schema | Trung bình | P2 | Fetch from API | Workflow | H40 | 3 |
| H62 | SW cache strategy / version | `sw.js:7` | Hardcode | — | Settings UI (C18, C19) | Trung bình | P3 | Build-time inject | PWA | — | 2 |
| H63 | Navigation routes | `main.jsx:66-105` | Hardcode | — | Settings UI (C20) | **Cao** | P3 | Config-driven routing | Navigation | RBAC | 5 |
| H64 | localStorage keys | `api.js`, `AuthContext.jsx` | Hardcode | — | Keep hardcoded (E) | — | — | — | — | — | 0 |
| H65 | Cookie names | `auth.js`, `server.js`, `api.js` | Hardcode | — | Keep hardcoded (E) | — | — | — | — | — | 0 |
| H66 | nginx `proxy_pass` port `3000` | `nginx.conf:12,24` | Hardcode **BUG** | Backend chạy 3001 → nginx config sai | Fix to env var | Thấp | **P0** | `proxy_pass http://backend:${BACKEND_PORT}` | **Broken nginx proxy** | — | 10 |
| H67 | nginx `server_name localhost` | `nginx.conf:3` | Hardcode | — | Env var `$SERVER_NAME` | Thấp | P1 | — | Multi-domain | — | 4 |
| H68 | Docker image versions | `docker-compose.yml`, Dockerfiles | Hardcode | — | Keep in compose (D7) | — | P3 | — | — | — | 1 |
| H69 | Docker healthcheck params | Dockerfiles | Hardcode | — | Keep in compose (D8) | — | P3 | — | — | — | 1 |
| H70 | `thong_bao.kenh` CHECK constraint | `schema.sql:392` | DB constraint | — | DB config table (B36) | Cao | P3 | Migration + app logic | Notification channels | — | 3 |
| H71 | Version string `0.3.2` | `auth.js:39,58,75`, `health.js:13` | Hardcode fallback | — | `npm_package_version` only, remove fallback | Thấp | P2 | Remove `|| '0.3.2'` | Health check | — | 2 |

### Thống kê tóm tắt

| Phân loại | Số lượng | Ưu tiên P0 | P1 | P2 | P3 |
|-----------|----------|-------------|-----|-----|-----|
| **A — Infra (.env)** | 15 | — | — | — | — |
| **B — Runtime (DB)** | 36 | 6 | 8 | 12 | 10 |
| **C — System (UI)** | 20 | — | — | 8 | 12 |
| **D — Developer** | 10 | — | — | — | — |
| **E — Never configurable** | 21 | — | — | — | — |
| **BUG phát hiện** | 1 (nginx port) | 1 | — | — | — |
| **Tổng hardcode cần di chuyển** | **71** | **7** | **10** | **22** | **26** |

---

<a id="phase-4"></a>
## PHASE 4 — SETTINGS CENTER REDESIGN

### 4.1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                     SETTINGS CENTER (Frontend)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │
│  │ Sidebar  │ │ Search   │ │ Breadcrumb│ │  Page Content Area  │  │
│  │ (tree)   │ │ (global) │ │ (trail)  │ │  (forms, tables,     │  │
│  │          │ │          │ │          │ │   dialogs)          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API
┌───────────────────────────▼─────────────────────────────────────┐
│                   Settings API (Backend)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Config CRUD   │ │ Audit Logger  │ │ Version Controller       │ │
│  │ (per scope)   │ │ (all changes) │ │ (diff, rollback)         │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Schema        │ │ Permission   │ │ Import/Export            │ │
│  │ Validator     │ │ Gate         │ │ (JSON, YAML)             │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   PostgreSQL — system_config                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ system_config (key-value, scoped, versioned, audited)       │ │
│  │ config_history (audit trail: who, when, what, old→new)      │ │
│  │ config_schema (validation rules per key)                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ workflow_states, workflow_transitions, role_state_perms     │ │
│  │ validation_rules, notification_channels, allowed_mime_types │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2. Database Schema mới

```sql
-- Bảng cấu hình tập trung — key/value theo scope
CREATE TABLE system_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope       VARCHAR(50) NOT NULL DEFAULT 'global',
                -- 'global' | 'user' | 'role' | 'org'
    scope_id    UUID,
                -- NULL cho global, user_id/role_id/org_id cho scope cụ thể
    category    VARCHAR(50) NOT NULL,
                -- 'auth' | 'security' | 'rate_limit' | 'email' | 'map' | 'ui' | ...
    key         VARCHAR(200) NOT NULL,
    value       JSONB NOT NULL,
    value_type  VARCHAR(20) NOT NULL DEFAULT 'string',
                -- 'string' | 'integer' | 'boolean' | 'json' | 'array'
    description TEXT,
    is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scope, scope_id, category, key)
);

-- Lịch sử thay đổi — audit trail
CREATE TABLE config_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id    UUID NOT NULL REFERENCES system_config(id),
    nguoi_dung_id UUID REFERENCES users(id),
    old_value    JSONB,
    new_value    JSONB,
    action       VARCHAR(20) NOT NULL, -- 'create' | 'update' | 'delete' | 'rollback'
    thoi_gian    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip           INET,
    request_id   TEXT
);

-- Schema validation — định nghĩa type, min, max, allowed values
CREATE TABLE config_schema (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category    VARCHAR(50) NOT NULL,
    key         VARCHAR(200) NOT NULL,
    value_type  VARCHAR(20) NOT NULL,
    min_value   NUMERIC,
    max_value   NUMERIC,
    allowed_values JSONB,  -- enum
    regex       TEXT,
    is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    UNIQUE (category, key)
);

-- Workflow states (thay cho hardcoded STATES/TRANSITIONS)
CREATE TABLE workflow_states (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    label       VARCHAR(200) NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE workflow_transitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_state  VARCHAR(50) NOT NULL REFERENCES workflow_states(code),
    to_state    VARCHAR(50) NOT NULL REFERENCES workflow_states(code),
    label       VARCHAR(200),
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE role_state_permissions (
    role_id     UUID NOT NULL REFERENCES roles(id),
    state_code  VARCHAR(50) NOT NULL REFERENCES workflow_states(code),
    PRIMARY KEY (role_id, state_code)
);

-- Validation rules (thay cho hardcoded regex/lengths)
CREATE TABLE validation_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name  VARCHAR(100) NOT NULL,
    rule_type   VARCHAR(50) NOT NULL, -- 'min_length', 'max_length', 'regex', 'min', 'max'
    value       TEXT NOT NULL,
    error_message TEXT NOT NULL,
    UNIQUE (field_name, rule_type)
);

-- Notification channels
CREATE TABLE notification_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) NOT NULL UNIQUE, -- 'portal', 'email', 'sms', 'telegram'...
    label       VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    config      JSONB -- channel-specific config (webhook URL, API key ref, etc.)
);

-- Allowed MIME types for uploads
CREATE TABLE allowed_mime_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mime_type   VARCHAR(100) NOT NULL UNIQUE,
    extension   VARCHAR(10) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    magic_bytes_required BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 4.3. Caching Strategy

```
Startup → Load ALL config from DB → In-memory cache (Map)
  ↓
Read config → Cache hit (O(1))
  ↓
Write config → UPDATE DB → Invalidate cache → Reload
  ↓
Pub/Sub (LISTEN/NOTIFY) → Multiple instances sync cache
```

- **Cache TTL**: 60s (fallback invalidate)
- **Cache max size**: 1000 entries
- **Invalidation**: on write + LISTEN/NOTIFY cho multi-instance

### 4.4. Permission Model cho Settings Center

| Permission code | Mô tả | Ai có |
|-----------------|-------|-------|
| `config.view` | Xem settings | admin |
| `config.edit.general` | Sửa General/Branding | admin |
| `config.edit.security` | Sửa Security/Auth/JWT | admin |
| `config.edit.workflow` | Sửa Workflow/States/Roles | admin |
| `config.edit.infra` | Sửa DB/Cache/Storage | admin |
| `config.edit.appearance` | Sửa Theme/UI | admin |
| `config.export` | Export config | admin |
| `config.import` | Import config | admin |
| `config.rollback` | Rollback config | admin |

### 4.5. Sidebar Navigation Tree (Settings Center)

```
⚙ Settings Center
├── 📌 General
│   ├── App Name & Branding
│   ├── HTML Meta & SEO
│   ├── Service Worker / PWA
│   └── Feature Flags
├── 🎨 Appearance
│   ├── Theme Colors
│   ├── Typography
│   ├── Layout & Spacing
│   └── Responsive Breakpoints
├── ♿ Accessibility
│   ├── Motion Preferences
│   └── Contrast & Focus
├── 🌐 Localization
│   ├── Language
│   └── Date/Number Format
├── 👥 Users & Teams
│   ├── Users (existing)
│   ├── Roles (existing)
│   └── Permissions (existing)
├── 🔐 Authentication
│   ├── JWT Settings (access TTL, refresh TTL, SSE TTL)
│   ├── Password Policy (min length, complexity, bcrypt rounds)
│   ├── Cookie Settings (maxAge, sameSite, httpOnly, secure)
│   ├── Reset Password (token expiry, rate limit)
│   └── OAuth / SSO (future)
├── 🛡️ Security
│   ├── CORS (origins, max-age, headers)
│   ├── Helmet / CSP Directives
│   ├── HSTS
│   ├── CSRF
│   ├── Rate Limiting (global, write, user, auth tiers)
│   ├── Request Timeout
│   └── Debug Flags
├── 📋 Audit
│   ├── Retention Policy
│   ├── Archive Settings
│   └── Audit Actions Registry
├── 📧 Email / SMTP
│   ├── SMTP Connection
│   ├── Sender Identity
│   └── Notification Worker (batch, poll interval)
├── 🔔 Notifications
│   ├── Channels (portal, email, sms)
│   ├── SSE Settings (heartbeat, poll, limits)
│   └── Bell UI (poll, retry, reconnect)
├── 🗺️ Map & GIS
│   ├── Tile Provider
│   ├── Default Center (HOME)
│   ├── Zoom Levels
│   ├── Marker Colors
│   └── Geolocation Options
├── 📂 Upload
│   ├── Max File Size
│   ├── Allowed MIME Types
│   ├── Body Limits (JSON, URL-encoded)
│   └── Max Photos per Report
├── 🔄 Workflow
│   ├── States & Labels
│   ├── Transitions Matrix
│   ├── Role-State Permissions
│   ├── Business Code Format
│   └── Khắc Phục Status
├── 🗄️ Database
│   ├── Connection Pool (max, idle, connect timeout)
│   ├── Pagination Defaults
│   └── Cleanup Jobs (token blocklist, reset token, user tokens)
├── 📊 Monitoring & Health
│   ├── Health Check Endpoints
│   ├── Logging Level
│   └── Version Info
├── 📥 Import / Export
│   ├── Export Configuration (JSON, YAML)
│   ├── Import Configuration
│   └── Version History
├── ⏮️ Backup & Restore
│   ├── Backup Configuration
│   └── Restore from Backup
├── 🧪 Experimental
│   ├── Feature Flags
│   └── Beta Features
└── ℹ️ About
    ├── System Info
    ├── Version
    └── License
```

### 4.6. API Design

```
GET    /api/v1/config?category=auth&scope=global     → List config items
GET    /api/v1/config/:category/:key                 → Get single value
PUT    /api/v1/config/:category/:key                 → Update value (audit logged)
POST   /api/v1/config/import                         → Import JSON
GET    /api/v1/config/export                         → Export JSON
GET    /api/v1/config/history?category=...&key=...   → Version history
POST   /api/v1/config/rollback/:history_id           → Rollback to previous
GET    /api/v1/config/schema                         → Validation schema (for UI forms)
GET    /api/v1/config/workflow/states                → Workflow states
GET    /api/v1/config/workflow/transitions           → Transition matrix
PUT    /api/v1/config/workflow/transitions/:id       → Update transition
GET    /api/v1/config/workflow/role-permissions      → Role-state matrix
PUT    /api/v1/config/workflow/role-permissions      → Update matrix
GET    /api/v1/config/validation-rules               → Validation rules
GET    /api/v1/config/notification-channels          → Channels
GET    /api/v1/config/allowed-mime-types             → MIME types
```

---

<a id="phase-5"></a>
## PHASE 5 — UI SPECIFICATION

### Quy chuẩn chung cho TẤT CẢ trang Settings

| Khía cạnh | Quy định |
|-----------|----------|
| **Search** | Global search bar trên cùng — tìm theo key, label, description. Fuzzy match. Phím tắt `/` focus. |
| **Breadcrumb** | `Settings › [Category] › [Sub-page]` — tự cập nhật theo route. |
| **Permission** | Mỗi page check `config.edit.*` tương ứng. ReadOnly → disable fields. |
| **Versioning** | Mỗi save tạo `config_history` entry. Nút "History" mở dialog hiển thị diff. |
| **Audit** | Mọi thay đổi ghi `audit_log` + `config_history`. |
| **Error state** | Field error inline red. Toast "Lưu thất bại: [message]". |
| **Loading state** | Skeleton spinner trong panel. Button → "Đang lưu…". |
| **Empty state** | "Chưa có cấu hình. Nhấn [Tạo mới]." |
| **Accessibility** | WCAG 2.1 AA. Label-for-input. Keyboard nav. Focus visible. Min height 44px. |
| **Responsive** | Sidebar collapse → hamburger < 768px. Form 1 column. Table scroll-x. |
| **Keyboard** | Tab cycle. Enter submit. Esc cancel. `?` help. `/` search. |
| **Import/Export** | Nút trên header mỗi category. Export → JSON download. Import → file upload + preview diff. |

### Spec chi tiết cho 5 trang quan trọng nhất (P0/P1):

---

#### Trang 5.1: Authentication → JWT Settings

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Purpose** | Cấu hình TTL token, chính sách hết hạn |
| **Target Users** | Admin (có `config.edit.security`) |
| **Permission** | `config.edit.security` |
| **Navigation** | Settings › Authentication › JWT Settings |
| **Wireframe** | Form 3 fields + save button + history button |
| **Fields** | (1) Access Token TTL — number + unit (m/h/d), default 5m, min 1m, max 1h. (2) Refresh Token TTL — number + unit, default 7d, min 1d, max 30d. (3) SSE Token TTL — number + unit (s/m), default 60s, min 10s, max 5m. |
| **Validation** | Min ≤ value ≤ Max. Refresh TTL ≥ Access TTL × 10. SSE TTL ≤ Access TTL. |
| **Dependencies** | Cookie maxAge phải sync với Refresh TTL (warn nếu khác nhau) |
| **API** | `GET/PUT /api/v1/config/auth/jwt_access_ttl`, `jwt_refresh_ttl`, `sse_token_ttl` |
| **Database** | `system_config` (category='auth') |
| **Searchability** | Key: `jwt_access_ttl`, `jwt_refresh_ttl`, `sse_token_ttl` — tìm thấy qua "token", "jwt", "expiry", "TTL" |
| **Import/Export** | Có — nhóm `auth` |
| **Audit** | Có — `config_history` + `audit_log` action `config.update` |
| **Version** | Có — rollback từ history |
| **Error state** | "TTL không hợp lệ. Refresh TTL phải lớn hơn Access TTL ít nhất 10 lần." |
| **Loading** | Skeleton 3 rows |
| **Empty** | N/A (always has defaults) |
| **Accessibility** | Label → input, aria-describedby cho hint, min-height 44px |
| **Responsive** | Form 1 cột trên mobile |
| **Keyboard** | Tab giữa fields, Enter save, Esc cancel |
| **Future** | Thêm OAuth TTL, MFA TTL, API Key TTL |

---

#### Trang 5.2: Security → Rate Limiting

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Purpose** | Cấu hình giới hạn request theo tier |
| **Fields** | 4 tier groups: (1) Global — windowMs, max. (2) Write — windowMs, max. (3) User — windowMs, max, keyStrategy. (4) Auth — windowMs, max. |
| **Validation** | windowMs: 1000–3600000. max: 1–10000. |
| **Dependencies** | Redis (nếu scale horizontally — future) |
| **API** | `GET/PUT /api/v1/config/rate_limit/*` |
| **Special** | Hiển thị warning nếu max < 5 (throttling quá mức). "Test" button → gửi 10 requests và hiển thị headers X-RateLimit-* |
| **Future** | Per-IP, per-endpoint, per-role rate limiting |

---

#### Trang 5.3: Workflow → States & Transitions

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Purpose** | Quản lý trạng thái hồ sơ và ma trận chuyển |
| **Fields** | (1) State list table — code, label, isTerminal, sortOrder. CRUD. (2) Transition matrix — grid from×to, toggle enable/disable. (3) Role-state permission matrix — grid role×state, checkbox. |
| **Validation** | State code: snake_case, unique. Không xóa state đang được sử dụng. Không tạo cycle. |
| **Dependencies** | `workflow_states`, `workflow_transitions`, `role_state_permissions` tables |
| **API** | CRUD endpoints per table |
| **Special** | Visual diagram (graph) hiển thị transition flow. Drag-drop reorder. Color picker per state. |
| **Breaking changes** | Thay đổi states/transitions = cần migration + clear cache + restart |
| **Future** | Conditional transitions (dựa trên field values), transition hooks/webhooks |

---

#### Trang 5.4: Map & GIS → Tile Provider

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Purpose** | Cấu hình nhà cung cấp tile bản đồ |
| **Fields** | (1) Provider — select: OpenStreetMap, Mapbox, Google Maps, Custom. (2) Tile URL — text, template `{s}/{z}/{x}/{y}`. (3) Attribution — text. (4) Subdomains — comma-separated. (5) Max zoom — number 1-22. |
| **Validation** | URL phải có `{z}/{x}/{y}`. Attribution bắt buộc. |
| **Dependencies** | Helmet CSP `imgSrc` phải cập nhật theo domain tile. |
| **API** | `GET/PUT /api/v1/config/map/*` |
| **Special** | Live preview bản đồ nhỏ. Nút "Test connection" kiểm tra tile load. |
| **Future** | WMS layer, overlay layers, offline tiles |

---

#### Trang 5.5: Appearance → Theme Colors

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Purpose** | Tùy chỉnh bảng màu giao diện |
| **Fields** | 21 color pickers tương ứng 21 CSS variables + 5 layout values (sidebar width, content max-width, border radius, etc.) |
| **Validation** | Color: hex/rgb/hsl. Min contrast ratio 4.5:1 (WCAG AA). |
| **Dependencies** | CSS variables inject vào `:root` runtime |
| **API** | `GET/PUT /api/v1/config/ui/theme` |
| **Special** | Live preview (split screen). Preset themes (Light, Dark, High Contrast). Contrast checker inline. |
| **Future** | Dark mode toggle, user-level theme override, custom CSS injection |

---

### Spec tóm tắt cho các trang còn lại:

| Trang | Fields chính | Đặc biệt |
|-------|-------------|----------|
| General / Branding | App name, logo, favicon, title, meta description | Upload logo, live preview |
| General / Feature Flags | Toggle list (debug_tokens, rate_limit_disabled, etc.) | Audit log mỗi toggle |
| Accessibility | Motion, contrast, focus indicator size | A11y score preview |
| Localization | Language, date format, number format | i18n framework |
| Users & Teams | (existing pages, integrated) | — |
| Password Policy | Min length, complexity regex, bcrypt rounds (min 10), expiry | Strength meter preview |
| Cookie Settings | maxAge, sameSite, httpOnly, secure, path | Security warning |
| Reset Password | Token expiry, rate limit max | — |
| CORS | Origins list, methods, headers, max-age | Test origin button |
| CSP Directives | JSON editor per directive | CSP validator, "test mode" |
| HSTS | maxAge, includeSubDomains, preload | — |
| Request Timeout | Timeout ms, forced shutdown ms | — |
| Audit Retention | Retention days, batch size, interval, archive dir | Archive preview |
| Email / SMTP | Host, port, user, pass, from, secure | "Send test email" button |
| Notification Worker | Batch size, poll interval, channels | Worker status indicator |
| SSE Settings | Heartbeat, poll interval, poll limit | Active connection count |
| Bell UI | Poll interval, retry interval, reconnect delays, max attempts, dropdown limit | — |
| Upload | Max size, allowed MIME types (table CRUD), body limits, max photos | MIME type drag-reorder |
| Database / Pool | Max connections, idle timeout, connect timeout | Pool stats live |
| Database / Cleanup | Token blocklist TTL + interval, reset token interval, user tokens maxAge + interval | Next run countdown |
| Pagination | Default limit, max limit per module | Per-module table |
| Health & Logging | Log level, version display, health endpoint paths | Live health check |
| Import / Export | File upload, preview diff, apply | Dry-run mode |
| Version History | Timeline of all changes, diff viewer, rollback | Side-by-side diff |
| Backup / Restore | Backup download, restore upload | Checksum verify |
| Experimental | Beta features toggle | Warning banner |
| About | Version, uptime, tech stack, license | Auto-populated |

---

<a id="phase-6"></a>
## PHASE 6 — IMPLEMENTATION ROADMAP

### 6.1. Dependency Graph

```
Phase 1 (Foundation)
  ├── Create system_config tables (DB migration)
  ├── Config loader service (backend, in-memory cache)
  ├── Config API endpoints (CRUD + audit + history)
  └── Replace process.env reads with config service
        ↓
Phase 2 (Security P0)
  ├── JWT TTL → DB config (H4, H5, H33)
  ├── Debug flags → DB config (H11)
  ├── nginx port fix (H66)
  └── Cookie settings sync (H34)
        ↓
Phase 3 (Workflow P1)
  ├── Workflow states/transitions → DB (H40, H41)
  ├── Role-state permissions → DB (H42)
  ├── Frontend fetch workflow from API
  └── Remove duplicate constants
        ↓
Phase 4 (Security/UI P1)
  ├── Rate limiting → DB (H8, H9)
  ├── bcrypt rounds → DB (H7)
  ├── CSP/Helmet → DB (H47)
  ├── Upload MIME → DB (H13)
  └── Settings Center UI shell (sidebar, search, breadcrumb)
        ↓
Phase 5 (Runtime P2)
  ├── Pool config → DB (H1, H2, H3)
  ├── Cleanup jobs → DB (H18-H26)
  ├── Notification worker → DB (H25, H26)
  ├── SSE settings → DB (H27-H31)
  ├── Validation rules → DB (H46)
  ├── Map config → DB + UI (H48, H49)
  ├── Theme → UI (H51-H55)
  └── Settings Center pages (per spec)
        ↓
Phase 6 (Polish P3)
  ├── Pagination → DB (H39)
  ├── HTML meta → runtime inject (H56, H57)
  ├── App name → config (H58)
  ├── SW config (H62)
  ├── Navigation config (H63)
  ├── Remaining constants → DB
  └── Import/Export, Backup/Restore, Version History UI
```

### 6.2. Implementation Order with Estimates

| Phase | Tasks | Est. Complexity | Est. Time | Breaking Changes | Rollback |
|-------|-------|-----------------|-----------|-------------------|----------|
| **1 — Foundation** | DB migration, config service, API, replace env reads | Cao | 3-4 ngày | Không (additive) | Revert migration |
| **2 — Security P0** | JWT TTL, debug flags, nginx fix, cookie sync | Trung bình | 2 ngày | Cookie maxAge thay đổi → user re-login | Revert config values |
| **3 — Workflow P1** | States/transitions/role-perms → DB, frontend refactor | **Rất cao** | 4-5 ngày | **Có** — frontend phải đồng bộ | Keep old constants as fallback |
| **4 — Security/UI P1** | Rate limit, bcrypt, CSP, MIME, Settings UI shell | Cao | 3-4 ngày | bcrypt rounds tăng → hash lại | Set rounds=10 |
| **5 — Runtime P2** | Pool, jobs, SSE, validation, map, theme, pages | Trung bình | 5-6 ngày | Không | Revert config |
| **6 — Polish P3** | Pagination, HTML meta, SW, nav, import/export | Thấp | 3-4 ngày | Không | Revert |
| **Tổng** | | | **20-25 ngày** | | |

### 6.3. Backward Compatibility Strategy

1. **Config fallback chain**: `DB config → env var → hardcoded default`. Nếu DB rỗng, hệ thống vẫn chạy với giá trị cũ.
2. **Feature flag `config_source`**: `env` (legacy) | `db` (new) | `hybrid` (DB overrides env). Mặc định `hybrid`.
3. **Migration script**: Tự động seed `system_config` với tất cả giá trị hardcoded hiện tại → không thay đổi hành vi.
4. **Frontend constants**: Giữ file `constants.js` làm fallback; thêm `getConfig(key, fallback)` đọc từ API trước, fallback file nếu API fail.

### 6.4. Rollback Strategy

| Cấp | Chiến lược |
|-----|-----------|
| **Config value** | `POST /api/v1/config/rollback/:history_id` — khôi phục giá trị cũ |
| **Schema migration** | Down migration script cho mỗi phase |
| **Frontend** | Revert commit — fallback constants.js vẫn hoạt động |
| **Full rollback** | `config_source=env` → hệ thống quay về đọc env như cũ |

### 6.5. Risk Assessment

| Rủi ro | Khả năng | Tác động | Mitigation |
|---------|---------|---------|------------|
| Workflow refactor gây gãy frontend | Cao | Cao | Giữ fallback constants, deploy song song, A/B test |
| bcrypt rounds tăng → login chậm | Trung bình | Trung bình | Giới hạn max=12, benchmark trước deploy |
| Config cache không sync giữa instances | Trung bình | Cao | LISTEN/NOTIFY + TTL fallback |
| DB query thêm cho mỗi config read | Thấp | Thấp | In-memory cache, chỉ query 1 lần startup |
| CSP thay đổi → gãy tile map | Trung bình | Trung bình | CSP validator + test mode trước apply |
| Import config sai → hệ thống gãy | Thấp | Cao | Dry-run + diff preview + audit log |

### 6.6. Testing Strategy

| Cấp | Test |
|-----|------|
| **Unit** | Config service get/set, validation, cache, fallback |
| **Integration** | API CRUD, audit, history, rollback, import/export |
| **E2E** | Settings Center UI, save → reload → verify, rollback |
| **Regression** | Tất cả test hiện có (159 backend + 41 frontend) phải pass |
| **Performance** | Config read ≤ 1ms (cache hit), write ≤ 100ms |
| **Security** | RBAC trên config API, secret masking, audit完整性 |

### 6.7. Deliverables Checklist

- [ ] DB migration: `system_config`, `config_history`, `config_schema`, workflow tables, validation_rules, notification_channels, allowed_mime_types
- [ ] Backend: `ConfigService` (cache + DB), `configRoutes` (API), replace all `process.env` hardcodes
- [ ] Backend: Fix nginx port bug (`3000` → env var or `3001`)
- [ ] Frontend: `useConfig()` hook, `ConfigProvider` context, replace `constants.js` with API fetch
- [ ] Frontend: Settings Center shell (sidebar tree, global search, breadcrumb, page router)
- [ ] Frontend: 30+ settings pages per spec
- [ ] Frontend: Theme runtime injection (CSS variables from API)
- [ ] Frontend: Map config (tile URL, HOME, zoom, colors from API)
- [ ] API: Import/Export endpoints, version history, rollback
- [ ] Migration script: seed all current hardcoded values into DB
- [ ] Tests: unit + integration + E2E for config system
- [ ] Docs: Settings Center user guide, config schema reference
- [ ] Screenshots: all settings pages (per quy ước UI screenshot)

---

## KẾT LUẬN

Báo cáo này phát hiện **71 giá trị hardcoded** cần di chuyển, **1 bug nghiêm trọng** (nginx proxy port sai), và **3 giá trị trùng lặp** giữa frontend/backend (STATES, TRANSITIONS, ROLE_PERMISSIONS). 

Kiến trúc Settings Center đề xuất:
- **3 lớp config**: env (infra) → DB (runtime) → UI (system)
- **Caching** in-memory + LISTEN/NOTIFY
- **Versioning** + audit + rollback cho mọi thay đổi
- **Permission-gated** theo category
- **Scalable** đến hàng trăm module qua category/scope/key
- **Backward compatible** qua fallback chain

Estimated effort: **20-25 ngày dev**, 6 phases, breaking changes chỉ ở Phase 3 (workflow refactor).
