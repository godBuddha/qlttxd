# Configuration Audit & Settings Center Redesign — Tổng quan

> **Phiên bản:** 1.0 · **Ngày:** 2026-08-09 · **Phạm vi:** toàn hệ thống QLTTXD (backend, frontend, infra, DB, seed)
> **Phương pháp:** quét tĩnh thực tế trên codebase (`grep`/diff trên source thật), không suy đoán.
> **Mục tiêu:** loại bỏ 100% cấu hình ẩn không hợp lệ; thiết kế Settings Center cấp enterprise mở rộng được tới hàng trăm module.

## Bộ tài liệu

| File | Nội dung | Phase |
|---|---|---|
| [01-discovery.md](01-discovery.md) | Toàn bộ cấu hình phát hiện được (env, DB, code, infra, frontend) | Phase 1 |
| [02-classification.md](02-classification.md) | Phân loại A/B/C/D/E cho từng mục | Phase 2 |
| [03-hardcode-report.md](03-hardcode-report.md) | Báo cáo hardcode: vị trí, rủi ro, điểm rủi ro, kế hoạch di chuyển | Phase 3 |
| [04-settings-center-design.md](04-settings-center-design.md) | Kiến trúc Settings Center mới (IA, navigation, permission, versioning) | Phase 4 |
| [05-ui-specification.md](05-ui-specification.md) | Đặc tả UI chi tiết từng trang settings | Phase 5 |
| [06-roadmap.md](06-roadmap.md) | Lộ trình triển khai, dependency graph, rollback | Phase 6 |

## Kết quả chính (Executive Summary)

### Hiện trạng xác minh được

| Kênh cấu hình | Số lượng | Trạng thái |
|---|---|---|
| Env vars backend (quét `process.env`) | **27 biến** phân bố 14 file | Hợp lệ: 9 (lớp Infra A); cần di chuyển: 8; dev-only: 6; trùng lặp: 4 |
| DB `system_config` (đã seed) | **53 key / 12 category** | Sẵn sàng — nhưng **4 key chưa được tiêu thụ** |
| Frontend constants | **8 export tĩnh** (constants.js) | 3 nhóm đã có getter động; **HOME coords chưa đọc từ DB** dù DB đã seed |
| Infra (docker-compose, Caddyfile, Dockerfile) | ~20 giá trị | Hợp lệ lớp Infra; 2 giá trị nên tham số hóa |
| **Hardcode còn sót thực sự cần sửa** | **7 finding** (mục 03) | Trong đó **2 finding mức HIGH** |

### 2 finding HIGH (phải sửa trước khi release)

1. **Drift TTL refresh token:** SQL ghi cứng `interval '7 days'` ở 3 chỗ trong `routes/auth.js`, trong khi JWT ký theo `config.auth.jwt_refresh_ttl`. Admin đổi TTL qua Settings → token ghi DB và JWT **lệch nhau** → refresh token bị từ chối sớm/muộn bất thường.
2. **Map center chết:** Frontend hardcode `HOME = [21.0285, 105.8542]`; DB đã seed `ui.home_lat/lng` nhưng **không ai đọc** → sửa trong Settings không có tác dụng.

### Thiết kế Settings Center (tóm tắt)

- **Registry-driven**: mỗi module đăng ký *settings manifest* (schema JSON) → form tự sinh, sidebar tự dựng. Đây là cơ chế duy nhất mở rộng tới hàng trăm module mà không sửa shell.
- **4 lớp scope** tái dùng cột `scope/scope_id` có sẵn: `global` → `organization` → `workspace` → `user`.
- **Resolution chain** giữ nguyên logic ConfigService hiện tại: cache → DB → env → default, thêm bước **validate theo `config_schema`** trước khi ghi.
- **IA 13 nhóm / 42 trang**, ánh xạ 1-1 với 9 permission `config.*` đã có trong DB (migration 006).
- Các phần AI (Providers/Model Routing/RAG...) trong đề bài gốc **không áp dụng** cho QLTTXD (không có LLM); tài liệu ghi rõ trạng thái N/A hoặc tương lai, thay bằng nhóm nghiệp vụ tương đương (Workflow, GIS, Danh mục, Xuất dữ liệu).

## Cách sử dụng tài liệu

- **Team implement:** đọc 04 → 05 → 06, làm theo Wave trong 06. Không cần hỏi thêm.
- **Reviewer bảo mật:** đọc 02 (lớp A/E) + 03 (risk score).
- **PM:** đọc mục Executive Summary này + bảng Wave trong 06.
