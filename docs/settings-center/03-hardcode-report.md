# Phase 3 — Hardcode Detection Report

Mỗi finding: vị trí hiện tại → lý do tồn tại → rủi ro → nơi đích → độ khó di chuyển → ưu tiên → kế hoạch → ảnh hưởng → phụ thuộc → **điểm rủi ro (1–10)**.

Tổng: **7 finding** (2 HIGH, 3 MEDIUM, 2 LOW). Sắp theo điểm rủi ro giảm dần.

---

## HC-01 · Drift TTL refresh token (SQL hardcode vs DB config) — Risk 9/10

| Mục | Giá trị |
|---|---|
| Vị trí | `app/backend/routes/auth.js` dòng **175, 260, 354**: `now() + interval '7 days'` |
| Lý do | Viết SQL trước khi có ConfigService; T4a chỉ thay JWT sign, không thay INSERT DB |
| Rủi ro | Admin đổi `auth.jwt_refresh_ttl` = `30d` qua Settings → JWT sống 30 ngày nhưng row `refresh_tokens` hết hạn sau 7 ngày → logout "bất thường"; ngược lại TTL ngắn hơn thì row chết nhưng JWT còn → **refresh token dùng được quá hạn chính sách** (lỗ hổng chính sách bảo mật) |
| Đích | Cùng một nguồn: đọc TTL từ `configService.get('auth','jwt_refresh_ttl')`, parse `'7d'` → số ngày, truyền làm tham số `make_interval(days => $n)` |
| Khó | Thấp–Trung bình (parse chuỗi TTL dùng chung helper; sửa 3 câu SQL) |
| Ưu tiên | **P0** |
| Kế hoạch | 1) Helper `ttlToInterval(str)` + unit test; 2) thay 3 INSERT; 3) test hồi quy refresh flow; 4) ghi chú release: TTL mới chỉ áp dụng token cấp phát sau deploy |
| Impact | Auth toàn hệ thống |
| Dependency | ConfigService (có sẵn) |
| **Risk** | **9** |

## HC-02 · Map center chết (frontend hardcode, DB không consumer) — Risk 7/10

| Mục | Giá trị |
|---|---|
| Vị trí | `app/frontend/src/lib/constants.js`: `export const HOME = [21.0285, 105.8542]`; tiêu thụ ở CitizenPage/BanDoPage |
| Lý do | T5 tạo getter cho states/transitions nhưng bỏ sót HOME; DB seed `ui.home_lat/lng` từ T2 không ai đọc |
| Rủi ro | Trang Settings UI cho phép đổi tọa độ trung tâm bản đồ nhưng **không có tác dụng** → mất niềm tin cấu hình; triển khai tỉnh khác vẫn kẹt Hà Nội |
| Đích | ConfigProvider expose `ui` category; component map gọi `getConfig('ui','home_lat', fallback)` |
| Khó | Thấp (getter có sẵn pattern) |
| Ưu tiên | **P0** |
| Kế hoạch | 1) ConfigProvider thêm selector `homeCenter()` trả `[lat,lng]` với fallback HOME; 2) thay import HOME ở 2 trang; 3) test render map |
| Impact | Bản đồ công dân + bản đồ tổng thể |
| Dependency | ConfigProvider (T5), API `/api/v1/config?category=ui` |
| **Risk** | **7** |

## HC-03 · Env override che DB config (đảo ngược thứ tự ưu tiên) — Risk 6/10

| Mục | Giá trị |
|---|---|
| Vị trí | `upload.js` (`MAX_UPLOAD_MB`), `server.js` + `audit-retention.js` (`AUDIT_*`), `routes/auth.js` (`RATE_LIMIT_MAX`) |
| Lý do | Giai đoạn chuyển tiếp giữ env override |
| Rủi ro | .env production còn giá trị cũ → Settings đổi không hiệu lực; ops tưởng đã đổi khi chưa |
| Đích | Thứ tự chuẩn: DB → default. Env chỉ dành lớp A. Với deployment tự host muốn "ghim" giá trị: dùng flag `is_readonly` trong DB |
| Khó | Trung bình (cần thông báo breaking-change vận hành) |
| Ưu tiên | **P1** |
| Kế hoạch | 1) Bỏ nhánh env override; 2) script check khởi động warn nếu phát hiện biến cũ còn set; 3) mục lục .env.example cập nhật |
| Impact | upload/audit/rate-limit |
| Dependency | HC-01 xong để tránh 2 thay đổi auth cùng lúc |
| **Risk** | **6** |

## HC-04 · HSTS hai nguồn sự thật — Risk 4/10

| Mục | Giá trị |
|---|---|
| Vị trí | `Caddyfile`: `Strict-Transport-Security max-age=31536000` hardcode; DB `security.hsts_max_age` do backend helmet set riêng |
| Lý do | Caddy là edge proxy, không đọc được DB |
| Rủi ro | Đổi trong Settings → backend đổi, Caddy giữ nguyên → header trùng lặp/giá trị lệch giữa 2 hop |
| Đích | Quy ước: **HSTS do Caddy độc quyền phát hành**, xóa HSTS khỏi helmet backend; `security.hsts_max_age` chỉ còn ý nghĩa tài liệu → chuyển key sang `is_readonly` hoặc gắn chú thích "managed by Caddy" trong schema settings |
| Khó | Trung bình (phối hợp infra) |
| Ưu tiên | P1 |
| Kế hoạch | Xóa header HSTS phía Node; Caddyfile template hóa bằng env `HSTS_MAX_AGE` (lớp A); schema settings đánh dấu readonly |
| Impact | Security headers |
| Dependency | Không |
| **Risk** | **4** |

## HC-05 · Ba nguồn sự thật workflow states — Risk 3/10 (chấp nhận có kiểm soát)

| Mục | Giá trị |
|---|---|
| Vị trí | SQL enum CHECK + `utils/constants.js` + `lib/constants.js` (FE) |
| Lý do | Fallback khởi động & offline test |
| Rủi ro | Thêm state mới quên 1 trong 3 nơi → hành vi lệch giữa môi trường |
| Đích | DB = source of truth; code fallback chỉ dùng khi bảng rỗng/API lỗi; **thêm migration checklist**: mọi state mới phải đụng cả 3 + migration 00x |
| Khó | Không di chuyển — quy trình |
| Ưu tiên | P2 (quy trình) |
| Kế hoạch | Ghi vào docs/settings-center + template PR checklist |
| Impact | Workflow |
| **Risk** | **3** |

## HC-06 · Version fallback `'0.3.2'` ×4 — Risk 2/10

| Mục | Giá trị |
|---|---|
| Vị trí | `routes/auth.js` ×3, `utils/health.js` |
| Lý do | Test env không có `npm_package_version` |
| Rủi ro | Quên bump khi release → health báo version sai |
| Đích | Build-time inject `APP_VERSION` (Docker ARG) hoặc single source `package.json` read-only; fallback cuối cùng `'dev'` thay vì version cũ |
| Khó | Thấp |
| Ưu tiên | P2 |
| **Risk** | **2** |

## HC-07 · Default port 3000 vs thực tế 3001 — Risk 2/10

| Mục | Giá trị |
|---|---|
| Vị trí | `server.js` (`PORT \|\| 3000`) vs docker-compose/Caddy/nginx trỏ `3001` |
| Lý do | Lịch sử dev local dùng 3000, compose set PORT=3001 |
| Rủi ro | Chạy thiếu env → listen 3000, Caddy đen thui; từng gây bug nginx trước đây |
| Đích | Đồng bộ mặc định code = 3001, hoặc compose luôn set PORT rõ ràng (đã set) + README ghi chú |
| Khó | Thấp |
| Ưu tiên | P2 |
| **Risk** | **2** |

## Tổng hợp ưu tiên

| P0 (trước release) | P1 (sau release ngay đợt 1) | P2 (dọn dẹp) |
|---|---|---|
| HC-01, HC-02 | HC-03, HC-04 | HC-05, HC-06, HC-07 |
