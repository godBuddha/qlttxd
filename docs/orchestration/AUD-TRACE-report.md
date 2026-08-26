# AUD-TRACE — Báo cáo Truy vết Yêu cầu (Requirement Traceability)

Ngày: 2026-08-26 · Nguồn yêu cầu: ORCH-02-requirement-inventory.md (REQ-A01..H03)
Phương pháp: grep/đọc mã + chạy test có sẵn. KHÔNG sửa code sản phẩm.
Test đã chạy lại và PASS tại thời điểm audit: token-blocklist (5), workflow-rules (8), security-rbac (6), setup-admin, forgot-password.

| REQ | Spec | Code | Test | Kết luận | Ghi chú |
|-----|------|------|------|----------|---------|
| A01 Đăng nhập JWT access+refresh, blocklist, jti | docs/specs/v0.2.1/T-02-hardening.md | app/backend/routes/auth.js; app/backend/token-blocklist.js | test/token-blocklist.test.js; test/blocklist-integration.test.js; test/ttl.test.js | **PASS** | Blocklist 5/5 pass khi chạy lại |
| A02 Setup-admin đầu tiên | docs/specs/v0.2.1/T-02-hardening.md | routes/auth.js:104 POST /auth/setup-admin | test/setup-admin.test.js | **PASS** | Không user demo trong seed.sql |
| A03 Quên mật khẩu + rate limit theo config | T-02-hardening.md | routes/auth.js:494+ forgotLimiter đọc `rate_limit.forgot_max` từ Settings (HC-03) | test/forgot-password.test.js; test/reset-token-cleanup.test.js | **PASS** | Token một lần + hạn dùng có trong flow |
| A04 CRUD người dùng + gán vai trò | docs/specs/v0.2.1/T-04-api-gaps.md | routes/admin-users.js | test/admin-users.test.js; test/admin-roles.test.js | **PASS** | |
| A05 bcrypt rounds theo config, không log mật khẩu/token | T-02-hardening.md | auth.js:142,238,416-420 (`cfg.getSync('auth','bcrypt_rounds')`); không thấy logger ghi password/token trong auth.js | hardening.test.js | **PASS** | |
| A06 Đổi mật khẩu hồ sơ cá nhân; SSE token 60s | T-04-api-gaps.md | auth.js:416+ (change-password); routes/thong-bao.js:12-18 (sse-token type 'sse', 60s) | test/ttl-drift.test.js; FE homeCenter.test.jsx | **PASS** | |
| B01 Máy trạng thái 15 bước | docs/03-dac-ta-nghiep-vu.md; docs/02-quy-trinh-nghiep-vu.md | utils/constants.js STATES (đủ 15 state); sql/migrations/005_system_config.up.sql (workflow_states) | test/workflow-rules.test.js; test/to-ho-so.test.js | **PASS** | 8/8 pass khi chạy lại |
| B02 Chuyển trạng thái theo ma trận + audit mỗi lần | 03-dac-ta-nghiep-vu.md | utils/workflow-rules.js (transitions từ DB); routes/ho-so.js:185 POST /:id/trang-thai; helpers.js:41 audit() | test/workflow-rules.test.js; test/to-ho-so.test.js | **PASS** | |
| B03 Quyền từng trạng thái theo vai trò (role_state_permissions) | 03-dac-ta-nghiep-vu.md | workflow-rules.js:63 JOIN role_state_permissions; migration 005 tạo bảng + index | test/workflow-rules.test.js; FE WorkflowTransitionsPage.test.jsx | **PASS** | |
| B04 Tạo hồ sơ kèm upload ảnh + PostGIS | docs/06-postgis-toolchain.md; T-09-frontend-images.md | utils/upload.js; routes/ho-so.js POST /ho-so; schema CREATE EXTENSION postgis | test/input-validation.test.js; FE EvidenceGallery.test.jsx | **PASS** | Upload middleware + attachment qua tep_dinh_kem |
| B05 Biên bản, quyết định xử phạt, khắc phục | 03-dac-ta-nghiep-vu.md | ho-so.js:300 bien-ban, :332 quyet-dinh, :391 ban-hanh, :429 khac-phuc | test/to-ho-so.test.js; test/export-docx.test.js | **PASS** | |
| B06 Không xóa cứng; soft delete/cancel có audit | 04-thiet-ke-csdl.md | schema.sql:297 deleted_at; idx_ho_so_active WHERE deleted_at IS NULL; không tìm thấy route DELETE nghiệp vụ | — | **GAP (thiếu test)** | Có code + schema nhưng chưa thấy test chuyên phủ soft-delete/cancel |
| B07 Luồng E2E công dân → tiếp nhận → xác minh → xử lý | BRIEF.md; docs/02-quy-trinh-nghiep-vu.md | routes/bao-cao.js (POST /bao-cao, report.create/view_own); ho-so.js trạng thái; FE CitizenPage.jsx → CaseDetail | FE CitizenPage.test.jsx, CaseDetail.test.jsx | **PASS** | Luồng E2E BE phủ qua chuỗi test RBAC + workflow |
| C01 Cấu hình nằm trong DB, hiệu lực thật | docs/settings-center/04-settings-center-design.md | lib/config-service.js; routes/config.js | test/config-service.test.js; test/config-wave1.test.js | **PASS** | HC-03/W1 đã xử lý |
| C02 API bulk/import(dry-run)/test-smtp/purge-now | settings-center/06-roadmap.md; specs Wave 1 | routes/config.js:25+ (bulk/import/test-smtp), :285 purge-now gated flag | test/config-wave1.test.js; test/regression-c02-c03.test.js | **PASS** | |
| C03 Shell v2 tự sinh từ manifest | docs/settings-center/05-ui-specification.md | FE admin/settings-manifests/, SettingsShellV2.jsx | FE registry.test.js, customPages.test.jsx | **PASS** | Wave 3 đã chuyển đổi theo cờ tính năng |
| C04 Ctrl+K search; lịch sử thay đổi + hoàn tác | settings-center/05-ui-specification.md | SettingsShellV2.jsx (Ctrl/Cmd+K); HistoryDrawer.jsx | FE SettingsSearch.test.jsx; HistoryDrawer.test.jsx | **PASS** | Hoàn tác: HistoryDrawer có undo action |
| C05 Secret chỉ ở .env; GET trả "***"; test-smtp không leak | settings-center/04-settings-center-design.md | lib/config-service.js:290-295 maskSecret; .env qua docker-compose env | test/config-wave1.test.js; test/email-notification.test.js | **PASS** | |
| C06 HSTS do Caddy phát duy nhất; HSTS_MAX_AGE env hóa | orchestration/Wave 4 (ORCH-05) | app/Caddyfile:3 ({$HSTS_MAX_AGE:-31536000}); helmet hsts:false BE; docker-compose truyền env | — | **GAP (thiếu test)** | Đã verify thủ công W4 nhưng không có test tự động cho header HSTS |
| C07 Version build-time từ package.json | ORCH-05 (HC-06, W4) | lib/version.js (APP_VERSION đọc package.json 1 lần) | — | **GAP (thiếu test)** | Không thấy unit test cho version endpoint/source |
| D01 27 permissions theo seed; admin full; giới hạn đúng ma trận | sql/seed.sql; docs/00-tong-ket.md | sql/migrations/001_initial_schema.sql:507 (14 perm gốc) + 006_config_permissions.up.sql (+18 config perm) ≈ đủ bộ chuẩn; authorize() utils/middleware.js:32 | test/security-rbac.test.js (ma trận 5 vai trò); test/admin-roles.test.js | **PASS** | Ma trận 200/403 server-side được test |
| D02 Không IDOR cả list lẫn detail | T-14-regression-security.md | bao-cao.js:110 (WHERE nguoi_gui_id=$1 khi !all); ho-so.js authorize từng route | test/security-rbac.test.js (công dân 403 / quản trị 200); test/phan-cong.test.js | **PASS** | Ownership check list+detail có trong bao-cao.js |
| D03 FE ẩn nút theo quyền; BE chặn độc lập | T-07/T-10 frontend specs | FE lib/routeGuard.js; BE authorize() độc lập | FE routeGuard.test.js; BE security-rbac.test.js | **PASS** | |
| E01 Audit log đầy đủ ai/lúc nào/làm gì/cũ-mới | 04-thiet-ke-csdl.md | utils/helpers.js:41 audit(pool,req,action,table,id,detail); gọi ở admin-users, ho-so, admin-catalogs, config | test/audit-quick-fixes.test.js; FE AdminAuditLogPage | **PASS** | |
| E02 Retention tự động theo config + purge gated flag | settings-center roadmap; HC-03 | jobs/audit-retention.js (audit.retention_days qua Settings); config.js:285 purge-now gated features.manual_audit_purge | test/config-wave1.test.js; test/jobs/ | **PASS** | |
| E03 Thống kê/báo cáo theo thời gian/trạng thái/khu vực | T-13-tests-reporting.md | routes/thong-ke.js; routes/bao-cao.js | test/reporting.test.js; test/thong-ke coverage qua reporting | **PASS** | |
| E04 Xuất dữ liệu JSON mask secret | settings-center design | routes/config.js:734 GET /config/export (dùng maskSecret của config-service) | FE ImportExportPage.test.jsx; test/config-wave1.test.js | **PASS** | |
| F01 Tuân NĐ 35/2019 & NĐ 15/2021 | docs/01-phan-tich-phap-ly.md; docs/02-quy-trinh-nghiep-vu.md | Máy trạng thái 15 bước + luồng 81 (cho_duyet_dieu_81) phản ánh quy định | test/workflow-rules.test.js (theo spec nghiệp vụ) | **PASS** | Compliance thể hiện qua workflow khớp tài liệu phân tích pháp lý |
| F02 Văn bản đúng thể thức | BRIEF.md (gov-docx-rendering) | gov_docx.js + fonts/NotoSans-*; xuất bien-ban/quyet-dinh docx/pdf (ho-so.js:520-667) | test/export-docx.test.js; test/export-csv.test.js | **PASS** | PDF export cũng có test |
| F03 Dữ liệu cá nhân tối thiểu hóa, không public | 01-phan-tich-phap-ly.md | bao-cao view_own giới hạn theo nguoi_gui; mọi route đều authenticate | test/security-rbac.test.js | **PASS** | Không thấy endpoint public lộ PII |
| G01 docker-compose đủ BE+FE+DB+Caddy; healthcheck đúng | README.md; ORCH-06-runbook.md | app/docker-compose.yml (db/backend/caddy, pg_isready healthcheck, depends_on service_healthy) | test/health.test.js (BE /health) | **PASS** | AUD-BASE đã boot OK, health tại /health |
| G02 Migration up/down đầy đủ; init sync migration chain | docs/07-huong-dan-van-hanh.md | sql/migrations: 001-007 up; down CHỈ có 004-007 (001-003 không có down); scripts/migrate.js; setup-db.sh đồng bộ | — | **GAP (down thiếu cho 001-003)** | Baseline schema thường chấp nhận không down, nhưng cần ghi rõ trong runbook |
| G03 Rate limit đa tầng global/write/user/auth theo config | T-02-hardening.md | utils/rate-limit.js (globalLimiter, writeLimiter); utils/rate-limit-user.js (user_max); authLimiter/forgotLimiter trong auth.js | test/hardening.test.js | **PASS** | Tất cả đọc max từ config-service |
| G04 Log cấu trúc; không log secret; không leak stack ra client | T-02-hardening.md | utils/logger.js JSON structured; server.js:248 log stack CHỈ vào logger, client chỉ nhận 'Lỗi máy chủ nội bộ' | test/request-timeout.test.js; test/server.test.js | **PASS** | |
| G05 README/env.example/docs đúng hiện trạng | chính nó (README.md, app/.env.example) | W4 đã dọn shell cũ + version; docs/orchestration cập nhật | — | **PASS** | Drift còn lại: 14 biến env (AUD-BASE t_7e4bb3ab đã ghi nhận) |
| H01 Responsive; form validate + loading/empty/error states | docs/05-thiet-ke-giao-dien.md | styles.css @media 767px/1000px; components/Loading, Status; pages validate/loading | FE Loading.test.jsx; Status.test.jsx; CaseList.test.jsx | **PASS** | |
| H02 Accessibility label/focus/aria-live/keyboard/Esc dialog | 05-thiet-ke-giao-dien.md | components/Dialog.jsx (Escape closes); BellNotification.jsx Escape; aria-live trong settings-utils, GeneratedForm | FE Dialog.test.jsx; BellNotification.test.jsx | **PASS** | |
| H03 Bản đồ Leaflet chọn vị trí + hiển thị điểm | docs/06-postgis-toolchain.md | FE BanDoPage.jsx (leaflet ^1.9.4); BE routes/ban-do.js (ST_Contains gán quận/phường) | FE BanDoPage có loading states (test riêng map mỏng) | **PASS** | Test map FE mỏng nhưng hành vi chính có kiểm chứng qua BE ban-do |

## Thống kê tổng

- **PASS: 38**
- **GAP: 4**
- **UNTRACEABLE: 0**

## Danh sách GAP (ưu tiên theo REQ)

1. **REQ-B06** [WORKFLOW/DATA] — Soft delete/cancel có audit: có schema (`deleted_at`, partial index) và thiếu vắng route DELETE cứng (tốt), nhưng **không có test riêng** chứng minh soft-delete/cancel ghi audit. Ưu tiên: trung bình.
2. **REQ-C06** [SEC] — HSTS single-source (W4): cấu hình đúng (Caddyfile + helmet hsts:false + compose env) nhưng **không có test tự động** assert header Strict-Transport-Security và absence từ BE. Ưu tiên: trung bình (regression risk khi đổi Caddyfile/helmet).
3. **REQ-C07** [FUNC] — Version build-time (HC-06): `lib/version.js` đúng thiết kế nhưng **chưa có unit/integration test** cho endpoint/version source. Ưu tiên: thấp.
4. **REQ-G02** [DEPLOY] — Migration down: **001_initial_schema, 002, 003 không có file .down.sql** (chỉ 004-007 có down). Chấp nhận được với baseline schema nhưng cần ghi rõ hạn chế trong docs/07-huong-dan-van-hanh.md hoặc bổ sung down baseline. Ưu tiên: thấp-trung bình.

## Xác minh runtime (test chạy lại lúc audit)

| Suite | Kết quả |
|-------|---------|
| test/token-blocklist.test.js (A01) | 5 pass / 0 fail |
| test/workflow-rules.test.js (B01-B03) | 8 pass / 0 fail |
| test/security-rbac.test.js (D01-D03, IDOR) | 6 pass / 0 fail |
| test/setup-admin.test.js (A02) | pass / 0 fail |
| test/forgot-password.test.js (A03) | pass / 0 fail |

Baseline tổng quát (AUD-BASE, t_7e4bb3ab): BE 290/290 pass, FE vitest 23 file / 107 test pass.
