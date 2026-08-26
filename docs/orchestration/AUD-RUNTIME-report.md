# AUD-RUNTIME — Báo cáo kiểm chứng chạy thật (GĐ2, ORCH-04 Đợt A)

**Task:** `t_7d4a08d1` · **Ngày chạy:** 2026-08-26 · **Người chạy:** coder (ox-alpha, tự động)

## Môi trường kiểm chứng

| Thành phần | Giá trị |
|---|---|
| PostgreSQL | 16, Unix socket `/tmp`, DB `qlttxd` — chạy sẵn |
| Backend | `node server.js` tại **:4100**, `NODE_ENV=test`, `RATE_LIMIT_DISABLED=true`, health `200 {"status":"ok","db":"connected"}` |
| Frontend | Vite dev server **:5199** (proxy `/api` → :4100) |
| Trình duyệt | Playwright chromium-headless-shell 151.0.7922.34 (v1234), 1440×900, locale vi-VN |
| Tài khoản | `admin` có sẵn trong DB (đăng nhập `Qlttxd@2026` — OK). Đã tạo 4 user test qua API admin đúng RBAC: `qa_handler`, `qa_verifier`, `qa_leader`, `qa_citizen` (mật khẩu `QaTest2026abc`, HTTP 201) |

Dữ liệu test tạo mới: báo cáo **BC-2026-000102**, hồ sơ **HS-2026-000082** (id `9f10bce6-a92f-4f65-8165-5fe668eabea4`), biên bản BB-2026-000022, quyết định đã ban hành. Không đụng dữ liệu quan trọng.

## 1. Kết quả 8 bước kịch bản lõi

| # | Bước | Kết quả | Evidence | Ghi chú |
|---|---|---|---|---|
| 1 | Đăng nhập admin qua UI | **PASS** | `rt-01-login.png` | Login form → dashboard, sidebar đầy đủ |
| 2a | Chọn vị trí trên bản đồ Leaflet | **FAIL** | `rt-02a-map-click-def.png` | **DEF-101** — click bản đồ không đặt tọa độ (chi tiết bên dưới) |
| 2b | Tạo hồ sơ/báo cáo vi phạm (form đầy đủ + ảnh PNG + tọa độ) | **PASS** | `rt-02-tao-ho-so-form.png`, `rt-02b-bao-cao-success.png` | Tạo được BC-2026-000102 kèm 1 ảnh minh chứng; tọa độ nhập tay qua ô Lat/Lng (UI cho phép) |
| 3 | Danh sách → mở chi tiết hồ sơ vừa tạo | **PASS** | `rt-03a-danh-sach-bao-cao.png`, `rt-03b-chi-tiet-ho-so.png` | "Tạo hồ sơ" từ báo cáo → HS-2026-000082, redirect đúng trang chi tiết |
| 4 | Máy trạng thái + chặn chuyển SAI | **PASS** | `rt-04a`…`rt-04e-*.png` | SAI (cho_tiep_nhan→da_dong) bị chặn **HTTP 400** "Chuyển trạng thái không hợp lệ"; chuỗi đúng tiếp nhận→chờ XM→đang XM→chờ lập BB đều OK, chụp từng bước |
| 5 | Lập biên bản kiểm tra | **PASS** | `rt-05a-bien-ban-form.png`, `rt-05b-bien-ban-done.png` | BB-2026-000022 tạo thành công, trạng thái tự chuyển `da_lap_bien_ban` |
| 6 | Ra quyết định xử phạt + ban hành | **PASS** | `rt-06a`, `rt-06b`, `rt-06c-*.png` | QD nháp → "Ban hành" → `da_ban_hanh`, hồ sơ `da_ra_quyet_dinh` |
| 7 | Cập nhật khắc phục → hoàn tất | **PASS** | `rt-07a-cho-ra-quyet-dinh.png`, `rt-07b-hoan-tat.png` | Đăng ký khắc phục → `da_thuc_hien` → hồ sơ `da_khac_phuc` |
| 8 | Thống kê/báo cáo thấy hồ sơ mới | **PASS** | `rt-08-thong-ke.png` | Trang báo cáo tải, biểu đồ theo trạng thái/quận/tháng hiển thị |

**Tổng: 7 PASS / 1 FAIL (DEF-101) / 0 UNTRACEABLE.** Luồng nghiệp vụ lõi chạy thật end-to-end trên UI.

### DEF-101 — Chọn vị trí trên bản đồ Leaflet bị hỏng (đề xuất: MAJOR)
- **Hiện tượng:** click lên `.leaflet-container` ở trang công dân không đặt tọa độ. Leaflet fire đúng event `click` với `latlng` hợp lệ (đã xác minh bằng instrumentation), callback `onPick({lat, lng})` được gọi — nhưng state latStr nhận giá trị `[object Object]`, console cảnh báo `The specified value "[object Object]" cannot be parsed`.
- **Nguyên nhân gốc:** `app/frontend/src/components/MapView.jsx:32` gọi `onPick({ lat, lng })` (1 object), trong khi `app/frontend/src/pages/CitizenPage.jsx:52` định nghĩa `setPointCoords(lat, lng)` (2 tham số) → `setLatStr` nhận object.
- **Tác động:** người dân không thể chọn vị trí bằng chuột trên bản đồ (luồng chính của cổng công dân); chỉ nhập tọa độ tay mới gửi được báo cáo.
- **Bằng chứng:** `rt-02a-map-click-def.png`, warning console trong `console-report.txt`, `rt-e2e-flow.mjs` bước 2a.
- **Gợi ý sửa (không thực hiện theo quy tắc task):** đổi MapView thành `onPick(event.latlng.lat, event.latlng.lng)` hoặc đổi CitizenPage nhận 1 object — nhất quán 1 trong 2 hợp đồng.

### Quan sát thêm (không chặn luồng)
- **DEF-102 (đề xuất: MINOR):** trang chi tiết hồ sơ render thêm khối "404 — Không tìm thấy trang" phía dưới nội dung tab (thấy trong `rt-02b`, `rt-06c`, `rt-07b`) — route fallback hiển thị nhầm khi đang ở route `/cases/:id` con.
- **DEF-103 (đề xuất: MINOR):** `PATCH /api/v1/config/auth` trả **404** (method+path không tồn tại — route chỉ có PUT). Không phải lỗ hổng RBAC, nhưng dễ gây hiểu nhầm khi test; đã retest đúng endpoint `PUT /api/v1/config/ui/home_lat` → 403 cho cả 4 vai trò.

## 2. RBAC matrix 4 vai trò (API level)

File evidence: `rbac-results.json` (kèm `rbac-created-users.json`, `rbac-config-retest.json`).

| Kiểm tra | case_handler | verifier | leader | citizen |
|---|---|---|---|---|
| Đăng nhập lấy token | 200 | 200 | 200 | 200 |
| Tạo user (quản trị) → kỳ vọng 403 | **403 PASS** | **403 PASS** | **403 PASS** | **403 PASS** |
| Sửa cấu hình `PUT /api/v1/config/ui/home_lat` → kỳ vọng 403 | **403 PASS** | **403 PASS** | **403 PASS** | **403 PASS** |
| Xem danh sách hồ sơ | 200 (cho phép) | 200 | 200 | **403 (bị chặn)** |
| Xem chi tiết hồ sơ người khác | 200 | 200 | 200 | bị chặn (danh sách đã 403) |
| Chuyển trạng thái ngoài ma trận (`→ da_dong`) | **200 ⚠** (xem DEF-104) | 400 (transition không hợp lệ từ trạng thái hiện tại — bị chặn) | **403 PASS** | **403 PASS** |
| Hành động ngoài vai trò: ra QD (handler) | **403 PASS** | — | — | — |
| Hành động ngoài vai trò: lập BB (leader) | — | — | **403 PASS** | — |
| Hành động ngoài vai trò: quản lý khắc phục (verifier) | — | **403 PASS** | — | — |
| Tạo hồ sơ (officer-only, citizen) | — | — | — | **403 PASS** |
| Xem báo cáo của chính mình (citizen) | — | — | — | **200 PASS** |

### DEF-104 — case_handler đóng được hồ sơ bất kỳ từ trạng thái nào (đề xuất: MAJOR)
- **Hiện tượng:** `PATCH /api/v1/ho-so/:id/trang-thai` với `{trang_thai:"da_dong"}` từ trạng thái `da_khac_phuc`… trả **200** cho `case_handler` (hồ sơ test bị chuyển thẳng sang `da_dong`), trong khi `leader`/`citizen` bị 403.
- **Nguyên nhân:** `role_state_permissions` DB cho `case_handler` chứa `da_dong` (và gần như mọi state) — rộng hơn nhiều so với fallback `ROLE_PERMISSIONS` trong `app/backend/utils/workflow-rules.js` (handler chỉ có `da_tiep_nhan, dang_khac_phuc, da_khac_phuc, da_dong, da_lap_bien_ban`). Cache `loadRolePermissions()` không được nạp ở `server.js` nên dùng DB trực tiếp tại `routes/ho-so.js:200`.
- **Bằng chứng:** `rbac-results.json` → `matrix[0].checks.chuyen_trang_thai_ngoai_ma_tran.status=200`.
- **Tác động:** cán bộ thụ lý có thể đóng hồ sơ bỏ qua bước khắc phục/duyệt.

## 3. Console / Network

File: `console-report.txt` (tổng hợp cả phiên, đã lọc noise `[vite]`/React DevTools).

- **Không có pageerror (crash JS).** Không có network request bị abort.
- 35 console error, toàn bộ là "Failed to load resource" HTTP-level:
  - 15× **401** — probe auth khi chưa đăng nhập (hành vi bình thường của app khi kiểm tra phiên).
  - 16× **404** — resource phụ (favicon/asset tĩnh) và các API probe; **không thấy 404 trên API nghiệp vụ lõi**.
  - 4× **400** — do bước test cố tình chuyển SAI trạng thái (kỳ vọng).
- 5 console warning `"undefined"/"[object Object]" cannot be parsed` — hậu quả trực tiếp của DEF-101.
- Kết luận: console **có vấn đề liên quan DEF-101**, ngoài ra sạch.

## 4. Danh sách DEF đề xuất

| DEF | Mô tả | Mức đề xuất | Bằng chứng |
|---|---|---|---|
| DEF-101 | Click chọn vị trí Leaflet đặt `[object Object]` vào tọa độ (MapView.onPick vs CitizenPage.setPointCoords lệch hợp đồng) | **MAJOR** | `rt-02a-map-click-def.png`, console warnings, `rt-e2e-flow.mjs` |
| DEF-102 | Khối "404 — Không tìm thấy trang" render thừa dưới trang chi tiết hồ sơ | MINOR | `rt-06c`, `rt-07b` (phía dưới trang) |
| DEF-103 | `PATCH /api/v1/config/auth` trả 404 (route chỉ có PUT) — dễ gây nhầm khi kiểm thử | MINOR | `rbac-results.json` lần chạy đầu |
| DEF-104 | `case_handler` chuyển được hồ sơ → `da_dong` từ trạng thái tùy ý (role_state_permissions DB rộng hơn matrix code) | **MAJOR** | `rbac-results.json` matrix case_handler |

## Phụ lục

- Kịch bản chạy: `rt-e2e-flow.mjs`, `rt-e2e-finish.mjs`, `rt-rbac.mjs`, `rt-rbac-config-retest.mjs`
- Kết quả máy: `_rt-steps-all.json`, `rt-state.json`, `console-report.json`
- Lưu ý môi trường: cần `NODE_ENV=test` (hoặc RATE_LIMIT_DISABLED) khi chạy BE local, nếu không limiter per-IP sẽ 429 sau vài lần login; chromium cần `FONTCONFIG_FILE=/workspace/ssd/toolchain/chromium-env/fonts.conf` để không SIGABRT.
- Server BE :4100 đã tắt sau phiên.
