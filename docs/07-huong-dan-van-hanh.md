# Hướng dẫn vận hành hệ thống QLTTXD (T7+T8)

> Bản ghi này tổng hợp cách chạy và vận hành hệ thống full-stack QLTTXD
> sau giai đoạn 2 (nâng cấp backend theo schema 19 bảng + PostGIS + RBAC,
> viết lại frontend kết nối API mới). Cập nhật 2026-08-02 sau khi test
> end-to-end thực tế.

## 1. Kiến trúc

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│ Frontend (Vite) │ HTTP │ Backend (Express)│  pg  │ PostgreSQL 16 + PostGIS│
│  React 19 +     │─────▶│  server.js       │─────▶│  qlttxd (19 bảng)     │
│  Leaflet        │ 3001 │  JWT + RBAC      │ 5432 │  socket /tmp          │
└─────────────────┘      └──────────────────┘      └──────────────────────┘
   VITE_API_BASE_URL=http://localhost:3001
```

## 2. Khởi động đầy đủ

```sh
# 1) Môi trường + PostgreSQL
cd /workspace/ssd
source toolchain/scripts/env.sh
pg-start

# 2) Cơ sở dữ liệu (chỉ lần đầu / khi cần reset — SẼ XÓA DỮ LIỆU CŨ)
bash qlttxd/sql/setup-db.sh

# 3) Backend API (port 3001)
cd qlttxd/app/backend
env PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres \
    JWT_SECRET=<chuỗi-bí-mật-dài> UPLOAD_DIR=/tmp/qlttxd-uploads PORT=3001 \
    /workspace/ssd/toolchain/node/bin/node server.js

# 4) Frontend (port 5173) — terminal riêng
cd qlttxd/app/frontend
VITE_API_BASE_URL=http://localhost:3001 \
    /workspace/ssd/toolchain/node/bin/npm run dev -- --port 5173
```

Truy cập: http://localhost:5173

## 3. Tài khoản demo

> **Lưu ý bảo mật**: mật khẩu demo KHÔNG được ghi trong tài liệu này.
> Xem `sql/seed.sql` (comment dòng đầu) hoặc hỏi quản trị viên để lấy
> mật khẩu mặc định. Đổi ngay sau khi đăng nhập lần đầu trong môi trường thật.

| Username     | Vai trò                    | Quyền chính                                        |
|--------------|----------------------------|----------------------------------------------------|
| `admin`      | Quản trị                   | toàn quyền (case.view, case.update, report.*...)   |
| `handler.hn` | Cán bộ tiếp nhận           | tiếp nhận hồ sơ, báo cáo                           |
| `verifier.hn`| Cán bộ xác minh            | xác minh, lập biên bản                             |
| `leader.hn`  | Lãnh đạo                   | thống kê, duyệt quyết định                         |
| `citizen.nga`| Công dân                   | report.create (báo cáo vi phạm)                    |

## 4. API chính (20 endpoint — chi tiết trong `app/backend/server.js`)

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` |
| Danh mục | `GET /api/v1/danh-muc/{loai-vi-pham,hanh-vi,muc-phat,quan-huyen,phuong-xa}` |
| Báo cáo | `POST /api/v1/bao-cao` (multipart, tối đa 5 ảnh, auto-dò quận/phường PostGIS), `GET /api/v1/bao-cao` |
| Hồ sơ | `POST /api/v1/ho-so`, `GET /api/v1/ho-so` (lọc/phân trang), `GET /api/v1/ho-so/:id`, `PATCH /api/v1/ho-so/:id/trang-thai` |
| Xử lý | `POST /api/v1/ho-so/:id/bien-ban`, `POST /api/v1/ho-so/:id/quyet-dinh`, `POST /api/v1/ho-so/:id/khac-phuc`, `PATCH /api/v1/khac-phuc/:id` |
| Thống kê | `GET /api/v1/thong-ke/tong-quan` |

Chuỗi trạng thái hồ sơ (state machine, backend tự validate):
`cho_tiep_nhan → cho_xac_minh → dang_xac_minh → cho_lap_bien_ban → da_lap_bien_ban → cho_ra_quyet_dinh → da_ra_quyet_dinh → dang_khac_phuc → da_khac_phuc → da_dong` (+ nhánh `cho_bo_sung`, `da_huy`, `cho_duyet_dieu_81`).

## 5. Kiểm thử

```sh
cd qlttxd/app/backend
env PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres \
    JWT_SECRET=test-secret JWT_SECRET=test-secret-that-is-long-enough-for-jwt \
    UPLOAD_DIR=/tmp/qlttxd-test-uploads \
    /workspace/ssd/toolchain/node/bin/node --test test/server.test.js
# Kết quả: 3 passed, 0 failed (đã xác nhận chạy lại 2026-08-02)
```

E2E đầy đủ (login → báo cáo → hồ sơ → biên bản → quyết định → khắc phục → thống kê):
đã chạy thành công 10/10 bước trên backend thật port 3001, 2026-08-02.

## 6. Lưu ý vận hành (bài học thực tế)

1. **Dọn process cũ trước khi chạy lại**: nếu `node server.js` đã chạy từ lần
   trước, nó giữ port 3001 và chạy CODE CŨ trong RAM. Khi sửa code phải kill
   process cũ trước:
   ```sh
   pkill -f "node server.js"   # hoặc kill theo PID đã xác định
   ```
   Triệu chứng: `/health` vẫn 200 nhưng API mới trả 404 `Cannot POST /api/...`.

2. **Mã tuần tự `COUNT+1`** (BC/HS/BB/QD-YYYY-xxxxxx): an toàn cho demo/test,
   nhưng không chịu được ghi đồng thời ở production — thay bằng sequence/bảng
   counter khi triển khai thật.

3. **Boundary quận/phường là hình chữ nhật giả lập** trong seed (mỗi quận/phường
   là 1 MULTIPOLYGON ước lệ quanh Hà Nội). Hệ thống luôn dò được QUẬN; PHƯỜNG
   chỉ dò được nếu điểm nằm trong vùng ước lệ của phường. Dùng dữ liệu ranh giới
   thật (GADM/OSM) khi đi vào vận hành.

4. **RBAC** được kiểm tra ở backend (middleware `authorize`) và frontend (ẩn/hiện
   theo `permissions` trong JWT). JWT hết hạn sau 8h; frontend tự quay về trang
   đăng nhập khi nhận 401.

5. **Ảnh upload**: lưu vào `UPLOAD_DIR` (mặc định `./uploads`), phục vụ qua
   `GET /uploads/<file>`; metadata ghi bảng `tep_dinh_kem`.

6. Audit: mọi hành động tạo/cập nhật/đăng nhập ghi vào `audit_log`.

7. **Frontend React 19 bắt buộc có `vite.config.js` với `@vitejs/plugin-react`**
   (T9, 2026-08-02). Nếu thiếu, Vite transform JSX theo classic runtime → trình
   duyệt báo `React is not defined` → trang trắng, dù `npm run build` vẫn PASS
   (build chỉ bundle, không thực thi JS nên không phát hiện lỗi runtime).
   ```sh
   # qlttxd/app/frontend/vite.config.js
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   export default defineConfig({ plugins: [react()] });
   ```
   Triệu chứng: HTML 200, `#root` có, nhưng màn hình trắng + console error
   `React is not defined`. Kiểm chứng bằng headless Chromium (Playwright):
   transform `/src/main.jsx` có `react_jsx-dev-runtime`, 0 lần `React.createElement`.

## 7. Cấu trúc code

```
qlttxd/app/
├── backend/
│   ├── server.js            # toàn bộ API (20 endpoint), tự khởi động khi chạy trực tiếp
│   ├── test/server.test.js  # 3 test tích hợp (node --test, Express thật port 3101)
│   ├── TEST-RESULT.md       # kết quả test backend
│   └── .env.example
└── frontend/
    ├── vite.config.js       # @vitejs/plugin-react (BẮT BUỘC cho React 19 — T9)
    ├── src/main.jsx         # toàn bộ UI (login, citizen, dashboard, cases, detail)
    ├── src/styles.css       # responsive mobile-first + badge trạng thái
    └── TEST-RESULT.md       # kết quả test frontend (gồm T9)
```

## 8. Hạn chế / việc tiếp theo

- [x] Backend 19 bảng + PostGIS + RBAC (T7)
- [x] Frontend JWT + RBAC + bản đồ GIS (T8)
- [x] Sửa trang trắng frontend — thêm vite.config.js plugin-react (T9)
- [ ] Trả thêm tên quận/phường trong response tạo báo cáo (hiện chỉ có id — đã
      thêm `quan_huyen_id, phuong_xa_id` vào RETURNING 2026-08-02)
- [ ] Boundary ranh giới thật cho auto-detect phường chính xác
- [ ] Upload ảnh hồ sơ/biên bản (hiện chỉ báo cáo có ảnh)
- [ ] Biểu đồ thư viện chuyên nghiệp (hiện dùng CSS bars)

## 9. Quality Gate (P0.1 — 2026-08-02)

Mọi task phát triển QLTTXD phải tuân thủ quy trình quality gate bắt buộc:

1. **Xem chi tiết**: `docs/08-quality-gate-process.md` — chuỗi trạng thái Kanban,
   phân công vai trò, cách ly workspace, quy tắc review.
2. **Template nghiệm thu**: `docs/09-acceptance-template.md` — mẫu điền cho mọi
   task, gồm acceptance criteria, files changed, tests/evidence, reviewer approval,
   known risks, rollback/handoff.
3. **Ma trận role-skill**: xem mục 3 trong `08-quality-gate-process.md`.

### Quy trình 13 bước (tóm tắt)

1. requirements/specify → 2. architecture → 3. task/dependencies →
4. implementation → 5. self-test → 6. review-required →
7. independent-review → 8. fixes (nếu có) → 9. regression →
10. security/perf/a11y → 11. verified → 12. complete → 13. docs/handoff

> **Vòng lặp bắt buộc sau fixes**: fixes → regression → security/perf/a11y →
> verified → complete. Không được bỏ qua regression sau khi sửa.
>
> **Mapping chi tiết** Quality Gate ↔ Kanban native status: xem mục 1.2
> trong `docs/08-quality-gate-process.md`.

### Quy tắc cốt lõi

- Coder/worker TỰ chuyển `review-required` khi xong implementation + self-test.
- Reviewer ĐỘC LẬP (không phải người viết) phải đọc diff, chạy test, kiểm tra
  runtime trước khi complete.
- Không complete task chỉ dựa vào build PASS nếu lỗi là runtime.
- Không cho hai agent cùng ghi workspace chính song song.
- Không sửa application code, schema hoặc runtime data trong task orchestration.

## 10. Staging Deployment Checklist (P1.4 — 2026-08-03)

### Quy trình khởi động staging

```sh
# 1) PostgreSQL
source /workspace/ssd/toolchain/scripts/env.sh
pg-start

# 2) Backend — JWT_SECRET phải >= 32 ký tự, KHÔNG dùng demo password
cd qlttxd/app/backend
env PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres \
  JWT_SECRET='<secret-32-ky-tu>' CORS_ORIGIN='http://localhost:5173' \
  UPLOAD_DIR=/tmp/qlttxd-uploads PORT=3001 \
  /workspace/ssd/toolchain/node/bin/node server.js

# 3) Frontend
cd qlttxd/app/frontend
VITE_API_BASE_URL=http://localhost:3001 \
  /workspace/ssd/toolchain/node/bin/npm run dev -- --port 5173
```

### Lưu ý vận hành staging

1. **Dọn process cũ trước khi restart**: Backend cũ giữ port, chạy code cũ trong RAM.
   `/health` 200 KHÔNG chứng minh code mới đã chạy. Luôn kill process cũ trước.
2. **CORS_ORIGIN phải set**: Nếu không set, CORS sẽ disabled (`origin: false`).
   Set đúng origin frontend (ví dụ `http://localhost:5173`).
3. **Security headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
   Permissions-Policy đều được set tự động khi backend khởi động đúng code mới.

### Backup & Restore

```sh
# Backup
pg_dump -h /tmp -p 5432 -U postgres -d qlttxd -Fc \
  -f /tmp/qlttxd-backup/qlttxd-$(date +%Y%m%d-%H%M%S).dump

# Restore (DB mới)
psql -h /tmp -p 5432 -U postgres -c "CREATE DATABASE qlttxd_restored"
pg_restore -h /tmp -p 5432 -U postgres -d qlttxd_restored \
  --no-owner --no-privileges /tmp/qlttxd-backup/<file>.dump

# Verify
psql -h /tmp -p 5432 -U postgres -d qlttxd_restored \
  -c "SELECT count(*) FROM users; SELECT PostGIS_Version();"
```

### Smoke Test

```sh
node /workspace/ssd/qlttxd/scripts/staging-full-verify.js
# 34/35 PASS (danh-muc public = expected behavior)
```

### Go/No-Go

- **GO**: staging/internal demo — all API, auth/RBAC, security headers, backup/restore PASS
- **NO-GO cho production**: cần GIS thật, rate-limiting, sequence, TLS, browser E2E
## 11. TLS Termination với Caddy (T4.5 — 2026-08-03)

Hệ thống sử dụng **Caddy** làm reverse proxy và TLS termination. Caddy tự động cấp và gia hạn chứng chỉ Let's Encrypt cho production, và hỗ trợ self-signed cho development.

### 11.1 Kiến trúc với Caddy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Caddy     │────▶│  Frontend   │
│  (Browser)  │ TLS │  :80/:443   │ HTTP│  (Nginx)    │
└─────────────┘     │  Termination│     │  :80        │
                    └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐     ┌─────────────┐
                    │  Backend    │────▶│   PostGIS   │
                    │  :3000      │     │   :5432     │
                    └─────────────┘     └─────────────┘
```

### 11.2 Cấu hình Caddyfiles

| Môi trường | File | Chứng chỉ | Mô tả |
|---|---|---|---|
| Development | `Caddyfile.dev` | Self-signed (local_certs) | Dùng cho dev local, truy cập `https://localhost` |
| Staging | `Caddyfile.staging` | Let's Encrypt Staging | Dùng cho staging, không giới hạn rate limit |
| Production | `Caddyfile.prod` | Let's Encrypt Production | Dùng cho production thật |

### 11.3 Khởi động với Docker Compose

```sh
# Development (self-signed TLS)
cd qlttxd/app
CADDYFILE=Caddyfile.dev docker-compose up -d
# Truy cập: https://localhost (chấp nhận cảnh báo self-signed)

# Staging (Let's Encrypt staging)
CADDY_EMAIL=admin@staging.qlttxd.example.gov.vn \
  CADDYFILE=Caddyfile.staging \
  CORS_ORIGIN=https://staging.qlttxd.example.gov.vn \
  VITE_API_BASE_URL=https://staging.qlttxd.example.gov.vn \
  docker-compose up -d

# Production (Let's Encrypt production)
CADDY_EMAIL=admin@qlttxd.example.gov.vn \
  CADDYFILE=Caddyfile.prod \
  CORS_ORIGIN=https://qlttxd.example.gov.vn \
  VITE_API_BASE_URL=https://qlttxd.example.gov.vn \
  docker-compose up -d
```

### 11.4 Biến môi trường quan trọng

| Biến | Mô tả | Ví dụ |
|---|---|---|
| `CADDYFILE` | Chọn Caddyfile (dev/staging/prod) | `Caddyfile.dev` |
| `CADDY_EMAIL` | Email cho Let's Encrypt (bắt buộc production) | `admin@qlttxd.example.gov.vn` |
| `CORS_ORIGIN` | Origin được phép gọi API (phải khớp domain Caddy) | `https://qlttxd.example.gov.vn` |
| `VITE_API_BASE_URL` | URL API cho frontend build | `https://qlttxd.example.gov.vn` |

### 11.5 CORS_ORIGIN & Domain Mapping

**Quan trọng**: `CORS_ORIGIN` trong backend **phải khớp chính xác** domain mà Caddy phục vụ (kể cả protocol HTTPS).

Ví dụ mapping:
- Dev: `CORS_ORIGIN=https://localhost` (khi dùng self-signed)
- Staging: `CORS_ORIGIN=https://staging.qlttxd.example.gov.vn`
- Prod: `CORS_ORIGIN=https://qlttxd.example.gov.vn`

Nếu frontend và backend cùng domain (qua Caddy), CORS sẽ hoạt động tự động vì request đến `/api/*` đi qua Caddy → backend, origin là domain Caddy.

### 11.6 Kiểm tra TLS

```sh
# Kiểm tra chứng chỉ
openssl s_client -connect qlttxd.example.gov.vn:443 -servername qlttxd.example.gov.vn </dev/null

# Kiểm tra header HSTS
curl -I https://qlttxd.example.gov.vn | grep -i strict-transport-security

# Kiểm tra HTTP redirect to HTTPS
curl -I http://qlttxd.example.gov.vn | head -1
# Expected: 301/308 redirect to https://
```

### 11.7 Volumes Caddy (persistent certs)

Docker compose định nghĩa 2 volumes để lưu chứng chỉ và cấu hình Caddy:
- `caddy_data` — `/data` (chứng chỉ, private keys, OCSP staples)
- `caddy_config` — `/config` (cấu hình runtime)

**Backup quan trọng**: Backup `caddy_data` volume để không mất chứng chỉ khi container restart.

```sh
# Backup certs
docker run --rm -v qlttxd_caddy_data:/data -v $(pwd):/backup alpine tar czf /backup/caddy-certs-$(date +%Y%m%d).tar.gz -C /data .

# Restore certs
docker run --rm -v qlttxd_caddy_data:/data -v $(pwd):/backup alpine tar xzf /backup/caddy-certs-<date>.tar.gz -C /data
```

### 11.8 Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|---|---|---|
| Cert không cấp được | Domain không trỏ đúng IP DNS | Kiểm tra A record, firewall 80/443 |
| Rate limit Let's Encrypt | Quá nhiều lần request cert | Dùng staging CA hoặc chờ 1 tuần |
| CORS error | `CORS_ORIGIN` không khớp domain | Set đúng `CORS_ORIGIN=https://<caddy-domain>` |
| Self-signed warning dev | Browser không tin cậy local_certs | Thêm exception hoặc dùng mkcert |
| Mixed content | Frontend load HTTP resource trên HTTPS | Đảm bảo `VITE_API_BASE_URL` dùng HTTPS |

### 11.9 Tài liệu tham khảo

- Caddy docs: https://caddyserver.com/docs/
- Let's Encrypt rate limits: https://letsencrypt.org/docs/rate-limits/
- Docker Caddy image: https://hub.docker.com/_/caddy

### Chi tiết đầy đủ

Xem `app/backend/TEST-RESULT-P1.4.md`
