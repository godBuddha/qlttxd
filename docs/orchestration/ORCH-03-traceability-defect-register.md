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

## 3. Sổ tính năng ứng viên (FEATURE-CANDIDATE — KHÔNG tự làm)

Định dạng: FC-ID · vấn đề giải quyết · giá trị · actor · workflow đề xuất · tác động FE/BE/DB/an ninh · độ phức tạp · rủi ro · ưu tiên đề xuất · khuyến nghị · QUYẾT ĐỊNH CHỦ DỰ ÁN (APPROVE/REJECT/DEFER/MODIFY)

(rỗng lúc khởi tạo — chỉ thêm khi audit phát hiện, và luôn chờ duyệt)

## 4. Quy tắc cập nhật sổ

- Mọi phát hiện mới PHẢI vào sổ trong 1 ngày làm việc kể cả chưa sửa
- Trạng thái chỉ tiến theo chuỗi chuẩn; nhảy cóc là vi phạm
- Khi fix xong: chuyển VERIFIED chỉ sau review độc lập + regression; rồi DOCUMENTED; rồi CLOSED
- Báo cáo định kỳ cho chủ dự án dùng đúng khung "AUDIT STATUS" (số lượng P0-P4, phase hiện tại, task đang chạy, blocker, next)
