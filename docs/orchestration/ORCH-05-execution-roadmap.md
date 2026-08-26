# ORCH-05 — Kế hoạch Triển khai Tổng (Execution Roadmap)

Chủ dự án đã phê duyệt: kích hoạt chế độ LEAD ORCHESTRATOR liên tục. Kế hoạch dưới là trình tự thực thi, mỗi giai đoạn kết thúc bằng mốc báo cáo tổng.

## GIAI ĐOẠN 0 — Khởi động (ngay lập tức) ✅
- [x] Kiểm tra môi trường điều phối (Hermes, profiles, key)
- [x] Tạo bộ tài liệu ORCH-00 → ORCH-06
- [x] Nhập nợ đã biết vào sổ lỗi (DEF-001..003)
- Mốc: bộ khung điều phối sẵn sàng

## GIAI ĐOẠN 1 — Baseline & Truy vết (đợt đầu)
- Task AUD-BASE: chạy lại BE/FE suite + build + boot + health, điền ORCH-01 Baseline Report
- Task AUD-TRACE: rà ma trận truy vết REQ-A..H theo ORCH-03, đánh dấu GAP
- Owner: coder (chạy test) + orchestrator tự kiểm chứng lại
- Mốc: baseline số thật + danh sách TRACEABILITY-GAP

## GIAI ĐOẠN 2 — Audit Đợt A (Runtime + nghiệp vụ trọng yếu)
- Task AUD-RUNTIME-QA: E2E Playwright luồng lõi 7 bước + RBAC 4 vai trò + console sạch
- Evidence: screenshots từng bước lưu docs/orchestration/evidence/
- Mốc: xác nhận hoặc phát hiện lỗi luồng lõi → nhập sổ DEF

## GIAI ĐOẠN 3 — Audit Đợt B (API + DB)
- Task AUD-API-CONTRACT: bảng endpoint vs FE calls, mismatch list
- Task AUD-DB-INTEGRITY: schema/migration/orphan SQL check
- Mốc: hợp đồng API sạch hoặc DEF mới

## GIAI ĐOẠN 4 — Audit Đợt C (Security)
- Task SEC-AUDIT: 7 mục checklist security agent; npm audit
- Mốc: báo cáo an ninh có phân loại P

## GIAI ĐOẠN 5 — Remediation Batch 1
- Sửa toàn bộ P0/P1 (nếu có) + P2 chọn lọc theo ưu tiên ORCH-master
- Mỗi fix: spec → coder → self-test → review độc lập (agent khác coder) → regression → verify
- Mốc: 0 P0, 0 P1

## GIAI ĐOẠN 6 — Nợ kỹ thuật đã biết (DEF-001, DEF-002)
- Task FIX-WF-STATES: backend PUT /workflow/states/:code (đổi label) + test + nối FE shell v2 bỏ view-only
- Task FIX-MIME-TOGGLE: backend PUT mime-types is_active + test + FE toggle ăn thật
- Mốc: 2 trang shell v2 sửa được thật, regression pass

## GIAI ĐOẠN 7 — Audit D+E (Hiệu năng, dead code, deploy, docs)
- Task PERF-BASELINE: đo số trước, chỉ tối ưu chỗ đo ra chậm
- Task DEAD-CODE-CLEANUP: xóa theo danh sách grep xác minh (task agent, orchestrator duyệt danh sách trước)
- Task DEPLOY-VERIFY: docker build sạch + backup/restore drill
- Task DOCS-SYNC: README/env.example/docs khớp hiện trạng
- Mốc: hệ thống tái lập được, tài liệu trung thực

## GIAI ĐOẠN 8 — Re-audit & Chốt VERIFIED
- Re-audit tập trung mọi fix đã làm (original defect gone? root cause fixed? regression?)
- Đối chiếu PROJECT DEFINITION OF DONE checklist
- Feature candidates (nếu gom được) trình chủ dự án duyệt riêng
- Mốc cuối: tuyên bố VERIFIED hoặc liệt kê rõ hạng mục chưa đạt + lý do + kế hoạch

## Quy ước vận hành xuyên suốt
1. Mỗi lúc chỉ 1 task Kanban chạy (tránh xung đột ghi); task xong + verified + commit thì mới mở task sau
2. Commit sau mỗi task verified; push resolve-pending; định kỳ merge master
3. Thay đổi UI phải kèm screenshot mới trong commit (quy ước chủ dự án 2026-08-08)
4. Agent crash/block → chẩn đoán nguyên nhân → unblock/dispatch lại, không dừng chờ
5. Báo cáo tổng cho chủ dự án khi: xong một giai đoạn trọn vẹn, hoặc gặp DECISION-GATE cần phán đoán con người
6. Không bao giờ tự tay sửa code sản phẩm — kể cả khi bug nhỏ; luôn dispatch
