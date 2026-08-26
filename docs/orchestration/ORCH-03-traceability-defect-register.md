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

(điền trong quá trình AUDIT — mỗi phát hiện phải kèm lệnh/bằng chứng cụ thể, không ghi cảm tính)

## 3. Sổ tính năng ứng viên (FEATURE-CANDIDATE — KHÔNG tự làm)

Định dạng: FC-ID · vấn đề giải quyết · giá trị · actor · workflow đề xuất · tác động FE/BE/DB/an ninh · độ phức tạp · rủi ro · ưu tiên đề xuất · khuyến nghị · QUYẾT ĐỊNH CHỦ DỰ ÁN (APPROVE/REJECT/DEFER/MODIFY)

(rỗng lúc khởi tạo — chỉ thêm khi audit phát hiện, và luôn chờ duyệt)

## 4. Quy tắc cập nhật sổ

- Mọi phát hiện mới PHẢI vào sổ trong 1 ngày làm việc kể cả chưa sửa
- Trạng thái chỉ tiến theo chuỗi chuẩn; nhảy cóc là vi phạm
- Khi fix xong: chuyển VERIFIED chỉ sau review độc lập + regression; rồi DOCUMENTED; rồi CLOSED
- Báo cáo định kỳ cho chủ dự án dùng đúng khung "AUDIT STATUS" (số lượng P0-P4, phase hiện tại, task đang chạy, blocker, next)
