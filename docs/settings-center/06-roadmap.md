# Phase 6 — Implementation Roadmap

## 6.1 Nguyên tắc

- Mỗi wave độc lập deploy được, có rollback.
- Không breaking change API công khai; mọi endpoint mới là *thêm*.
- Feature flag `features.settings_center_v2` bảo vệ shell mới (old UI giữ đến wave 4).

## 6.2 Dependency Graph

```
HC-01 (TTL drift fix) ─┐
HC-02 (Map center) ────┼─► WAVE 1 ─► WAVE 2 ─► WAVE 3 ─► WAVE 4
HC-03 (env override) ──┘      │          │           │
                              │          │           └─ HC-04/06/07 dọn dẹp
Gap-1 smtp · Gap-2 features ──┘─► Gap-3 bulk/dry-run ─► Gap-5 manifests
```

## 6.3 Waves

### Wave 0 — Bugfix cấu hình (P0, ~1 ngày agent-work)
| Việc | File | Test |
|---|---|---|
| HC-01: helper `ttlToInterval` + thay 3 SQL INSERT | routes/auth.js | refresh flow: đổi TTL 30d → row expires_at khớp |
| HC-02: ConfigProvider `homeCenter()` + 2 trang map dùng nó | ConfigContext, CitizenPage, BanDoPage | render map center từ DB |
| HC-07: đồng bộ default port 3001 | server.js | smoke start không env |
Rollback: revert commit (không đụng schema).

### Wave 1 — Nền tảng schema & gap (P1, ~1–2 ngày)
- Migration 007: `smtp.*` (4 key), `features.*`, đánh dấu `security.hsts_max_age is_readonly=true`, cột `version` cho config_schema.
- Backend: bulk PUT (`PUT /config/bulk`), import dry-run (`POST /config/import?dryRun=true`), test-smtp endpoint.
- Bỏ env override HC-03 + warn script khi phát hiện biến cũ.
- Rollback: migration down + revert.

### Wave 2 — Manifest registry + Shell v2 (P1, ~2–3 ngày)
- FE: thư mục `settings-manifests/*.json` (12 manifest ban đầu sinh từ bảng 04 §4.4), `GeneratedForm` theo type, SecretField, HistoryDrawer.
- SettingsShell: sidebar từ registry, breadcrumb, Ctrl+K search, route mới `/admin/settings/:group/:page`; flag bật/tắt giữa shell cũ/mới.
- A11Y: focus ring, aria-live error, keyboard map (mục 05 §5.0).
- Rollback: tắt flag → shell cũ.

### Wave 3 — Custom pages chuyển giao diện cũ vào shell mới (P2)
- Ma trận role×state, transitions, MIME table, Import/Export + dry-run diff, Env inventory, Overview dashboard.
- Per-user scope cho theme/language.
- Chuyển 12 trang settings hiện có sang manifest (xoá code form thủ công).
- Rollback từng trang độc lập.

### Wave 4 — Dọn dẹp (P2)
- HC-04 HSTS single-source (xóa helmet HSTS, Caddyfile env hóa).
- HC-06 version build-time inject; xóa fallback `'0.3.2'`.
- Checklist "Thêm trạng thái workflow" vào docs + PR template.
- Xóa shell cũ + feature flag.

## 6.4 Ước lượng & rủi ro

| Wave | Độ phức tạp | Rủi ro chính | Mitigation |
|---|---|---|---|
| 0 | Thấp | Sửa auth gây hồi quy đăng nhập | Chạy full 264 backend test + E2E login/refresh |
| 1 | Trung bình | Migration lỗi môi trường khách | Migration idempotent ON CONFLICT; down script |
| 2 | Trung bình–Cao | Form sinh thiếu edge-case | Bắt đầu với 3 nhóm đơn giản (auth/rate-limit/upload) rồi mở rộng |
| 3 | Trung bình | Regression UX các page custom | Soi screenshot trước/sau theo quy ước UI-screenshot |
| 4 | Thấp | Caddy header lệch | Staging test trước |

## 6.5 Breaking changes & backward compatibility

| Thay đổi | Ảnh hưởng | Chiến lược tương thích |
|---|---|---|
| Bỏ env override (HC-03) | Deployment đang set biến cũ | Script warn + tài liệu release note; 1 phiên bản ân hạn |
| Route settings mới | Bookmark cũ `/admin/settings/auth` | Redirect map từ path cũ → mới |
| Bulk PUT mới | Không ai dùng trước đó | Thêm thuần |
| Xóa HSTS khỏi Node | Client đi thẳng backend (dev) mất header | Dev không cần HSTS; prod đi qua Caddy |

## 6.6 Định nghĩa hoàn thành (DoD toàn dự án)

1. `grep -rnE "(expiresIn.*'[0-9]+[dms]')"` trong routes không còn hardcode ngoài helper.
2. Đổi `ui.home_lat/lng` qua UI → bản đồ thay đổi sau reload (test E2E).
3. Đổi `jwt_refresh_ttl` → token mới có expires_at DB = JWT (test tích hợp).
4. Toàn bộ 42 trang IA hiển thị đúng permission; truy cập thiếu quyền → 403 + ẩn sidebar.
5. Mọi mutation config xuất hiện trong config_history + audit_log.
6. 264+ backend / 70+ frontend tests PASS; screenshot bộ Settings mới commit kèm code.
