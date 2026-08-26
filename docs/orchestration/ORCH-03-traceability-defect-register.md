# ORCH-03 — Ma trận Truy vết & Sổ Lỗi (Traceability + Defect Register)

## 1. Ma trận truy vết (điền kết quả audit)

Mỗi REQ phải có đủ chuỗi: Spec → Task → Code → Test → Evidence. Thiếu mắt xích nào = TRACEABILITY-GAP.

| REQ | Spec | Task/Commit | Test | Runtime Evidence | Kết luận |
|-----|------|-------------|------|------------------|----------|
| REQ-A01..H03 | docs/spec | git log | test files | screenshots/API | (audit điền) |

Cách audit: với từng REQ, grep code + test + chạy runtime nếu cần. Ghi PASS / GAP(mắt xích thiếu) / UNTRACEABLE(code không có req).

## 2. Sổ lỗi trung tâm (Defect Register)

Định dạng mỗi dòng:
`ID · P-mức · LOẠI · trạng thái · mô tả ngắn · bằng chứng · gốc rễ · module · REQ liên quan · owner · hành động kế`

### Nợ đã biết từ trước (nhập kho ban đầu)
- DEF-001 · P3 · MISSING-FEATURE · TRIAGED · PUT /workflow/states/:code chưa có — trang shell v2 sửa tên hiển thị bị view-only · evidence: Wave 3 report + grep routes/workflow · owner: coder · next: spec + implement
- DEF-002 · P3 · MISSING-FEATURE · TRIAGED · PUT mime-types is_active chưa có — toggle rollback khi lỗi · evidence: Wave 3 report · owner: coder · next: spec + implement
- DEF-003 · P4 · DEPLOYMENT · ACCEPTED_RISK(chờ deploy thật) · HSTS_MAX_AGE cần env khi lên server · owner: deployment

### Phát hiện mới (ORCHESTRATOR bổ sung khi audit các đợt)

- DEF-004 · P3 · DOCUMENTATION · DISCOVERED (2026-08-26) · .env.example thiếu ~12 biến nghiệp vụ code đang đọc (AUDIT_BATCH_SIZE, AUDIT_RETENTION_DAYS, FRONTEND_URL, LOG_LEVEL, MAX_UPLOAD_MB, REQUEST_TIMEOUT_MS, PGCONNECT_TIMEOUT, PGSSLMODE, RATE_LIMIT_DISABLED/MAX, QLTTXD_DEBUG_TOKENS, TEST_ADMIN_PASSWORD...) · evidence: comm giữa grep process.env và .env.example (59 biến code đọc vs 15 biến example) · REQ-G05 · owner: coder · next: spec DOCS-SYNC ở GĐ7
- DEF-005 · P4 · TECHNICAL-DEBT · DISCOVERED (2026-08-26) · biến CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL trong code nghi ngờ là di tích cơ chế cũ trước khi chuyển sang DB config · evidence: grep process.env list · REQ-C01 · next: rà chỗ dùng, nếu chết thì dọn ở dead-code batch
- DEF-006 (từ AUD-RUNTIME DEF-101) · **P1** · BUG/UX · TRIAGED (2026-08-26) · Click chọn vị trí trên bản đồ trang công dân đặt "[object Object]" vào tọa độ — người dân không ghim được vị trí bằng chuột, chỉ nhập tay · evidence: rt-02a-map-click-def.png + console warning + grep xác minh MapView.jsx:32 onPick({lat,lng}) 1 object vs CitizenPage.jsx:52 setPointCoords(lat,lng) 2 tham số · REQ-B04/H03 · owner: coder · next: FIX task GĐ5 — nhất quán hợp đồng 1 trong 2 phía
- DEF-007 (từ AUD-RUNTIME DEF-102) · P3 · BUG/UI · TRIAGED · Khối "404 — Không tìm thấy trang" render thừa dưới trang chi tiết hồ sơ · evidence: rt-06c, rt-07b · REQ-H01 · owner: coder · next: fix route fallback ở GĐ5
- DEF-008 (từ AUD-RUNTIME DEF-103) · P4 · API · TRIAGED · PATCH /api/v1/config/auth trả 404 (route chỉ có PUT) gây nhầm khi kiểm thử · evidence: rbac-results.json lần chạy đầu · REQ-C02 · next: quyết định thêm PATCH alias hoặc bỏ qua; ghi docs
- DEF-009 (từ AUD-RUNTIME DEF-104) · **P1** · SECURITY/RBAC · TRIAGED · case_handler chuyển hồ sơ → da_dong từ trạng thái tùy ý (role_state_permissions DB rộng hơn ma trận code: handler 13 trạng thái, leader 11, verifier 5 — DB cho handler đóng hồ sơ bỏ qua khắc phục/duyệt) · evidence: rbac-results.json matrix 200 vs leader 403 + SQL xác minh trực tiếp DB · REQ-B03/D01/F01 · owner: coder + security review · next: FIX GĐ5 ưu tiên CAO — chốt ma trận chuẩn, cập nhật seed/migration + test RBAC regression
- DEF-010 (từ AUD-API M1) · **P2** · API/BUG · TRIAGED (2026-08-26) · ConfigContext.jsx:70,78 gọi /api/v1/workflow/states|transitions thiếu segment "config" (BE chỉ có /config/workflow/*) → mỗi lần mở app fetch fail và rơi về fallback tĩnh, cấu hình workflow sửa trong Settings không ăn vào context này · evidence: grep 2 phía xác minh + AUD-API-CONTRACT-report.md M1 · REQ-C01/B03 · owner: coder · next: FIX GĐ5 (sửa 2 dòng + dọn lib/config.js chết)
- DEF-011 (từ AUD-API M2) · P3 · MISSING-FEATURE/API · TRIAGED · MimeTypesPage.jsx:46 PUT /config/security/mime-types/:id không tồn tại ở BE (bảng riêng allowed_mime_types không tái dùng được endpoint generic) → toggle loại tệp luôn rollback (trùng chủ đề DEF-002 nhưng đúng vị trí API) · evidence: grep MimeTypesPage.jsx:46 vs routes/config.js · REQ-C02/DEF-002 · owner: coder · next: gộp fix với DEF-002 trong GĐ5/GĐ6 — tạo PUT route riêng
- DEF-012 (từ AUD-DB DEF-DB-01/02) · P4 · DATA · TRIAGED · 2 dòng tep_dinh_kem trùng duong_dan (thiếu UNIQUE(entity_type,entity_id,duong_dan)) — file vật lý THỰC TẾ TỒN TẠI (orchestrator xác minh lại 4/4 file có trong uploads/, agent đánh "mất file" do check sai đường dẫn gốc) · evidence: node fs.existsSync uploads/<file> = true cả 4 · REQ-B04 · owner: coder · next: thêm UNIQUE constraint ở migration kế + cleanup duplicate rows; hạ mức từ "trung bình" xuống "thấp"
- DEF-013 (từ AUD-DB DEF-DB-03) · P4 · PERFORMANCE · TRIAGED · thiếu index hanh_vi_vi_pham(loai_vi_pham_id) — bảng danh mục nhỏ, ảnh hưởng thấp · evidence: AUD-DB report 3b · owner: coder · next: gộp vào migration kế cùng DEF-012
- DEF-014 (từ AUD-DB DEF-DB-04) · P3 · DOCUMENTATION/SPEC-DRIFT · TRIAGED · Spec ghi "27 permissions chuẩn" nhưng seed/migration chỉ tạo 23 (14 gốc + 9 config) — drift tài liệu↔code, cần chủ dự án quyết chuẩn nào đúng HOẶC chấp nhận 23 và cập nhật spec · evidence: SELECT count(*) permissions = 23; không tìm thấy bộ 27 trong code · REQ-D01 · owner: ORCHESTRATOR trình chủ dự án · next: DECISION-GATE nhẹ trong báo cáo GĐ5 (không chặn remediation)

## 3. Sổ tính năng ứng viên (FEATURE-CANDIDATE — KHÔNG tự làm)

Định dạng: FC-ID · vấn đề giải quyết · giá trị · actor · workflow đề xuất · tác động FE/BE/DB/an ninh · độ phức tạp · rủi ro · ưu tiên đề xuất · khuyến nghị · QUYẾT ĐỊNH CHỦ DỰ ÁN (APPROVE/REJECT/DEFER/MODIFY)

(rỗng lúc khởi tạo — chỉ thêm khi audit phát hiện, và luôn chờ duyệt)

## 4. Quy tắc cập nhật sổ

- Mọi phát hiện mới PHẢI vào sổ trong 1 ngày làm việc kể cả chưa sửa
- Trạng thái chỉ tiến theo chuỗi chuẩn; nhảy cóc là vi phạm
- Khi fix xong: chuyển VERIFIED chỉ sau review độc lập + regression; rồi DOCUMENTED; rồi CLOSED
- Báo cáo định kỳ cho chủ dự án dùng đúng khung "AUDIT STATUS" (số lượng P0-P4, phase hiện tại, task đang chạy, blocker, next)
