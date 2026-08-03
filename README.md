# QLTTXD — Hệ thống Quản lý Trật tự Xây dựng

Hệ thống quản lý xử lý vi phạm trật tự xây dựng, hỗ trợ toàn bộ luồng nghiệp vụ: người dân báo cáo → tiếp nhận → xác minh → lập biên bản → ban hành quyết định → theo dõi khắc phục → đóng hồ sơ.

## Tính năng

- **Xác thực & Phân quyền:** JWT, 5 vai trò (công dân, cán bộ thụ lý, xác minh, lãnh đạo, quản trị), 13 quyền chi tiết theo module.
- **Quản lý hồ sơ:** Luồng trạng thái có kiểm soát (13 trạng thái), chuyển trạng thái hợp lệ, audit log bất biến.
- **Bản đồ GIS:** PostGIS (SRID 4326), ranh giới hành chính quận/phường Hà Nội, hiển thị vị trí vi phạm trên Leaflet.
- **Biên bản & Quyết định:** Lập biên bản, ban hành quyết định xử phạt (theo NĐ 16/2022), theo dõi khắc phục hậu quả.
- **Cổng công dân:** Báo cáo vi phạm với vị trí trên bản đồ, ảnh minh chứng, theo dõi trạng thái.
- **Quản trị:** Quản lý người dùng, vai trò, phân quyền qua giao diện admin.

## Stack

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js 24, Express 5, pg, bcryptjs, jsonwebtoken, multer |
| Frontend | React 19, Vite, Leaflet |
| Cơ sở dữ liệu | PostgreSQL 16 + PostGIS 3.4 |
| Reverse proxy | Caddy 2.8 (auto-HTTPS khi có domain thật) |

## Cấu trúc thư mục

```text
app/
├── docker-compose.yml          # Stack Docker: db + backend + caddy
├── Caddyfile                   # Cấu hình Caddy (reverse proxy + serve frontend)
├── .env.example                # Template biến môi trường
├── README.md
├── TODO.md
├── db/init/
│   ├── 01-schema.sql           # Schema CSDL (19 bảng + PostGIS + seed Điều 16)
│   └── 02-seed.sql             # Seed GIS (quận/phường HN) + RBAC role_permissions
├── backend/
│   ├── server.js               # API server (auth, RBAC, hồ sơ, biên bản, GIS)
│   ├── token-blocklist.js      # Token blocklist (logout an toàn)
│   ├── package.json
│   ├── Dockerfile
│   └── test/                   # 45 unit test
├── frontend/
│   ├── src/main.jsx            # SPA (login, dashboard, hồ sơ, admin, GIS map)
│   ├── src/styles.css
│   ├── index.html
│   ├── package.json
│   ├── Dockerfile.caddy        # Multi-stage: build + Caddy serve
│   └── nginx.conf              # (legacy, không dùng trong Docker Compose)
└── scripts/
    ├── backup.sh               # Backup PostgreSQL + uploads volume
    ├── update.sh               # Pull + rebuild + restart + health check
    └── ...
```

## Chạy phát triển (không Docker)

Cần Node.js 24+ và PostgreSQL/PostGIS. Dùng toolchain có sẵn hoặc cài mới:

```bash
# Khởi động PostgreSQL (toolchain)
source toolchain/scripts/env.sh && pg-start

# Tạo database
bash qlttxd/sql/setup-db.sh

# Backend
cd app/backend
npm install
JWT_SECRET=dev-secret-at-least-32-characters PORT=3001 npm run dev

# Frontend (terminal khác)
cd app/frontend
npm install
VITE_API_BASE_URL=http://localhost:3001 npm run dev
```

Truy cập http://localhost:5173 → Lần đầu hiện form đăng ký quản trị viên.

## Chạy bằng Docker

```bash
cd app
cp .env.example .env
# Chỉnh sửa .env: POSTGRES_PASSWORD, JWT_SECRET (tối thiểu 32 ký tự)

docker compose up --build -d
```

- Lần đầu: http://localhost → hiện form đăng ký quản trị viên đầu tiên.
- Đăng ký admin → tự động đăng nhập → thấy dashboard.
- Tạo user khác (công dân, cán bộ) qua menu Quản trị → Người dùng.

```bash
# Xem log
docker compose logs -f

# Reset toàn bộ (mất dữ liệu)
docker compose down -v
docker compose up --build -d
```

---

## 1. YÊU CẦU HỆ THỐNG

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
|---|---|---|
| Docker Engine | 24.0+ | 26.0+ |
| Docker Compose | v2.x (plugin) | v2.27+ |
| RAM | 2 GB | 4 GB+ |
| Disk | 5 GB (db + uploads + images) | 20 GB+ |
| Ports | 80 (HTTP), 443 (HTTPS) | — |
| OS | Ubuntu 22.04+ / Debian 12 | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2+ vCPU |

> **Lưu ý:** Port 80/443 cần quyền root hoặc `setcap 'cap_net_bind_service=+ep' $(which docker-proxy)`. Trên Ubuntu/Debian cài Docker qua apt/snap thì đã sẵn sàng.

---

## 2. TRIỂN KHAI NHANH (DOCKER COMPOSE)

```bash
# 1. Clone source
git clone <repo-url> qlttxd
cd qlttxd/app

# 2. Cấu hình biến môi trường
cp .env.example .env
# Chỉnh .env: POSTGRES_PASSWORD=<mạnh>, JWT_SECRET=<≥32 ký tự>
# Mẹo tạo JWT_SECRET: openssl rand -hex 32

# 3. Khởi động stack
docker compose -f docker-compose.yml up --build -d

# 4. Kiểm tra health
curl http://localhost/health
# → {"status":"ok"}

# 5. Mở trình duyệt
# http://localhost  (hoặc domain thật nếu đã cấu hình DOMAIN)
```

**Lần đầu chạy:** Caddy phục vụ frontend, hiện form **Đăng ký quản trị viên đầu tiên** → sau khi submit sẽ tự động đăng nhập và chuyển về Dashboard.

---

## 3. CẤU HÌNH (BIẾN MÔI TRƯỜNG)

File mẫu: `app/.env.example`. Bảng dưới đây phản ánh **chính xác** các biến trong file đó:

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | — | Mật khẩu PostgreSQL (user `qlttxd`) |
| `JWT_SECRET` | ✅ | — | Khóa ký JWT (tối thiểu 32 ký tự) |
| `CORS_ORIGIN` | — | `http://localhost` | Domain được phép gọi API (dùng cho dev) |
| `DOMAIN` | — | `localhost` | Domain Caddy phục vụ (để Caddy xin TLS tự động) |
| `HTTP_PORT` | — | `80` | Cổng HTTP public (map vào caddy:80) |
| `HTTPS_PORT` | — | `443` | Cổng HTTPS public (map vào caddy:443) |

**Ví dụ `.env` cho staging:**

```bash
POSTGRES_PASSWORD=SuperSecretDBPass2026
JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CORS_ORIGIN=https://staging.qlttxd.example.gov.vn
DOMAIN=staging.qlttxd.example.gov.vn
HTTP_PORT=80
HTTPS_PORT=443
```

> **Caddy auto-HTTPS:** Khi `DOMAIN` là domain thật (không phải `localhost`), Caddy tự động xin certificate Let's Encrypt và bật HTTPS. Không cần cấu hình thêm.

---

## 4. SAO LƯU & PHỤC HỒI

Script: `app/scripts/backup.sh`

### Output của backup

Mỗi lần chạy tạo 2 file trong thư mục `backups/` (mặc định `./backups`, tùy biến qua `BACKUP_DIR`):

| File | Định dạng | Mô tả |
|---|---|---|
| `qlttxd-YYYYMMDD-HHMMSS.dump` | PostgreSQL custom format (`pg_dump -Fc`) | Toàn bộ database, bao gồm schema + dữ liệu + PostGIS |
| `uploads-YYYYMMDD-HHMMSS.tar.gz` | tar.gz | Nội dung volume `uploads_data` (ảnh minh chứng, tệp đính kèm) |

### Cron tự động (ví dụ)

```bash
# Chạy lúc 02:00 mỗi ngày, giữ log
0 2 * * * cd /path/to/qlttxd/app && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Script tự **xoá backup cũ**, chỉ giữ **14 bản mới nhất** của mỗi loại (dump + uploads).

### Phục hồi (Restore)

> ⚠️ **CẢNH BÁO:** Phục hồi đè dữ liệu hiện tại. Nên dừng app (`docker compose stop backend caddy`) hoặc chấp nhận downtime ngắn.

```bash
# 1. Dừng services ứng dụng (giữ db chạy)
docker compose stop backend caddy

# 2. Restore database
docker compose exec -T db pg_restore -U qlttxd -d qlttxd --clean --if-exists < backups/qlttxd-20260115-020000.dump

# 3. Restore uploads volume
docker run --rm \
  -v "$(docker volume ls -qf name=uploads_data$)":/data \
  -v "$PWD/backups":/backup \
  alpine tar xzf "/backup/uploads-20260115-020000.tar.gz" -C /data

# 4. Khởi động lại
docker compose start backend caddy
```

> **Mẹo:** Nếu volume tên khác (do docker compose prefix project name), xác định bằng: `docker volume ls --format '{{.Name}}' | grep uploads_data`

---

## 5. CẬP NHẬT PHIÊN BẢN

Script: `app/scripts/update.sh` (5 bước)

```bash
cd /path/to/qlttxd/app
./scripts/update.sh
```

### Các bước thực hiện

| Bước | Hành động | Lưu ý |
|---|---|---|
| **1/5** | Chạy `./scripts/backup.sh` | Backup trước khi cập nhật (bỏ qua nếu script không tồn tại) |
| **2/5** | `git pull --ff-only` | Chỉ fast-forward; nếu không phải git repo → cảnh báo và hướng dẫn update thủ công |
| **3/5** | `docker compose build --no-cache` | Rebuild image mới hoàn toàn (bỏ cache) |
| **4/5** | `docker compose up -d` | Khởi động lại container — **KHÔNG dùng `down -v`**, volume data được bảo toàn |
| **5/5** | Health check `http://localhost/health` | Thử tối đa 12 lần (mỗi 5s); thất bại → in hướng dẫn troubleshooting |

### Lưu ý quan trọng

- **`db/init` chỉ chạy lần đầu** trên volume mới (`postgres_data`). Nếu có migration SQL mới, phải chạy thủ công:
  ```bash
  docker compose exec -T db psql -U qlttxd -d qlttxd -f /docker-entrypoint-initdb.d/01-schema.sql
  ```
- Không bao giờ dùng `docker compose down -v` khi update — lệnh này **xoá toàn bộ dữ liệu** (database + uploads).

---

## 6. XỬ LÝ SỰ CỐ (TROUBLESHOOTING)

### Xem log

```bash
# Tất cả services
docker compose -f docker-compose.yml logs -f

# Chỉ backend
docker compose logs backend --tail=100

# Chỉ database
docker compose logs db --tail=50
```

### Health check thất bại (`/health` không trả `{"status":"ok"}`)

| Nguyên nhân | Kiểm tra / Khắc phục |
|---|---|
| Backend chưa sẵn sàng | `docker compose ps` — chờ `backend` trạng thái `healthy` (depends_on `db:service_healthy`) |
| DB chưa khởi động xong | `docker compose exec db pg_isready -U qlttxd` |
| Network container | `docker network inspect qlttxd_default` — backend ↔ db phải cùng network |
| Caddy không proxy đúng | Kiểm tra `Caddyfile`: handle `/health` → `reverse_proxy http://backend:3001` |
| Port 80/443 bị chiếm | `ss -ltnp 'sport = :80'` — dừng tiến trình khác hoặc đổi `HTTP_PORT`/`HTTPS_PORT` trong `.env` |

### Cổng 80/443 bị chiếm

```bash
# Xem tiến trình đang lắng nghe
sudo ss -ltnp 'sport = :80'
sudo ss -ltnp 'sport = :443'

# Khắc phục: dừng nginx/apache hoặc đổi port trong .env
# HTTP_PORT=8080 HTTPS_PORT=8443
```

### Reset mất dữ liệu (CẢNH BÁO)

```bash
# ⚠️ XOÁ TOÀN BỘ DỮ LIỆU: database + uploads + caddy certs
docker compose down -v
docker compose up --build -d
```

> Chỉ dùng khi chấp nhận mất dữ liệu hoặc muốn khởi tạo lại từ đầu.

---

## 7. CẤU TRÚC THƯ MỤC CHI TIẾT

```
app/
├── docker-compose.yml          # Stack: db + backend + caddy
├── Caddyfile                   # Reverse proxy + SPA fallback + /health
├── .env.example                # Template biến môi trường
├── README.md                   # File này
├── TODO.md
├── db/
│   └── init/
│       ├── 01-schema.sql       # Schema 19 bảng + PostGIS + seed Điều 16
│       └── 02-seed.sql         # Seed GIS (quận/phường HN) + RBAC
├── backend/
│   ├── server.js               # Express 5 API (auth, RBAC, hồ sơ, biên bản, GIS)
│   ├── token-blocklist.js      # JWT blocklist (logout an toàn)
│   ├── package.json
│   ├── Dockerfile              # Node 24 Alpine, npm ci --omit=dev
│   └── test/                   # 45 unit/integration test (npm test)
├── frontend/
│   ├── src/main.jsx            # React 19 SPA (login, dashboard, hồ sơ, admin, map)
│   ├── src/styles.css
│   ├── index.html
│   ├── package.json
│   ├── Dockerfile.caddy        # Multi-stage: Vite build → Caddy serve
│   └── nginx.conf              # Legacy (không dùng trong compose)
├── scripts/
│   ├── backup.sh               # Backup DB + uploads, rotate 14 bản
│   └── update.sh               # Git pull + rebuild + restart + health check
└── backups/                    # Thư mục chứa file backup (tự tạo khi chạy backup.sh)
    ├── qlttxd-YYYYMMDD-HHMMSS.dump
    ├── uploads-YYYYMMDD-HHMMSS.tar.gz
    └── backup.log              # Log cron (nếu cấu hình)
```

---

## API Endpoints

### Auth

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/auth/setup-status` | Kiểm tra cần setup admin đầu tiên |
| POST | `/api/v1/auth/setup-admin` | Đăng ký admin đầu tiên |
| POST | `/api/v1/auth/login` | Đăng nhập |
| POST | `/api/v1/auth/logout` | Đăng xuất (thu hồi token) |

### Admin (cần quyền `admin.users`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/users` | Danh sách người dùng |
| POST | `/api/v1/admin/users` | Tạo người dùng |
| PATCH | `/api/v1/admin/users/:id` | Cập nhật người dùng |
| GET | `/api/v1/admin/roles` | Danh sách vai trò |
| PATCH | `/api/v1/admin/roles/:id/permissions` | Cập nhật quyền cho vai trò |
| GET | `/api/v1/admin/permissions` | Danh sách quyền (theo module) |

### Hồ sơ (cần quyền `case.view`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/ho-so` | Danh sách hồ sơ (phân trang, lọc) |
| GET | `/api/v1/ho-so/:id` | Chi tiết hồ sơ |
| PATCH | `/api/v1/ho-so/:id/trang-thai` | Chuyển trạng thái |
| POST | `/api/v1/ho-so/:id/bien-ban` | Lập biên bản |
| POST | `/api/v1/ho-so/:id/quyet-dinh` | Ban hành quyết định |
| POST | `/api/v1/ho-so/:id/khac-phuc` | Đăng ký khắc phục |

### Báo cáo (công dân)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/bao-cao` | Báo cáo của người dùng |
| POST | `/api/v1/bao-cao` | Tạo báo cáo vi phạm |

### Khác

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra trạng thái |
| GET | `/api/v1/thong-ke/tong-quan` | Thống kê tổng quan |
| GET | `/api/v1/danh-muc/quan-huyen` | Danh mục quận/huyện |

---

## Biến môi trường (tóm tắt)

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | — | Mật khẩu PostgreSQL |
| `JWT_SECRET` | ✅ | — | Khóa JWT (tối thiểu 32 ký tự) |
| `CORS_ORIGIN` | — | `http://localhost` | Domain được phép gọi API |
| `DOMAIN` | — | `localhost` | Domain Caddy phục vụ |
| `HTTP_PORT` | — | `80` | Cổng HTTP |
| `HTTPS_PORT` | — | `443` | Cổng HTTPS |

---

## Test

```bash
cd app/backend
npm test        # 45 unit/integration test
```

---

## Triển khai staging/production

1. Chỉnh `.env`: `DOMAIN=staging.qlttxd.example.gov.vn`, `CORS_ORIGIN=https://staging.qlttxd.example.gov.vn`
2. Caddy tự động xin certificate Let's Encrypt khi có domain thật.
3. Đổi mật khẩu PostgreSQL và JWT_SECRET bằng giá trị mạnh.
4. Backup: `docker compose exec db pg_dump -U qlttxd qlttxd > backup.sql`
5. Cấu hình cron backup: `0 2 * * * cd /path/to/app && ./scripts/backup.sh >> backups/backup.log 2>&1`