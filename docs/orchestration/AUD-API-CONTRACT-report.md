# AUD-API-CONTRACT — Đối chiếu hợp đồng API Backend vs Frontend

GĐ3 · ORCH-04 Đợt B · Task `t_e241a8cb` · 2026-08-26

Phương pháp: trích xuất toàn bộ route BE bằng script quét `router.(get|post|put|patch|delete)(` trên `app/backend/routes/*.js` (97 match); trích xuất toàn bộ call FE bằng grep `request(`/`api(`/`fetch(`/`downloadDocx(` trên `app/frontend/src` (loại file test). Chuẩn hóa path động (`:id` ⇔ `${id}`). Mọi mismatch dưới đây đã được xác minh 2 chiều bằng grep cả phía BE và phía FE.

Mount: tất cả route trong `routes/*.js` tự khai báo path đầy đủ (đa số có prefix `/api/v1`) và được mount gốc ở `app/backend/server.js:224-235` — không có prefix trung gian thêm.

---

## 1. Bảng tổng hợp route BE (nhóm theo file) — 97 endpoint

### auth.js (15)
| Method | Path | Middleware | Vị trí |
|---|---|---|---|
| GET | /health | public | auth.js:36 |
| GET | /health/live | public | auth.js:51 |
| GET | /health/ready | public | auth.js:57 |
| GET | /health/detailed | authenticate, authorize('admin.users') | auth.js:72 |
| GET | /api/v1/auth/setup-status | public | auth.js:92 |
| POST | /api/v1/auth/setup-admin | authLimiter | auth.js:104 |
| POST | /api/v1/auth/login | authLimiter | auth.js:222 |
| POST | /api/v1/auth/logout | authenticate | auth.js:302 |
| POST | /api/v1/auth/refresh | public (cookie) | auth.js:311 |
| GET | /api/v1/auth/me | authenticate | auth.js:397 |
| PATCH | /api/v1/auth/password | authenticate | auth.js:400 |
| GET | /uploads/:filename | serveAttachment | auth.js:488 |
| GET | /api/v1/attachments/:filename/view | serveAttachment | auth.js:489 |
| POST | /api/v1/auth/forgot-password | forgotLimiter | auth.js:508 |
| POST | /api/v1/auth/reset-password | forgotLimiter | auth.js:588 |

### ho-so.js (13)
| Method | Path | Middleware | Vị trí |
|---|---|---|---|
| POST | /api/v1/ho-so | authenticate, authorize('case.update') | ho-so.js:45 |
| GET | /api/v1/ho-so | authenticate, authorize('case.view') | ho-so.js:108 |
| GET | /api/v1/ho-so/:id | authenticate, authorize('case.view') | ho-so.js:148 |
| PATCH | /api/v1/ho-so/:id/trang-thai | authenticate + case perm | ho-so.js:184 |
| PUT | /api/v1/ho-so/:id/phan-cong | authenticate | ho-so.js:251 |
| POST | /api/v1/ho-so/:id/bien-ban | authenticate | ho-so.js:299 |
| POST | /api/v1/ho-so/:id/quyet-dinh | authenticate | ho-so.js:331 |
| POST | /api/v1/ho-so/:id/quyet-dinh/ban-hanh | authenticate | ho-so.js:390 |
| POST | /api/v1/ho-so/:id/khac-phuc | authenticate | ho-so.js:428 |
| PATCH | /api/v1/khac-phuc/:id | authenticate | ho-so.js:482 |
| GET | /api/v1/ho-so/:id/xuat-bien-ban.docx | authenticate | ho-so.js:519 |
| GET | /api/v1/ho-so/:id/xuat-quyet-dinh.docx | authenticate | ho-so.js:548 |
| GET | /api/v1/ho-so/:id/xuat-bien-ban.pdf · xuat-quyet-dinh.pdf | authenticate | ho-so.js:585, 666 |

### bao-cao.js (4)
POST /api/v1/bao-cao (:28) · GET /api/v1/bao-cao (:102) · POST /api/v1/bao-cao/:id/to-ho-so (:121) · GET /api/v1/bao-cao/:id (:183)

### thong-ke.js (2)
GET /api/v1/thong-ke/tong-quan (:9) · GET /api/v1/thong-ke/xuat (:35)

### ban-do.js (1)
GET /api/v1/ban-do/vi-pham (:10)

### danh-muc.js (6)
GET /api/v1/danh-muc/{loai-vi-pham :8, hanh-vi :17, muc-phat :29, quan-huyen :40, phuong-xa :47, can-bo :61} — public

### thong-bao.js (6)
POST /api/v1/thong-bao/sse-token (:14) · GET /api/v1/thong-bao (:30) · GET /api/v1/thong-bao/stream (:54, token qua query, bỏ rate-limit ở server.js:167) · GET /api/v1/thong-bao/unread-count (:143) · POST /api/v1/thong-bao/:id/mark-read (:156) · POST /api/v1/thong-bao/mark-all-read (:170)

### admin-users.js (7)
GET /api/v1/admin/users (:12) · POST (:41) · PATCH /api/v1/admin/users/:id (:103) · GET /api/v1/admin/roles (:236) · PATCH /api/v1/admin/roles/:id/permissions (:257) · GET /api/v1/admin/permissions (:318) · GET /api/v1/admin/audit-log (:337)

### admin-locations.js (8)
GET/POST /api/v1/admin/quan-huyen (:31,:52) · PATCH/DELETE .../quan-huyen/:id (:103,:188) · GET/POST /api/v1/admin/phuong-xa (:261,:287) · PATCH/DELETE .../phuong-xa/:id (:353,:474)

### admin-catalogs.js (12)
GET/POST /api/v1/admin/{loai-vi-pham, hanh-vi, muc-phat} + PATCH/DELETE .../:id — (:10..:572)

### config.js (21)
PUT /api/v1/config/bulk (:147) · POST /api/v1/config/test-smtp (:219) · POST /api/v1/audit/purge-now (:287) · GET /api/v1/config/workflow/states (:322) · GET /api/v1/config/workflow/transitions (:338) · PUT /api/v1/config/workflow/transitions/:id (:359) · GET/PUT /api/v1/config/workflow/role-permissions (:397,:425) · GET /api/v1/config (:482) · GET/PUT /api/v1/config/:category/:key (:521,:547) · GET /api/v1/config/history (:630) · POST /api/v1/config/rollback/:historyId (:664) · GET /api/v1/config/export (:735) · POST /api/v1/config/import (:756) · GET /api/v1/config/schema (:930) · GET /api/v1/config/validation-rules (:948) · GET /api/v1/config/notification-channels (:964) · GET /api/v1/config/allowed-mime-types (:980)

### docs.js (3)
GET /api/v1/docs (:51) · GET /api/docs/swagger-init.js (:59) · GET /api/docs (:62)

---

## 2. Bảng call FE (method + path + nơi gọi)

Helper: `request()` trong `lib/api.js` (tự refresh token khi 401), wrapper `api()` tạo tại `main.jsx:224`, gọi trực tiếp `fetch()` ở `lib/api.js`, `lib/config.js`, `EvidenceImage.jsx`, `ReportPage.jsx`; tải file bằng `downloadDocx()`.

| Method | Path FE gọi | Nơi gọi (file:line) |
|---|---|---|
| POST | /api/v1/auth/login | components/Login.jsx:25 |
| POST | /api/v1/auth/logout | lib/AuthContext.jsx:21 |
| POST | /api/v1/auth/refresh | lib/api.js:15 |
| POST | /api/v1/auth/forgot-password · reset-password | components/ForgotPassword.jsx:16,105 |
| POST | /api/v1/auth/setup-admin | components/SetupAdminPage.jsx:22 |
| GET | /api/v1/auth/setup-status | main.jsx:214 |
| PATCH | /api/v1/auth/password | pages/ProfilePage.jsx:17 |
| GET | /api/v1/ho-so?… | pages/CaseList.jsx:42 |
| GET | /api/v1/ho-so/:id | pages/CaseDetail.jsx:20 |
| PATCH | /api/v1/ho-so/:id/trang-thai | CaseDetail.jsx:99 |
| POST | /api/v1/ho-so/:id/bien-ban | CaseDetail.jsx:401 |
| POST | /api/v1/ho-so/:id/quyet-dinh | CaseDetail.jsx:490 |
| POST | /api/v1/ho-so/:id/quyet-dinh/ban-hanh | CaseDetail.jsx:507 |
| POST | /api/v1/ho-so/:id/khac-phuc | CaseDetail.jsx:639 |
| PATCH | /api/v1/khac-phuc/:id | CaseDetail.jsx:652 |
| GET | /api/v1/ho-so/:id/xuat-{bien-ban,quyet-dinh}.{docx,pdf} | CaseDetail.jsx:452,463,601,612 (downloadDocx) |
| GET | /api/v1/admin/audit-log | CaseDetail.jsx:33, AdminAuditLogPage.jsx:22, SettingsShellV2.jsx:421, OverviewPage.jsx:118 |
| GET/POST | /api/v1/bao-cao | CitizenPage.jsx:70,100; OfficerReportsPage.jsx:14 |
| GET | /api/v1/bao-cao/:id | OfficerReportsPage.jsx:24 |
| POST | /api/v1/bao-cao/:id/to-ho-so | OfficerReportsPage.jsx:34 |
| GET | /api/v1/thong-ke/tong-quan | Dashboard.jsx:10; ReportPage.jsx:23 |
| GET | /api/v1/thong-ke/xuat?… | ReportPage.jsx:45 (fetch) |
| GET | /api/v1/ban-do/vi-pham | BanDoPage.jsx:34 |
| GET | /api/v1/danh-muc/quan-huyen | CaseList.jsx:21; ReportPage.jsx:20 |
| GET/POST/PATCH/DELETE | /api/v1/admin/quan-huyen(/:id), /api/v1/admin/phuong-xa(/:id) | AdminLocationsPage.jsx:18-19,99-118 |
| GET | /api/v1/admin/loai-vi-pham, hanh-vi, muc-phat | AdminCatalogPage.jsx:18-20 |
| POST/PATCH/DELETE | /api/v1/admin/${tab}(/:id) với tab ∈ {loai-vi-pham, hanh-vi, muc-phat} | AdminCatalogPage.jsx:41,401-406 |
| GET | /api/v1/admin/users, roles, permissions | AdminUsersPage.jsx:21-22; AdminRolesPage.jsx:14-15 |
| POST/PATCH | /api/v1/admin/users(/:id) | AdminUsersPage.jsx:61-79 |
| PATCH | /api/v1/admin/roles/:id/permissions | AdminRolesPage.jsx:30 |
| GET | /api/v1/thong-bao, unread-count | BellNotification.jsx:13,18,119 |
| POST | /api/v1/thong-bao/sse-token | BellNotification.jsx:64 |
| GET(SSE) | /api/v1/thong-bao/stream?token=… | BellNotification.jsx:67 (EventSource) |
| POST | /api/v1/thong-bao/:id/mark-read · mark-all-read | BellNotification.jsx:136,143 |
| GET | /health | SettingsShellV2.jsx:373; OverviewPage.jsx:70 |
| GET | /api/v1/config?category=… | ConfigContext.jsx:49,185; GeneratedForm.jsx:70; lib/config.js:15 |
| PUT | /api/v1/config/bulk | GeneratedForm.jsx:132 |
| GET | /api/v1/config/history?category=&key= | HistoryDrawer.jsx:23; ImportExportPage.jsx:133 |
| POST | /api/v1/config/rollback/:id | HistoryDrawer.jsx:40; ImportExportPage.jsx:147 |
| GET/POST | /api/v1/config/export · /api/v1/config/import?dry_run= | ImportExportPage.jsx:52,92,109 |
| GET/PUT | /api/v1/config/workflow/transitions(/:id) | WorkflowTransitionsPage.jsx:31,79 |
| GET | /api/v1/config/workflow/states | WorkflowTransitionsPage.jsx:32; WorkflowStatesPage.jsx:21 |
| GET/PUT | /api/v1/config/workflow/role-permissions | RolePermissionsPage.jsx:26,60 |
| GET | /api/v1/config/allowed-mime-types | MimeTypesPage.jsx:25 |
| PUT | /api/v1/config/security/mime-types/:id | MimeTypesPage.jsx:46 ⚠️ |
| GET | /api/v1/config/schema | lib/config.js:136 |
| GET | **/api/v1/workflow/states** | ConfigContext.jsx:70; lib/config.js:69 ❌ |
| GET | **/api/v1/workflow/transitions** | ConfigContext.jsx:78; lib/config.js:98 ❌ |
| GET | /api/v1/attachments/:filename/view | EvidenceImage.jsx:21 |

---

## 3. Bảng MISMATCH

### 3a. FE gọi nhưng BE KHÔNG có route (FRONTEND-BACKEND-CONTRACT-MISMATCH)

| # | Method+Path FE gọi | Phía sai | Evidence | Đề xuất sửa | Mức độ ảnh hưởng người dùng thật |
|---|---|---|---|---|---|
| M1 | GET `/api/v1/workflow/states` và `/api/v1/workflow/transitions` (không segment `config`) | FE sai path | FE: `lib/ConfigContext.jsx:70,78`; bản copy chết `lib/config.js:69,98`. BE chỉ có `/api/v1/**config**/workflow/states|transitions` (config.js:322,338); grep toàn bộ `app/backend/routes` không có `/api/v1/workflow/*`. Xác minh 2 nguồn xong. | Sửa FE thành `/api/v1/config/workflow/states|transitions` (ConfigContext là đường chạy chính khi load app). | **CAO** — mọi lần mở app, load workflow states/transitions đều fail rồi rơi vào nhánh catch "silent fail" → UI dùng fallback trạng thái tĩnh, lệch khỏi cấu hình workflow thật mà admin đã sửa (trạng thái/chuyển tiếp động không hiển thị đúng ở dropdown chuyển trạng thái hồ sơ). |
| M2 | PUT `/api/v1/config/security/mime-types/:id` (body `{is_active}`) | FE gọi endpoint BE không tồn tại | FE: `admin/settings/pages/MimeTypesPage.jsx:46`. BE không có route nào chứa `security/mime-types`; MIME chỉ đọc tại GET `/api/v1/config/allowed-mime-types` (config.js:980, bảng `allowed_mime_types`, không phải `system_config` nên cũng KHÔNG ghi được qua PUT `/config/:category/:key`). Grep cả 2 phía xác minh. | Thêm BE: `PUT /api/v1/config/security/mime-types/:id` (authorize('config.edit.security'), UPDATE allowed_mime_types.is_active) — hoặc đổi FE dùng route mới tương ứng. Sửa phía BE khớp ý đồ thiết kế (comment trong chính MimeTypesPage ghi rõ toggle is_active). | **TRUNG BÌNH** — tính năng bật/tắt loại tệp đính kèm trong trang Cài đặt → MIME types lỗi 404/405 mỗi lần lưu; optimistic UI rollback về trạng thái cũ, admin không thể tắt một loại MIME nào. |

Đã biết, liệt kê để đủ bảng (không phải phát hiện mới): **PATCH `/api/v1/config/auth/…` — DEF-008**. Ở mã nguồn hiện tại KHÔNG còn chỗ nào trong FE gọi PATCH config/auth (grep `app/frontend/src` = 0 kết quả; form cài đặt auth đã đi qua `PUT /api/v1/config/bulk`, GeneratedForm.jsx:132). DEF-008 hiện chỉ còn trong test BE (`test/config-service.test.js`) — xem mục 3c/G07.

### 3b. BE có route nhưng FE KHÔNG dùng ("không consumer" — đầu vào cho dead-code audit GĐ7)

| Route | File:dòng | Ghi chú |
|---|---|---|
| POST /api/v1/ho-so | ho-so.js:45 | Hồ sơ được tạo gián tiếp qua POST /bao-cao/:id/to-ho-so; FE không gọi trực tiếp |
| GET /api/v1/danh-muc/{loai-vi-pham, hanh-vi, muc-phat, phuong-xa, can-bo} | danh-muc.js:8..62 | FE chỉ dùng quan-huyen (CaseList, ReportPage) |
| GET /health/live, /health/ready, /health/detailed | auth.js:51,57,72 | Endpoint vận hành/k8s — giữ lại, không phải dead-code |
| GET /uploads/:filename | auth.js:488 | FE chỉ dùng /api/v1/attachments/:filename/view |
| GET /api/v1/docs, /api/docs, /api/docs/swagger-init.js | docs.js:51,59,62 | Truy cập trực tiếp bằng trình duyệt |
| POST /api/v1/config/test-smtp | config.js:219 | Không tìm thấy caller trong FE (grep test-smtp = 0) |
| POST /api/v1/audit/purge-now | config.js:287 | features.json:19 mô tả nút "dọn ngay" nhưng không có component nào gọi (grep purge = 0) — nút chưa được dựng |
| GET /api/v1/config/validation-rules, notification-channels | config.js:948,964 | Không consumer |
| GET/PUT /api/v1/config/:category/:key (đơn) | config.js:521,547 | FE lưu hàng loạt qua /config/bulk; route đơn chỉ test BE dùng |
| GET /api/v1/auth/me | auth.js:397 | FE lấy user từ localStorage + response login/refresh |

### 3c. Lệch schema body (mức chính, nhanh)

- M2 (trên): FE gửi `{is_active:boolean}` vào đường PUT mime-types — BE không có handler nào nhận → mất trắng, không phải chỉ sai path.
- PUT /config/bulk: FE gửi `{items:[{category,key,value}]}` (GeneratedForm.jsx:132-140) — khớp BE.
- PUT /workflow/transitions/:id: FE gửi body toggle (WorkflowTransitionsPage.jsx:79) — khớp BE.
- PATCH /admin/roles/:id/permissions: FE gửi `{permission_ids}` (AdminRolesPage.jsx:31) — khớp BE (admin-users.js:257).
- PATCH /auth/password: FE gửi đổi mật khẩu (ProfilePage.jsx:17) — khớp BE (auth.js:400).
- Không quét sâu từng field của ho-so/bien-ban/quyet-dinh theo phạm vi nhiệm vụ ("chỉ các field chính").

---

## 4. Thống kê

| Chỉ số | Giá trị |
|---|---|
| Tổng route BE | **97** |
| Tổng call FE (sau chuẩn hóa, gộp trùng) | **~55 pattern** (≈90 call-site) |
| Match (FE ↔ BE khớp method+path) | ~50 |
| MISMATCH nghiêm trọng (FE gọi, BE không có) | **2** (M1 workflow không-prefix, M2 mime-types PUT) |
| Đã biết (DEF-008) | 1 — hiện không còn caller FE trong mã nguồn |
| BE route không consumer (FE) | **14** (gộp nhóm; trong đó ~5 là endpoint vận hành/docs chủ đích) |

## 5. Kết luận & đề xuất ưu tiên

1. **M1 (CAO)** — sửa 2 dòng trong `lib/ConfigContext.jsx` (+ xóa hoặc sửa bản copy chết `lib/config.js` đang export hàm không ai dùng): đổi path sang `/api/v1/config/workflow/...`. Rủi ro thấp, dọn luôn dead-code cho GĐ7.
2. **M2 (TRUNG BÌNH)** — quyết định phía BE: thêm `PUT /api/v1/config/security/mime-types/:id` vì đây là bảng riêng `allowed_mime_types`, không thể tái dùng `/config/:category/:key`.
3. **DEF-008**: đánh dấu "đã xử lý ở FE" (FE đã chuyển sang PUT /config/bulk); phần còn lại chỉ là test BE — cân nhắc gỡ nhãn lỗi sản phẩm.
4. Chuyển mục 3b cho GĐ7 (dead-code audit): đặc biệt `POST /audit/purge-now` có feature flag nhưng thiếu nút FE, và `lib/config.js` là module chết.
