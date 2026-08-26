# GĐ7-BATCH-A — Báo cáo Perf Baseline + Phân loại Dead-code

> Task: t_91408cca · Ngày: 2026-08-26 · Nguyên tắc: chỉ ĐO và PHÂN LOẠI, **không tối ưu, không xóa code** trong task này.

---

## PHẦN 1 — PERF BASELINE

### 1.1 Điều kiện đo

- BE thật: `node server.js` tại `app/backend`, PORT=4120, `RATE_LIMIT_DISABLED=true`, PG dev DB (`PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres`).
- Auth: login `admin` thành công (HTTP 200), token Bearer dùng cho các endpoint bảo vệ.
- Phương pháp: node fetch + `performance.now()`, mỗi endpoint gọi **5 lần liên tiếp**, ghi **trung vị (median)**. Đo lúc server vừa khởi động, không tải giả lập.

### 1.2 Kết quả (median của 5 lần)

| # | Endpoint | Median | Tất cả 5 lần (ms) | Status | Nhận xét |
|---|---|---|---|---|---|
| 1 | `GET /health` | **4.0 ms** | 5,4,4,4,4 | 200 | Nhanh (<100ms) |
| 2 | `POST /api/v1/auth/login` | **77.0 ms** | 78,77,84,75,75 | 200 | Bình thường — chi phí bcrypt hash verify là chủ đạo |
| 3 | `GET /api/v1/ho-so?limit=20` | **5.0 ms** | 16,5,5,5,5 | 200 | Nhanh (lần đầu 16ms gồm connection pool warm-up) |
| 4 | `GET /api/v1/thong-ke/tong-quan` | **6.2 ms** | 6,6,5,6,7 | 200 | Nhanh — 3 query song song (Promise.all) |
| 5 | `GET /api/v1/admin/audit-log?limit=20` | **7.7 ms** | 10,8,9,8,8 | 200 | Nhanh |
| 6 | `GET /api/v1/docs` | **5.1 ms** | 8,5,5,5,5 | 200 | Nhanh |

Ghi chú về path đo:
- `/thong-ke/tong-quan`: path thật trong `routes/thong-ke.js:9` là `/api/v1/thong-ke/tong-quan`.
- Endpoint audit admin: repo **không có** `GET /api/v1/audit`; path thật là `GET /api/v1/admin/audit-log` (`routes/admin-users.js:338`) — đã đo path thật.
- `GET /config/manifests`: không tồn tại dưới tên này; manifests được expose qua nhóm settings-manifests (features.json đọc tĩnh phía FE) → bỏ qua việc đo.

**Kết luận baseline:** toàn bộ 6 endpoint đều < 100ms (ngưỡng "nhanh"). Không có điểm nào cần ghi chú xem xét ở mức >=500ms. Đây là số liệu nền để so sánh sau khi tối ưu GĐ7-B.

### 1.3 Bundle size (frontend)

Lệnh: `npm run build` tại `app/frontend` (vite v7.3.6, 1859 modules, build 2.49s, có plugin sw-build-version cập nhật CACHE_NAME).

| File | Kích thước | Gzip |
|---|---|---|
| `dist/assets/index-q9cyqaAy.js` (**JS chunk lớn nhất**) | **397.49 kB** | 121.34 kB |
| `dist/assets/SettingsShellV2-BwIzjJ8j.js` | 54.18 kB | 16.57 kB |
| `dist/assets/CaseDetail-CS_zZMz0.js` | 15.12 kB | 4.88 kB |
| `dist/assets/AdminCatalogPage-BLvZPIII.js` | 12.60 kB | 3.54 kB |
| Tổng toàn bộ JS (14 chunk) | **~504.7 kB** (~516,823 bytes) | ~158 kB (cộng gzip từng chunk) |
| `dist/assets/index-CqZ5EAHK.css` | 41.21 kB | 12.60 kB |
| `dist/index.html` | 0.80 kB | 0.44 kB |

Nhận xét (chỉ quan sát, chưa hành động): main chunk 397 kB chiếm ~79% tổng JS — ứng viên tách vendor/lazy cho GĐ7-B nếu cần; hiện mọi route chính đã code-split theo page (lazy).

---

## PHẦN 2 — DEAD-CODE CLEANUP (phân loại, KHÔNG xóa)

### 2.1 Xác minh các item đã xử lý

1. **`lib/config.js`** — xác nhận **đã xóa ở GĐ5, sạch**: `app/backend/lib/` hiện chỉ còn `config-service.js, email.js, notification-worker.js, version.js`; grep `lib/config` (loại trừ `config-service`) trên toàn repo (BE + FE, exclude node_modules) = **0 tham chiếu**. Không cần làm gì thêm.
2. **PATCH auth trong `routes/config.js`** — đúng như DEF-008: FE đã chuyển PUT `/config/bulk`; PATCH không tồn tại/tồn dư đã được xử lý ở batch trước. **Không cần làm gì.**

### 2.2 Phân loại 14 route "không consumer FE"

Nguồn danh sách: `docs/orchestration/AUD-API-CONTRACT-report.md` mục 3b + thống kê mục 4 (14 route, gộp nhóm).

#### a. [KEEP-OPS] — Endpoint vận hành/docs chủ đích (giữ)

| Route | Lý do giữ |
|---|---|
| `GET /health/live`, `GET /health/ready`, `GET /health/detailed` | Chuẩn k8s/ops health probe; giám sát container phụ thuộc trực tiếp |
| `GET /api/v1/docs`, `GET /api/docs`, `GET /api/docs/swagger-init.js` | Trang docs Swagger truy cập trực tiếp bằng trình duyệt, phục vụ docs API nội bộ |
| `POST /api/v1/config/test-smtp` | Endpoint chẩn đoán vận hành: kiểm tra cấu hình SMTP từ Trung tâm Cài đặt mà không gửi thư thật; phù hợp giữ như công cụ admin |
| `GET /api/v1/auth/me` | Endpoint REST chuẩn cho kiểu hợp đồng token-based (client mới/thứ ba lấy phiên từ access token thay vì localStorage); chi phí giữ gần bằng 0 |

#### b. [LIST-CHO-DUYỆT] — Route nghiệp vụ thật, FE chưa dùng (orchestrator trình chủ dự án quyết)

| Route | Ghi chú để ra quyết định |
|---|---|
| `POST /api/v1/ho-so` | Hồ sơ tạo gián tiếp qua `POST /bao-cao/:id/to-ho-so`; route trực tiếp hữu ích cho tích hợp/API client ngoài (kiosk, import hàng loạt sau này). Khuyến nghị: GIỮ nếu có kế hoạch tích hợp ngoài, ngược lại gộp vào đợt dọn sau |
| `GET /api/v1/danh-muc/{loai-vi-pham, hanh-vi, muc-phat, phuong-xa, can-bo}` (5 route) | Danh mục nghiệp vụ thật; FE hiện chỉ dùng `quan-huyen` (CaseList.jsx:21, ReportPage.jsx:20). Các dropdown còn lại nhiều khả năng sẽ cần khi mở rộng form báo cáo — xóa sẽ phải viết lại |
| `POST /api/v1/audit/purge-now` | Đã có feature flag mô tả nút "dọn ngay" trong `settings-manifests/features.json:19` nhưng nút FE chưa dựng — đây là backlog UI chứ không phải dead-code; giữ route, lập ticket dựng nút |
| `GET /uploads/:filename` | FE đang dùng `/api/v1/attachments/:filename/view`; cần kiểm tra URL `/uploads/...` có bị lưu sẵn trong DB/bản ghi cũ hay không trước khi quyết xóa (rủi ro hỏng link dữ liệu cũ) |

#### c. [PROPOSED-DELETE] — Rác/không ai cần (đề xuất, CHỜ DUYỆT — chưa xóa)

| Route | Lý do đề xuất xóa |
|---|---|
| `GET /api/v1/config/validation-rules` (config.js:980) | Metadata tĩnh, không consumer nào (FE grep = 0, không nằm trong manifests); giá trị tra cứu có thể hardcode phía FE nếu sau này cần |
| `GET /api/v1/config/notification-channels` (config.js:996) | Như trên — scaffolding chưa từng có caller kể từ khi sinh |
| `GET /api/v1/config/:category/:key` (đơn, config.js:521) + `PUT .../:category/:key` (đơn, config.js:547) | FE lưu hàng loạt qua `/config/bulk`; cặp route đơn hiện chỉ test BE dùng. Giữ 1 đường API duy nhất (bulk) giảm bề mặt kiểm thử. Lưu ý: cần rà script/test BE tham chiếu trước khi gỡ |

### 2.3 FE dead components (chỉ liệt kê, không xóa)

Quét tự động (46 file `.js/.jsx` không phải test): với mỗi file, đếm importer theo basename.

| File | Kết quả | Đánh giá nhanh |
|---|---|---|
| `src/main.jsx` | Không có importer | **False positive** — entry point Vite (`index.html` tham chiếu), không phải dead-code |
| `src/test/setup.js` | Không có importer | Cấu hình vitest (trỏ trong vite.config/test setup), không phải dead-code |
| `src/admin/settings-utils.jsx` (4.3 KB) | **Không có importer nào trong src** | Ứng viên dead-component thật sự — cần xác nhận không dùng qua chuỗi động rồi trình orchestrator duyệt xóa |

Không phát hiện component trùng lặp nào khác qua quét import.

---

## 3. Đề xuất tổng hợp

1. **Baseline đã chốt** (bảng 1.2 + 1.3) — dùng làm mốc so sánh cho GĐ7-B (tối ưu).
2. Trình chủ dự án duyệt mục 2.2c (3 nhóm route đề xuất xóa) và `settings-utils.jsx` — làm ở batch sau, không thực hiện tại đây.
3. Mục 2.2b: ưu tiên lập ticket dựng nút "dọn ngay" cho `/audit/purge-now` (đã có flag, thiếu UI).
4. Kiểm tra URL `/uploads/...` trong DB trước khi quyết định số phận `GET /uploads/:filename`.

Server đo đã tắt sau khi hoàn tất (SIGTERM, graceful shutdown).
