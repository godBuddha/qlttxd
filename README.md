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

|| Tổng quan                                          | Auth                                             | Rate Limit                                        |
|| -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
|| ![Settings Overview](app/frontend/src/admin/__screenshots__/settings-overview.svg) | ![Auth Settings](app/frontend/src/admin/__screenshots__/settings-auth.svg) | ![Rate Limit](app/frontend/src/admin/__screenshots__/settings-rate-limit.svg) |

|| Workflow States                                    | Role Permissions                                 | Upload                                            |
|| -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
|| ![Workflow States](app/frontend/src/admin/__screenshots__/settings-workflow-states.svg) | ![Role Perms](app/frontend/src/admin/__screenshots__/settings-role-permissions.svg) | ![Upload](app/frontend/src/admin/__screenshots__/settings-upload.svg) |

## ✨ Tính năng v0.3.3 — Enterprise Settings Center

- **ConfigService:** Cấu hình runtime từ database (`system_config` table), cache-in-memory, pg_notify real-time push
- **17 Config API endpoints:** GET/PUT `config`, workflow states/transitions/role-permissions, export/import, validation rules, notification channels, MIME types, config history + rollback
- **Migration 005:** 9 bảng mới (system_config, config_history, config_schema, workflow_states, workflow_transitions, role_state_permissions, allowed_mime_types, notification_channels, validation_rules) với 54 seed records
- **ConfigProvider React Context:** Dynamic config cho toàn bộ app (JWT TTL, bcrypt rounds, rate limits, upload limits...)
- **useConfig hook:** Declarative config access trong components
- **12 Settings pages** — Admin UI: Overview, Auth, Upload, Rate Limit, Security, Notifications, Pagination, Cleanup, Pool, SSE, Version, Workflows (States/Transitions/Role Permissions)

---

## ✨ Tính năng v0.2.1

- **Hardening bảo mật:** Helmet security headers (CSP/HSTS/nosniff), Rate limit cho auth endpoints (429)
- **Health mở rộng:** DB ping + uptime + version
- **Đổi mật khẩu:** Endpoint `PATCH /api/v1/auth/password`
- **Audit log:** Endpoint `GET /api/v1/admin/audit-log` với filter + phân trang
- **Xuất báo cáo:** CSV + PII masking theo quyền
- **Xuất PDF:** Báo cáo PDF tiếng Việt

### Frontend mới

- Trang Nhật ký hệ thống (Audit Log) — admin
- Trang Danh mục (loại vi phạm, hành vi, mức phạt) — admin
- Trang Hồ sơ cá nhân + đổi mật khẩu — tất cả user
- Trang Báo cáo/Thống kê + nút xuất CSV/PDF
- Hiển thị ảnh minh chứng trong chi tiết hồ sơ

### Cải tiến

- `schema_migrations` table trong schema
- `GET /api/v1/ho-so/:id` trả thêm `khac_phuc[]`
- `admin.locations` permission trong seed

### Dependencies mới

- Backend: `helmet`, `express-rate-limit`, `csv-stringify`, `pdfkit`

## ✨ Tính năng v0.3.2

- **Sinh văn bản hành chính DOCX:** Biên bản & Quyết định xử phạt theo thể thức NĐ 30/2020/NĐ-CP
- **Client-side routing:** Browser history (Back/Forward, deep-link), mỗi route lazy-load + ErrorBoundary riêng
- **Real-time thông báo:** SSE push qua `EventSource` (thay polling), fallback polling + auto-reconnect
- **Bảo mật nâng cao:** Token refresh qua HttpOnly cookie, JWT không lộ qua URL (blob-based image), password change revoke toàn bộ token, CSP cứng, RATE_LIMIT + user-level limiter
- **Pagination:** Danh sách hồ sơ, báo cáo, bản đồ, admin users, audit log
- **Frontend test suite:** Vitest + React Testing Library
- **Service worker:** Offline fallback, cache versioned per build (không stale)

## ✨ Tính năng v0.2.0

- **Quản lý địa điểm:** Admin CRUD quận/huyện & phường/xã, nhập boundary GeoJSON MultiPolygon (SRID 4326) với preview bản đồ Leaflet, chặn xóa khi có ràng buộc, audit log đầy đủ.
- **Hardening bảo mật:** Rate limit (login/auth/upload), Helmet security headers (CSP/HSTS/nosniff), Upload kiểm tra magic-byte (JPEG/PNG/GIF/WebP), Script dọn tệp mồ côi, Health endpoint mở rộng.
- **Báo cáo & Xuất dữ liệu:** Xuất CSV/PDF theo trạng thái/quận/tháng, che dữ liệu cá nhân (PII) theo quyền, phân trang batch cho dữ liệu lớn.
- **5 vai trò RBAC:** Công dân, Cán bộ thụ lý, Xác minh viên, Lãnh đạo, Quản trị viên — 27 quyền chi tiết theo module.
- **13 trạng thái hồ sơ:** Luồng trạng thái có kiểm soát, audit log bất biến.
- **Bản đồ GIS:** PostGIS (SRID 4326), ranh giới hành chính quận/phường Hà Nội, hiển thị vị trí vi phạm trên Leaflet.
- **Biên bản & Quyết định:** Theo NĐ 16/2022, theo dõi khắc phục hậu quả.
- **Cổng công dân:** Báo cáo vi phạm với vị trí trên bản đồ, ảnh minh chứng, theo dõi trạng thái.

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

| Module          | Endpoints                                                      | Ghi chú                         |
| --------------- | -------------------------------------------------------------- | ------------------------------- |
| Auth            | `setup-status`, `setup-admin`, `login`, `logout`, `password`   | JWT + rate-limit + đổi mật khẩu |
| Admin Users     | CRUD người dùng, vai trò, phân quyền                           | Cần `admin.users`               |
| Admin Locations | CRUD quận/huyện, phường/xã + boundary GeoJSON                  | Cần `admin.locations`           |
| Audit Log       | `GET /api/v1/admin/audit-log` + filter + phân trang            | Cần `admin.audit` (v0.2.1)      |
| Hồ sơ           | CRUD hồ sơ, chuyển trạng thái, biên bản, quyết định, khắc phục | 13 trạng thái                   |
| Báo cáo         | Tạo + theo dõi báo cáo vi phạm                                 | Công dân                        |
| Thống kê        | Tổng quan, xuất CSV/PDF + PII masking                          | Cần `report.statistics`         |
| Health          | `/health`                                                      | DB ping + uptime + version      |

> Danh sách đầy đủ: [app/README.md § API Endpoints](app/README.md#api-endpoints)

---

## 📂 Cấu trúc dự án

```
qlttxd/
├── README.md                    ← Bạn đang đọc
├── BRIEF.md                     # Tóm tắt dự án
├── CHANGELOG.md                 # Lịch sử thay đổi
├── app/                         # Ứng dụng self-host
│   ├── docker-compose.yml
│   ├── backend/                 # Node.js + Express API
│   │   ├── server.js            # Main app (helmet, rate-limit, audit)
│   │   └── test/                # 91 tests (hardening, reporting, export)
│   ├── frontend/                # React 19 + Vite SPA
│   ├── db/init/                 # Schema + seed SQL
│   └── scripts/                 # Backup, update
├── docs/                        # Tài liệu dự án
│   ├── 00-tong-ket.md           # Tổng kết
│   ├── 01..09-*.md              # Thiết kế, quy trình
│   ├── 10..11-*.md              # Kế hoạch v0.2.0
│   ├── screenshots/             # Ảnh demo UI
│   │   ├── v0.2.0-full/         # 24 ảnh toàn bộ UI v0.2.0
│   │   ├── v0.2.1/              # 26 ảnh UI v0.2.1
│   │   └── README.md            # Index + mô tả ảnh
│   ├── specs/v0.2.1/            # 15 task specs v0.2.1
│   └── BOM-v0.2.0.md           # Bill of Materials
├── sql/                         # Database (schema, seed, migrations, verify)
├── scripts/                     # Staging + screenshot scripts
└── taplieu/                     # Văn bản pháp luật (NĐ15, NĐ16, NĐ50, NĐ62)
```

---

## 🧪 Test

```bash
cd app/backend
npm test        # 70 unit/integration test
```

| Kiểm tra           | Kết quả                    |
| ------------------ | -------------------------- |
| Backend unit tests | 91/91 PASS                 |
| Frontend build     | ✅                         |
| verify-db.sql      | 18/18 PASS                 |
| Security smoke     | 0 HIGH findings (7 checks) |

---

## 📋 CHANGELOG v0.2.0

**Ngày:** 2026-08-03

### Tính năng mới

- **Quản lý địa điểm:** 8 endpoints CRUD quận/huyện + phường/xã, boundary GeoJSON MultiPolygon, preview bản đồ, guard xóa an toàn (409), audit log.
- **Hardening bảo mật:** Rate limit, Helmet headers, upload magic-byte, dọn tệp mồ côi, health endpoint mở rộng.
- **Báo cáo & Xuất dữ liệu:** Xuất CSV/PDF, che PII theo quyền, phân trang batch.
- **Permission mới:** `admin.locations`, `report.statistics`.

### Cải tiến

- Migration 002 idempotent (up/down).
- verify-db.sql: 18 assertions (admin.locations, migration 002, audit indexes, request_id).
- Frontend: AdminLocationsPage (2 panel, modal, preview polygon), menu Địa điểm theo permission.

### Dependencies mới

- Backend: `express-rate-limit`, `helmet`, `file-type`, `pdfkit`, `csv-stringify`
- Frontend: Không thêm runtime dependency

> CHANGELOG đầy đủ: [app/README.md § CHANGELOG](app/README.md#changelog-v020)

---

## 📋 CHANGELOG v0.2.1

**Ngày:** 2026-08-06

### Tính năng mới

- **Hardening bảo mật:** Helmet security headers (CSP/HSTS/nosniff), Rate limit cho auth endpoints (429)
- **Health mở rộng:** DB ping + uptime + version
- **Đổi mật khẩu:** Endpoint `PATCH /api/v1/auth/password`
- **Audit log:** Endpoint `GET /api/v1/admin/audit-log` với filter + phân trang
- **Xuất báo cáo:** CSV + PII masking theo quyền
- **Xuất PDF:** Báo cáo PDF tiếng Việt

### Frontend mới

- Trang Nhật ký hệ thống (Audit Log) — admin
- Trang Danh mục (loại vi phạm, hành vi, mức phạt) — admin
- Trang Hồ sơ cá nhân + đổi mật khẩu — tất cả user
- Trang Báo cáo/Thống kê + nút xuất CSV/PDF
- Hiển thị ảnh minh chứng trong chi tiết hồ sơ

### Cải tiến

- `schema_migrations` table trong schema
- `GET /api/v1/ho-so/:id` trả thêm `khac_phuc[]`
- `admin.locations` permission trong seed

### Dependencies mới

- Backend: `helmet`, `express-rate-limit`, `csv-stringify`, `pdfkit`

> CHANGELOG đầy đủ: [CHANGELOG.md](CHANGELOG.md)

---

## 📚 Tài liệu

| Tài liệu                                                                   | Mô tả                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [app/README.md](app/README.md)                                             | Hướng dẫn triển khai chi tiết (Docker, backup, update, troubleshooting) |
| [BRIEF.md](BRIEF.md)                                                       | Tóm tắt dự án                                                           |
| [docs/00-tong-ket.md](docs/00-tong-ket.md)                                 | Tổng kết kiến trúc                                                      |
| [docs/01-phan-tich-phap-ly.md](docs/01-phan-tich-phap-ly.md)               | Phân tích pháp lý                                                       |
| [docs/02-quy-trinh-nghiep-vu.md](docs/02-quy-trinh-nghiep-vu.md)           | Quy trình nghiệp vụ                                                     |
| [docs/03-dac-ta-nghiep-vu.md](docs/03-dac-ta-nghiep-vu.md)                 | Đặc tả nghiệp vụ                                                        |
| [docs/04-thiet-ke-csdl.md](docs/04-thiet-ke-csdl.md)                       | Thiết kế CSDL                                                           |
| [docs/05-thiet-ke-giao-dien.md](docs/05-thiet-ke-giao-dien.md)             | Thiết kế giao diện                                                      |
| [docs/06-postgis-toolchain.md](docs/06-postgis-toolchain.md)               | PostGIS toolchain                                                       |
| [docs/07-huong-dan-van-hanh.md](docs/07-huong-dan-van-hanh.md)             | Hướng dẫn vận hành                                                      |
| [docs/08-quality-gate-process.md](docs/08-quality-gate-process.md)         | Quality gate process                                                    |
| [docs/10-ke-hoach-nang-cap-v0.2.0.md](docs/10-ke-hoach-nang-cap-v0.2.0.md) | Kế hoạch nâng cấp v0.2.0                                                |
| [docs/11-task-spec-v0.2.0.md](docs/11-task-spec-v0.2.0.md)                 | Task specification v0.2.0                                               |
| [docs/BOM-v0.2.0.md](docs/BOM-v0.2.0.md)                                   | Bill of Materials                                                       |
| [docs/acceptance-matrix-v0.2.0.md](docs/acceptance-matrix-v0.2.0.md)       | Ma trận nghiệm thu                                                      |
| [docs/screenshots/README.md](docs/screenshots/README.md)                   | Index screenshots                                                       |

---

## 📄 License

Private project — Quản lý Trật tự Xây dựng.
