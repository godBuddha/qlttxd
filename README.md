# QLTTXD — Hệ thống Quản lý Trật tự Xây dựng

> Xử lý vi phạm trật tự xây dựng: người dân báo cáo → tiếp nhận → xác minh → lập biên bản → ban hành quyết định → theo dõi khắc phục → đóng hồ sơ.

**v0.3.3** · Node.js 24 + React 19 + PostgreSQL 16/PostGIS · Self-hosted Docker

---

## 🖼️ Demo

### Đăng nhập

| Trang đăng nhập |
| --------------- |
| ![Trang đăng nhập](docs/screenshots/v0.3.2/01-login-page.png) |

### 👤 Quản trị viên (Admin)

| Dashboard                                                      | Danh sách hồ sơ                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| ![Admin Dashboard](docs/screenshots/v0.3.2/02-admin-dashboard.png) | ![Danh sách hồ sơ](docs/screenshots/v0.3.2/03-admin-cases.png) |

| Chi tiết hồ sơ                                                        | Timeline                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Chi tiết hồ sơ](docs/screenshots/v0.3.2/04-admin-case-detail.png) | ![Timeline](docs/screenshots/v0.3.2/09-admin-case-Timeline.png) |

| Biên bản                                                          | Quyết định                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![Biên bản](docs/screenshots/v0.3.2/07-admin-case-Biên-bản.png)   | ![Quyết định](docs/screenshots/v0.3.2/05-admin-case-Quyết-định.png)    |

| Khắc phục                                                           | Báo cáo vi phạm                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Khắc phục](docs/screenshots/v0.3.2/06-admin-case-Khắc-phục.png)   | ![Báo cáo vi phạm](docs/screenshots/v0.3.2/11-admin-officer-reports.png) |

| Bản đồ GIS                                                  | Người dùng                                                |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| ![Bản đồ](docs/screenshots/v0.3.2/12-admin-ban-do.png)      | ![Người dùng](docs/screenshots/v0.3.2/13-admin-users.png) |

| Phân quyền vai trò                                        | Nhật ký hệ thống                                                |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| ![Phân quyền](docs/screenshots/v0.3.2/14-admin-roles.png) | ![Nhật ký hệ thống](docs/screenshots/v0.3.2/15-admin-audit-log.png) |

| Địa điểm (GIS)                                       | Danh mục                                      |
| ---------------------------------------------------- | ---------------------------------------------- |
| ![Địa điểm](docs/screenshots/v0.3.2/16-admin-locations.png) | ![Danh mục](docs/screenshots/v0.3.2/17-admin-catalog.png) |

| Báo cáo & Xuất dữ liệu                         | Hồ sơ cá nhân                                      |
| ---------------------------------------------- | -------------------------------------------------- |
| ![Báo cáo](docs/screenshots/v0.3.2/18-admin-report.png) | ![Hồ sơ cá nhân](docs/screenshots/v0.3.2/19-admin-profile.png) |

### 📋 Cán bộ thụ lý (Handler)

| Dashboard                                                        | Danh sách hồ sơ                                                       | Báo cáo vi phạm                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ![Handler Dashboard](docs/screenshots/v0.3.2/23-handler-dashboard.png) | ![Handler Hồ sơ](docs/screenshots/v0.3.2/24-handler-cases.png) | ![Handler Báo cáo](docs/screenshots/v0.3.2/25-handler-officer-reports.png) |

### 🔍 Xác minh viên (Verifier)

| Dashboard                                                                  | Hồ sơ xử lý                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ![Verifier Dashboard](docs/screenshots/v0.3.2/26-verifier-dashboard.png) | ![Verifier Hồ sơ](docs/screenshots/v0.3.2/27-verifier-cases.png) |

### 📊 Lãnh đạo (Leader)

| Dashboard                                                       | Báo cáo                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| ![Leader Dashboard](docs/screenshots/v0.3.2/28-leader-dashboard.png) | ![Leader Báo cáo](docs/screenshots/v0.3.2/29-leader-report.png) |

### 🏠 Công dân (Citizen)

| Dashboard                                                        | Báo cáo vi phạm                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| ![Citizen Dashboard](docs/screenshots/v0.3.2/20-citizen-dashboard.png) | ![Citizen Báo cáo](docs/screenshots/v0.3.2/21-citizen-report.png) |

### 📱 Responsive (Mobile)

| Dashboard | Danh sách hồ sơ       | Bản đồ                              |
| --------- | --------------------- | ----------------------------------- |
| ![Mobile Dashboard](docs/screenshots/v0.3.2/30-mobile-dashboard.png) | ![Mobile Cases](docs/screenshots/v0.3.2/31-mobile-cases.png) | ![Mobile Bản đồ](docs/screenshots/v0.3.2/32-mobile-ban-do.png) |

### ⚙️ Admin — Settings Center (v0.3.3)

| Tổng quan                                          | Auth                                             | Rate Limit                                        |
| -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| ![Settings Overview](app/frontend/src/admin/__screenshots__/settings-overview.svg) | ![Auth Settings](app/frontend/src/admin/__screenshots__/settings-auth.svg) | ![Rate Limit](app/frontend/src/admin/__screenshots__/settings-rate-limit.svg) |

| Workflow States                                    | Role Permissions                                 | Upload                                            |
| -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| ![Workflow States](app/frontend/src/admin/__screenshots__/settings-workflow-states.svg) | ![Role Perms](app/frontend/src/admin/__screenshots__/settings-role-permissions.svg) | ![Upload](app/frontend/src/admin/__screenshots__/settings-upload.svg) |

---

## ✨ Tính năng

### v0.3.3 — Enterprise Settings Center

- **ConfigService:** Cấu hình runtime từ database (`system_config` table), cache-in-memory, `pg_notify` real-time replication, Unix socket support
- **17 Config API endpoints:** GET/PUT/POST config, workflow states/transitions/role-permissions, export/import, validation rules, notification channels, MIME types, config history + rollback
- **Migration 005:** 9 bảng mới (`system_config`, `config_history`, `config_schema`, `workflow_states`, `workflow_transitions`, `role_state_permissions`, `allowed_mime_types`, `notification_channels`, `validation_rules`) với 54 seed records
- **ConfigProvider + useConfig hook:** Dynamic config cho toàn bộ frontend app
- **12 Settings pages:** Overview, Auth, Upload, Rate Limit, Security, UI, Audit, Notification, Export, Validation, Workflow States/Transitions, Role Permissions
- **71 hardcoded values replaced:** Server config, JWT TTL, bcrypt rounds, rate limits, cookie settings, cleanup intervals, pagination defaults, SSE settings — tất cả đọc từ ConfigService
- **CSS design system integration:** Settings Center sử dụng chung design tokens với toàn bộ app

### v0.3.2 — Security & Real-time

- **Sinh văn bản hành chính DOCX:** Biên bản & Quyết định xử phạt theo thể thức NĐ 30/2020/NĐ-CP
- **Client-side routing:** Browser history (Back/Forward, deep-link), mỗi route lazy-load + ErrorBoundary riêng
- **Real-time thông báo:** SSE push qua `EventSource`, fallback polling + auto-reconnect
- **Bảo mật nâng cao:** Token refresh qua HttpOnly cookie, JWT không lộ qua URL (blob-based image), password change revoke toàn bộ token, CSP cứng, rate limit + user-level limiter
- **Pagination:** Danh sách hồ sơ, báo cáo, bản đồ, admin users, audit log
- **Frontend test suite:** Vitest + React Testing Library
- **Service worker:** Offline fallback, cache versioned per build

### v0.3.x — Workflow & UX

- **15 trạng thái hồ sơ:** Mở rộng từ 13 lên 15 (thêm `da_tiep_nhan`, `da_chuyen_co_quan`)
- **Role × State transition matrix:** Mỗi vai trò chỉ chuyển được trạng thái được phép
- **Workflow UX:** State timeline, badges/filter, role-aware transition buttons
- **SSE authentication:** HttpOnly cookie + CSRF protection
- **Audit log retention:** Archive → purge, 20 năm, daily job, advisory lock

### v0.2.x — Core Platform

- **5 vai trò RBAC:** Công dân, Cán bộ thụ lý, Xác minh viên, Lãnh đạo, Quản trị viên — 27 quyền chi tiết
- **Bản đồ GIS:** PostGIS (SRID 4326), ranh giới hành chính quận/phường Hà Nội, Leaflet
- **Biên bản & Quyết định:** Theo NĐ 16/2022, theo dõi khắc phục hậu quả
- **Cổng công dân:** Báo cáo vi phạm với vị trí trên bản đồ, ảnh minh chứng, theo dõi trạng thái
- **Admin CRUD:** Quận/huyện, phường/xã, danh mục, người dùng, phân quyền
- **Hardening:** Helmet headers, rate limit, upload magic-byte, health checks
- **Xuất dữ liệu:** CSV, PDF, DOCX + PII masking theo quyền

---

## 🛠️ Stack

| Thành phần    | Công nghệ                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| Backend       | Node.js 24, Express 5, pg, bcryptjs, jsonwebtoken, multer, helmet, express-rate-limit |
| Frontend      | React 19, Vite, Leaflet                                                               |
| Database      | PostgreSQL 16 + PostGIS 3.4                                                           |
| Reverse proxy | Caddy 2.8 (auto-HTTPS khi có domain thật)                                             |

---

## 🚀 Quick Start

### Phát triển (không Docker)

```bash
# 1. Khởi động PostgreSQL
source toolchain/scripts/env.sh && pg-start

# 2. Tạo database
bash sql/setup-db.sh

# 3. Backend (terminal 1)
cd app/backend && npm install
JWT_SECRET=dev-secret-at-least-32-characters PORT=3001 npm run dev

# 4. Frontend (terminal 2)
cd app/frontend && npm install
VITE_API_BASE_URL=http://localhost:3001 npm run dev
```

Truy cập http://localhost:5173 → Đăng ký quản trị viên đầu tiên.

### Docker Compose

```bash
cd app
cp .env.example .env
# Chỉnh .env: POSTGRES_PASSWORD, JWT_SECRET (≥32 ký tự)

docker compose up --build -d
```

Truy cập http://localhost → Đăng ký admin → Dashboard.

> Hướng dẫn chi tiết: [app/README.md](app/README.md)

---

## 📡 API Endpoints

| Module              | Endpoints                                                      | Ghi chú                              |
| ------------------- | -------------------------------------------------------------- | ------------------------------------ |
| Auth                | `setup-status`, `setup-admin`, `login`, `logout`, `password`   | JWT + rate-limit + cookie refresh    |
| Admin Users         | CRUD người dùng, vai trò, phân quyền                           | Cần `admin.users`                    |
| Admin Locations     | CRUD quận/huyện, phường/xã + boundary GeoJSON                  | Cần `admin.locations`                |
| Audit Log           | `GET /api/v1/admin/audit-log` + filter + phân trang            | Cần `admin.audit`                    |
| Hồ sơ               | CRUD hồ sơ, chuyển trạng thái, biên bản, quyết định, khắc phục | 15 trạng thái, role × state matrix  |
| Báo cáo             | Tạo + theo dõi báo cáo vi phạm                                 | Công dân                             |
| Thống kê            | Tổng quan, xuất CSV/PDF + PII masking                          | Cần `report.statistics`              |
| Config              | GET/PUT/POST config theo category, history, rollback           | Cần `admin.config` (v0.3.3)         |
| Workflow            | States, transitions, role-permissions                          | Admin (v0.3.3)                       |
| Config Import/Export| Export toàn bộ / Import batch config                           | Admin (v0.3.3)                       |
| Validation Rules    | GET validation rules                                           | Admin (v0.3.3)                       |
| Notification        | SSE stream, channels, allowed MIME types                       | Authenticated users                  |
| Health              | `/health`, `/health/live`, `/health/ready`, `/health/detailed` | DB ping + uptime + version           |

> Danh sách đầy đủ: [app/README.md § API Endpoints](app/README.md#api-endpoints)

---

## 📂 Cấu trúc dự án

```
qlttxd/
├── README.md                         ← Bạn đang đọc
├── BRIEF.md                          # Tóm tắt dự án
├── CHANGELOG.md                      # Lịch sử thay đổi
├── app/
│   ├── docker-compose.yml
│   ├── backend/                      # Node.js + Express API
│   │   ├── server.js                 # App factory (helmet, rate-limit, audit)
│   │   ├── lib/config-service.js     # ConfigService — DB-backed config platform
│   │   ├── routes/config.js          # 17 Config API endpoints
│   │   ├── routes/auth.js            # Auth + health + readiness
│   │   ├── routes/ho-so.js           # Hồ sơ CRUD + state machine
│   │   ├── routes/bao-cao.js         # Báo cáo vi phạm
│   │   ├── routes/thong-bao.js       # SSE notifications
│   │   ├── routes/admin-users.js     # User management
│   │   ├── routes/admin-locations.js # GIS locations
│   │   ├── routes/admin-catalogs.js  # Danh mục
│   │   ├── routes/ban-do.js          # Bản đồ GIS
│   │   ├── routes/thong-ke.js        # Statistics + export
│   │   ├── utils/                    # middleware, helpers, rate-limit, constants
│   │   ├── jobs/                     # audit-retention, cleanup workers
│   │   ├── migrations/               # 001–005 schema migrations
│   │   └── test/                     # 26 test files
│   ├── frontend/                     # React 19 + Vite SPA
│   │   ├── src/
│   │   │   ├── lib/                  # api.js, ConfigContext, AuthContext, constants
│   │   │   ├── admin/                # Settings Center (12 pages), admin pages
│   │   │   ├── pages/                # Dashboard, CaseList, CaseDetail, CitizenPage...
│   │   │   ├── components/           # Login, Tabs, Lightbox, Dialog...
│   │   │   └── styles.css            # Design system (CSS variables + classes)
│   │   └── test/                     # Vitest + React Testing Library
│   ├── db/init/                      # Schema + seed SQL
│   └── scripts/                      # Backup, update
├── docs/                             # Tài liệu dự án
│   ├── screenshots/                  # Ảnh demo UI (v0.2.0, v0.2.1, v0.3.2, v0.3.3)
│   ├── specs/                        # Task specifications
│   └── *.md                          # Thiết kế, quy trình, kế hoạch
├── sql/                              # Database (schema, seed, migrations, verify)
├── scripts/                          # Staging + screenshot scripts
└── taplieu/                          # Văn bản pháp luật (NĐ15, NĐ16, NĐ50, NĐ62)
```

---

## 🧪 Tests

```bash
# Backend (26 test files)
cd app/backend && npm test

# Frontend (12 test files)
cd app/frontend && npx vitest run

# Config API tests
cd app/backend && node --test test/config-service.test.js --test-concurrency=1
```

| Kiểm tra                | Kết quả                     |
| ----------------------- | --------------------------- |
| Backend tests           | 264+ tests (26 files)       |
| Frontend tests          | 70/70 PASS (12 files)       |
| Config API tests        | 37/37 PASS                  |
| Frontend build          | ✅ SUCCESS                  |
| Security smoke          | 0 HIGH findings             |

---

## 🔒 Bảo mật

- **Authentication:** JWT access (5 phút) + refresh token (7 ngày) qua HttpOnly cookie
- **Authorization:** RBAC 5 vai trò, 27 quyền, role × state transition matrix
- **Rate limiting:** Global (100 req/15min), Auth (10 req/15min), Write (30 req/15min), User-level
- **Security headers:** Helmet (CSP, HSTS 1 năm, nosniff, X-Frame-Options, Referrer-Policy)
- **Upload:** Magic-byte validation (JPEG/PNG/GIF/WebP), size limit (configurable)
- **Password:** Bcrypt (configurable rounds), min 32-char JWT_SECRET enforced
- **Audit:** Full CRUD logging với user, action, table, IP, request_id
- **PII masking:** Phone/email che theo quyền
- **Token management:** Blocklist, cleanup workers, password change revokes all tokens

---

## 📋 Version History

| Version | Ngày       | Highlight                                          |
| ------- | ---------- | -------------------------------------------------- |
| v0.3.3  | 2026-08-09 | Enterprise Settings Center — ConfigService + 12 UI |
| v0.3.2  | 2026-08-08 | Security hardening, real-time SSE, DOCX export     |
| v0.3.x  | 2026-08-07 | Workflow UX, 15 states, role × state matrix        |
| v0.2.1  | 2026-08-06 | Helmet, rate limit, audit log, CSV/PDF export      |
| v0.2.0  | 2026-08-03 | RBAC, GIS, admin CRUD, hardening                   |

> CHANGELOG đầy đủ: [CHANGELOG.md](CHANGELOG.md)

---

## 📚 Tài liệu

| Tài liệu                                                                   | Mô tả                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [CHANGELOG.md](CHANGELOG.md)                                               | Lịch sử thay đổi chi tiết                                              |
| [BRIEF.md](BRIEF.md)                                                       | Tóm tắt dự án                                                           |
| [app/README.md](app/README.md)                                             | Hướng dẫn triển khai (Docker, backup, update, troubleshooting)         |
| [docs/00-tong-ket.md](docs/00-tong-ket.md)                                 | Tổng kết kiến trúc                                                      |
| [docs/01-phan-tich-phap-ly.md](docs/01-phan-tich-phap-ly.md)               | Phân tích pháp lý                                                       |
| [docs/02-quy-trinh-nghiep-vu.md](docs/02-quy-trinh-nghiep-vu.md)           | Quy trình nghiệp vụ                                                     |
| [docs/04-thiet-ke-csdl.md](docs/04-thiet-ke-csdl.md)                       | Thiết kế CSDL                                                           |
| [docs/07-huong-dan-van-hanh.md](docs/07-huong-dan-van-hanh.md)             | Hướng dẫn vận hành                                                      |
| [docs/screenshots/README.md](docs/screenshots/README.md)                   | Index screenshots                                                       |

---

## 📄 License

Private project — Quản lý Trật tự Xây dựng.
