# QLTTXD — Hệ thống Quản lý Trật tự Xây dựng

> Xử lý vi phạm trật tự xây dựng: người dân báo cáo → tiếp nhận → xác minh → lập biên bản → ban hành quyết định → theo dõi khắc phục → đóng hồ sơ.

**v0.3.2** · Node.js 24 + React 19 + PostgreSQL 16/PostGIS · Self-hosted Docker

---

## 🖼️ Demo

### Đăng nhập & Đăng ký quản trị viên đầu tiên

|                                                                 |                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Trang đăng nhập](docs/screenshots/v0.2.0-full/login-page.png) | ![Đăng ký admin](docs/screenshots/v0.2.0-full/02-login-filled.png) |

### 👤 Quản trị viên

| Dashboard                                                            | Tổng quan                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ![Admin Dashboard](docs/screenshots/v0.2.0-full/admin-dashboard.png) | ![Admin Tổng quan](docs/screenshots/v0.2.0-full/admin-Tổng-quan.png) |

| Chi tiết hồ sơ                                                        | Timeline                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Chi tiết hồ sơ](docs/screenshots/v0.2.0-full/admin-case-detail.png) | ![Timeline](docs/screenshots/v0.2.0-full/admin-case-Timeline.png) |

| Biên bản                                                          | Quyết định                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| ![Biên bản](docs/screenshots/v0.2.0-full/admin-case-Biên-bản.png) | ![Quyết định](docs/screenshots/v0.2.0-full/admin-case-Quyết-định.png) |

| Khắc phục                                                           | Hồ sơ cá nhân                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| ![Khắc phục](docs/screenshots/v0.2.0-full/admin-case-Khắc-phục.png) | ![Hồ sơ](docs/screenshots/v0.2.0-full/admin-Hồ-sơ.png) |

### 📋 Cán bộ thụ lý (Handler)

| Dashboard                                                                | Tổng quan                                                                | Hồ sơ                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| ![Handler Dashboard](docs/screenshots/v0.2.0-full/handler-dashboard.png) | ![Handler Tổng quan](docs/screenshots/v0.2.0-full/handler-Tổng-quan.png) | ![Handler Hồ sơ](docs/screenshots/v0.2.0-full/handler-Hồ-sơ.png) |

### 🔍 Xác minh viên (Verifier)

| Dashboard                                                                  | Tổng quan                                                                  | Hồ sơ                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Verifier Dashboard](docs/screenshots/v0.2.0-full/verifier-dashboard.png) | ![Verifier Tổng quan](docs/screenshots/v0.2.0-full/verifier-Tổng-quan.png) | ![Verifier Hồ sơ](docs/screenshots/v0.2.0-full/verifier-Hồ-sơ.png) |

### 📊 Lãnh đạo (Leader)

| Dashboard                                                              | Tổng quan                                                              | Hồ sơ                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| ![Leader Dashboard](docs/screenshots/v0.2.0-full/leader-dashboard.png) | ![Leader Tổng quan](docs/screenshots/v0.2.0-full/leader-Tổng-quan.png) | ![Leader Hồ sơ](docs/screenshots/v0.2.0-full/leader-Hồ-sơ.png) |

### 🏠 Công dân (Citizen)

| Dashboard                                                                | Báo cáo vi phạm                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| ![Citizen Dashboard](docs/screenshots/v0.2.0-full/citizen-dashboard.png) | ![Báo cáo](docs/screenshots/v0.2.0-full/citizen-Báo-cáo.png) |

### 🆕 Tính năng mới v0.2.1

| Nhật ký hệ thống (Audit Log)                        | Danh mục quản lý                                 |
| --------------------------------------------------- | ------------------------------------------------ |
| ![Audit Log](docs/screenshots/v0.2.1/audit-log.png) | ![Danh mục](docs/screenshots/v0.2.1/catalog.png) |

| Hồ sơ cá nhân + Đổi mật khẩu                    | Báo cáo & Xuất dữ liệu                        |
| ----------------------------------------------- | --------------------------------------------- |
| ![Profile](docs/screenshots/v0.2.1/profile.png) | ![Report](docs/screenshots/v0.2.1/report.png) |

| Ảnh minh chứng                             | Security Headers                                  |
| ------------------------------------------ | ------------------------------------------------- |
| ![Ảnh](docs/screenshots/v0.2.1/images.png) | ![Security](docs/screenshots/v0.2.1/security.png) |

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
