# Phase 5 — UI Specification

Mẫu đặc tả dùng chung cho mọi trang; sau đó là đặc tả riêng từng trang đại diện nhóm. Các trang sinh từ manifest kế thừa mẫu chung 100%, chỉ khác manifest.

## 5.0 Mẫu chung (áp dụng mọi trang settings)

| Hạng mục | Chuẩn |
|---|---|
| Purpose | Quản trị 1 nhóm cấu hình runtime |
| Target users | Admin toàn quyền; một số trang xem-only cho leader |
| Permission | Xem `config.view` · Sửa theo permission của nhóm (bảng 04 §4.4) |
| Navigation | Sidebar: Nhóm → Trang; deep-link `/admin/settings/<group>/<page>` |
| Layout | Header (title + help text) → Form sections → Sticky footer actions (Lưu / Hoàn tác) |
| Components | `GeneratedForm` (input theo type), `DurationInput`, `SecretField` (mask + reveal, ghi `***`, không render giá trị thật ra DOM), `DiffBadge` (chưa lưu), `HistoryDrawer`, `ConfirmDialog` (cho thay đổi có `effects`) |
| Validation | Client: theo schema type/min/max/regex; Server: bắt buộc, trả 400 kèm message tiếng Việt |
| Dependencies | Khai báo trong manifest (`requires`: ví dụ email cần smtp.enabled=true mới hiện host/port) |
| API | GET `/config?category=X`, PUT `/config/:cat/:key`, GET `/config/history?category=X` |
| DB | `system_config` + `config_schema` + `config_history` |
| Searchability | Key + label + help được index vào Ctrl+K |
| Import/Export | Toàn cục ở trang Dữ liệu cấu hình (không per-page) |
| Audit | Mỗi PUT tạo config_history + audit_log |
| Version | Schema version hiển thị cuối trang |
| Error/Loading/Empty | Error banner retry · Skeleton rows · Empty state có CTA "Thêm key" (admin nâng cao) |
| Accessibility | Label gắn input, focus-visible ring, error announce bằng aria-live, tab order hợp lý |
| Responsive | ≥768px 2 cột (label/control), <768px 1 cột; sidebar thành drawer |
| Keyboard | `Ctrl/Cmd+S` = Lưu; `Esc` = đóng drawer/dialog; `Ctrl+K` = search |
| Future | Thêm field = sửa manifest/migration, không đụng component |

---

## 5.1 Tổng quan hệ thống (nhóm 1)

- **Purpose:** landing — tình trạng sức khỏe + phím tắt tới nhóm khác.
- **Wireframe:**
```
┌ Tổng quan ───────────────────────────────────────────────┐
│ [Health ● ok] [DB ● connected] [v0.3.3] [Config: 53 keys] │
│ ┌ Thay đổi gần đây (config_history ×10) ─┐ ┌ Nhóm nhanh ┐ │
│ │ jwt_access_ttl  5m→15m  admin  12′ ←   │ │ ▸ Bảo mật   │ │
│ │ ...                                    │ │ ▸ Workflow  │ │
│ └────────────────────────────────────────┘ └─────────────┘ │
└───────────────────────────────────────────────────────────┘
```
- **API:** `/health/detailed` (admin) + `/config/history`.
- Empty: nếu chưa từng đổi → panel rỗng với text hướng dẫn.

## 5.2 JWT & Cookie (nhóm 4)

- **Fields:** `auth.jwt_access_ttl` (duration 1m–1h), `auth.jwt_refresh_ttl` (1d–90d), `cookie.max_age_ms` (phút–ngày, warning nếu ≠ refresh TTL), `cookie.same_site` (enum lax/strict/none — none yêu cầu HTTPS confirm dialog).
- **Effects cảnh báo:** giảm refresh TTL → các phiên cũ sống đến hết token cũ (hiển thị note); tăng TTL → cần đồng bộ row `refresh_tokens` (HC-01 phải fix trước).
- **Validation chéo:** `cookie.max_age_ms ≥ jwt_refresh_ttl` — lỗi chặn lưu.
- **History:** mỗi field drawer riêng.

## 5.3 Rate limiting (nhóm 5)

- **Fields:** window (thời gian, chung cho global/auth/user), max từng loại; toggle "Tắt hoàn toàn" chỉ hiện khi `NODE_ENV !== production` (đọc qua endpoint env-inventory, mặc định ẩn).
- **Micro-copy:** "Áp dụng ngay, không cần khởi động lại."

## 5.4 Upload & MIME (nhóm 5)

- **Fields:** `upload.max_mb` (1–100), body limits (enum 512kb/1mb/2mb/5mb).
- **MIME table:** đọc `allowed_mime_types`; toggle is_active (permission upload); **không thêm MIME mới tại UI** (lý do lớp E — magic-byte validator phải có code hỗ trợ) → nút "Thêm" disabled với tooltip giải thích.
- **Empty:** bảng trống → cảnh báo đỏ "Không có MIME nào được phép, upload sẽ từ chối tất cả".

## 5.5 Ma trận Vai trò × Trạng thái (nhóm 3)

- Custom page (không sinh form): grid checkbox `role × 15 states`, cột sticky trái, hàng terminal màu xám.
- **Save:** bulk PUT `/workflow/role-permissions` (endpoint đã có); optimistic update + rollback khi lỗi.
- **Audit:** log kèm diff JSON.

## 5.6 Chuyển trạng thái (nhóm 6)

- Matrix `from × to` 15×15, ô hợp lệ click bật/tắt → PUT `/workflow/transitions/:id`.
- Ô không tồn tại: disabled + tooltip "Chỉ sửa các chuyển trạng thái đã định nghĩa".
- ConfirmDialog: "Đổi này ảnh hưởng hồ sơ đang mở."

## 5.7 Email / SMTP (nhóm 8)

- Toggle kênh `email` đọc từ `notification_channels`.
- Host/port/from: category `smtp.*` (B). User/pass: **hiển thị trạng thái "đã cấu hình qua .env"** — không cho xem/sửa (lớp A).
- Nút "Gửi thư thử" (gọi endpoint test-smtp — cần bổ sung nhỏ) → toast kết quả.

## 5.8 Nhật ký & lưu trữ (nhóm 9)

- `audit.retention_days` (số ngày, warn khi < 365: "mất vết kiểm toán sớm"), batch_size, interval_ms (duration), archive_dir readonly (A).
- Panel "Chạy dọn dẹp ngay" (gọi manual trigger — bổ sung endpoint nhỏ, permission infra).

## 5.9 Import/Export & History (nhóm 10)

- Export: tải JSON (endpoint có sẵn) + tùy chọn "bao gồm secrets: KHÔNG" cố định.
- Import: upload file → **dry-run diff view** (thêm/xem/sửa, đánh dấu vi phạm validation) → xác nhận mới ghi.
- History toàn cục: bảng lọc theo category/user/thời gian, link tới rollback.

## 5.10 Env Inventory (nhóm 13)

- Bảng chỉ đọc: tên biến lớp A, trạng thái set/chưa, **giá trị mask** (chỉ 4 ký tự cuối với biến không secret như PORT).
- Mục đích: ops kiểm tra môi trường mà không SSH; permission admin.audit.

## 5.11 Trang per-user (Ngôn ngữ/Giao diện)

- Scope=user: lưu `system_config scope='user', scope_id=<uid>`; fallback global.
- Theme chỉ light (hiện trạng) — dark disabled "Sắp có".
