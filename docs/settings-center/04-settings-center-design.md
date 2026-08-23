# Phase 4 — Settings Center Redesign (Kiến trúc)

## 4.1 Nguyên tắc thiết kế

1. **Registry-driven, không shell-hardcode.** Shell (sidebar/tìm kiếm/permission) chỉ render từ *Settings Manifest* do mỗi module đăng ký. Thêm module = thêm manifest, không sửa shell → mở rộng tới hàng trăm trang.
2. **Một nguồn sự thật:** `system_config` (đã có) + `config_schema` (validation metadata). Code fallback chỉ để khởi động khi DB trống.
3. **Resolution chain giữ nguyên tương thích:** `cache → DB → env(lớp A không liên quan config runtime) → default`; thêm bước bắt buộc **validate theo schema trước khi ghi**.
4. **Scope 4 lớp tái dùng cột có sẵn** (`scope`, `scope_id`): `global` → `organization` → `workspace` → `user`. v1 chỉ bật global + user; 2 lớp sau là khe mở rộng.
5. **Permission-first:** mỗi key gắn permission `config.*` (9 quyền đã seed ở migration 006). UI ẩn mục không đủ quyền; API từ chối độc lập với UI.
6. **Mọi thay đổi có lịch sử:** đã có `config_history` + rollback → Settings Center bắt buộc hiển thị diff + who/when/ip.

## 4.2 Kiến trúc tổng thể

```
┌────────────────────────────── Frontend (React) ──────────────────────────────┐
│ SettingsShell                                                               │
│  ├─ Sidebar (render từ manifests: nhóm → trang)                             │
│  ├─ CommandSearch (Ctrl+K: tìm key/trang theo manifest labels)              │
│  ├─ Breadcrumb (Nhóm / Trang / [Tab])                                       │
│  └─ PageHost ── renders ──► <GeneratedForm manifest=… scope=…/>             │
│                              hoặc custom page (workflow matrix, audit…)     │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ GET /config/schema · GET/PUT /config/:cat/:key
               │ GET /config/history · POST /config/rollback
┌──────────────▼──────────────── Backend ──────────────────────────────────────┐
│ ConfigAPI (17 endpoints hiện có, bổ sung: bulk PUT, schema CRUD admin)       │
│ ConfigService: cache + pg_notify invalidate + validate(config_schema)        │
│ AuditLog: mọi mutation ghi audit_log (đã có)                                 │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
        PostgreSQL: system_config · config_schema · config_history
                    workflow_* · role_state_permissions · allowed_mime_types…
```

### Settings Manifest (hợp đồng mở rộng)

Mỗi module đăng ký một manifest JSON (frontend consume; backend dùng cho validation metadata khi build):

```jsonc
{
  "id": "auth",
  "group": "security",            // nhóm sidebar
  "title": "Xác thực & Phiên",
  "icon": "key-round",
  "permission": "config.edit.auth",   // xem = config.view
  "order": 20,
  "fields": [
    { "key": "jwt_access_ttl",  "label": "Tuổi token truy cập",
      "type": "duration", "unit": ["m","h","d"], "min":"1m", "max":"1h",
      "help": "Khuyến nghị ≤ 15m. Áp dụng cho token cấp phát mới.",
      "restart": false },
    { "key": "bcrypt_rounds", "type": "number", "min":10, "max":14,
      "help": "Chỉ áp dụng khi hash mật khẩu mới.", "sensitive": false }
  ],
  "effects": ["logout-all-on-change"]   // khai báo side-effect để UI cảnh báo
}
```

Quy tắc form tự sinh theo `type`: `string | number | duration | boolean | enum(allowed_values) | json | color | timezone | list<string>`. Validation lấy từ `config_schema` (regex/min/max/allowed_values đã có cột).

## 4.3 Navigation & IA

- **Sidebar 2 tầng:** Nhóm → Trang. Nhóm thu gọn được, ghi nhớ trạng thái per-user (localStorage).
- **Breadcrumb:** `Cài đặt / Bảo mật / Xác thực & Phiên`.
- **Command Search (Ctrl/Cmd+K):** index = manifests + key DB + mô tả; nhảy thẳng tới field, highlight nếu vừa đổi gần đây (config_history).
- **Trạng thái trang:** Loading (skeleton) / Error (retry) / Empty ("Chưa có cấu hình nào trong nhóm này").
- **Mobile (<768px):** sidebar chuyển drawer; form 1 cột.

## 4.4 Cấu trúc nhóm — 13 nhóm / 42 trang

Áp dụng thực tế QLTTXD; các mục AI/cloud trong đề bài gốc đánh dấu `(N/A)` và để card disabled "Sắp có" ở nhóm tương ứng.

| # | Nhóm | Trang | Permission |
|---|---|---|---|
| 1 | **Tổng quan** | Tổng quan hệ thống (health, version, số config, thay đổi gần đây) | config.view |
| 2 | **Không gian làm việc** | Tổ chức¹ · Hồ sơ cá nhân² · Ngôn ngữ & vùng² · Giao diện² | users/org: N/A¹, profile.*: user |
| 3 | **Người dùng & Truy cập** | Người dùng → (đã có AdminUsersPage, link sâu) · Vai trò → (AdminRolesPage) · Ma trận Quyền × Vai trò (RBAC) · Ma trận Vai trò × Trạng thái (workflow) | admin.users / admin.roles / config.edit.workflow |
| 4 | **Xác thực & Phiên** | JWT & Cookie · Chính sách mật khẩu³ · Khóa phiên (blocklist/cleanup) | config.edit.auth |
| 5 | **Bảo mật** | Rate limiting · Request & Timeout · Headers/TLS (readonly, managed by Caddy) · CORS · Upload & MIME | config.edit.security / .upload |
| 6 | **Workflow nghiệp vụ** | Trạng thái (view+label edit) · Chuyển trạng thái (toggle matrix) · Quy tắc mã hồ sơ (E — readonly hiển thị) | config.edit.workflow |
| 7 | **Dữ liệu & GIS** | Bản đồ (home center, tile URL⁴) · Địa danh hành chính → link AdminLocations · Danh mục vi phạm → link AdminCatalog | config.edit.general |
| 8 | **Thông báo** | Kênh (in-app/email/sms toggle) · Email SMTP (A-secret + B host/port) · SSE real-time | config.edit.notification |
| 9 | **Hệ thống** | Hiệu năng (pool, pagination) · Dọn dẹp (cleanup jobs) · Nhật ký & lưu trữ (audit retention/archive) | config.edit.infra |
| 10 | **Dữ liệu cấu hình** | Import/Export (JSON) · Lịch sử thay đổi toàn cục · Backup/Restore cấu hình | config.view + admin.config |
| 11 | **Tính năng** | Feature flags (category `features`) · Thử nghiệm (disabled cards: AI, Redis, S3…) | config.edit.general |
| 12 | **API & Tích hợp** | Webhooks⁴ · API keys⁴ (khe mở rộng, disabled) | N/A hiện tại |
| 13 | **Nhà phát triển** | Env inventory (chỉ đọc — liệt kê biến lớp A đang set, mask giá trị) · System info · About/License | admin.audit |

Ghi chú: ¹ ngoài phạm vi v1 (chưa có multi-org) — disabled. ² per-user, lưu `scope=user`. ³ chưa có policy engine — v1 hiển thị readonly từ validation_rules. ⁴ khe mở rộng disabled.

## 4.5 Versioning / History / Audit / Backup

- **Field-level history:** trang chi tiết mỗi field có tab "Lịch sử" ← `config_history` (old/new diff, user, ip, request_id, thời gian). Rollback 1-click gọi endpoint có sẵn.
- **Snapshot export:** `/api/v1/config/export` (có sẵn) xuất JSON toàn bộ; import chạy qua validator + dry-run diff trước khi ghi (bổ sung `?dryRun=true`).
- **Audit:** mọi PUT/rollback đã ghi `audit_log` qua helper hiện có — giữ nguyên, thêm action name `config.rollback`.
- **Versioning schema:** `config_schema` thêm cột `version INT` (migration tương lai) để manifest tiến hóa không phá dữ liệu cũ.

## 4.6 Khả năng mở rộng — kiểm chứng bằng kịch bản

Thêm module giả định "Kho văn bản" với 5 cấu hình:
1. Viết migration SQL thêm rows `system_config` + `config_schema` (không đụng code shell).
2. Đăng ký manifest `documents.json` trong module.
3. Sidebar/search/form sinh tự động; permission chọn từ pool `config.edit.*`.

→ **0 dòng code sửa trong SettingsShell.** Đây là tiêu chí nghiệm thu kiến trúc.

## 4.7 Gap so với hiện trạng (cần bổ sung nhỏ)

| # | Gap | Giải pháp |
|---|---|---|
| 1 | Chưa có category `smtp.*` | Migration thêm 4 key readonly-ish (host/port/enabled); secret vẫn env |
| 2 | Chưa có category `features` (flags) | Migration thêm bảng key `features.*`, mặc định rỗng |
| 3 | Bulk PUT + dry-run import | Bổ sung 2 endpoint (nhỏ) |
| 4 | Scope=user cho theme/language | ConfigService đã hỗ trợ scope; frontend truyền token user scope |
| 5 | Manifest registry FE | Thư mục `src/admin/settings-manifests/*.json` + loader |
