# ORCH-04 — Kế hoạch Kiểm toán Đa lớp (Audit Playbook)

Tổng chỉ huy chạy các đợt audit theo thứ tự ưu tiên. Mỗi đợt = 1 batch task Kanban. KHÔNG audit lan man — đi theo checklist dưới, mỗi mục phải có bằng chứng ghi vào ORCH-03.

## ĐỢT A — Runtime & Nghiệp vụ trọng yếu (ưu tiên cao nhất)

Kiểm chứng hệ thống đang CHẠY THẬT, không phải build pass:
1. Boot BE thật (PG + server) → curl /health → đúng version, db connected
2. E2E luồng lõi bằng browser automation (Playwright đã cấu hình):
   login admin → tạo hồ sơ mới (ảnh + tọa độ) → chuyển trạng thái theo máy trạng thái → lập biên bản → quyết định → khắc phục → xem thống kê
   Chụp ảnh từng bước làm evidence.
3. Login/Logout/session hết hạn; refresh token; truy cập route bảo vệ khi chưa login
4. RBAC thực chiến: 4 vai trò (admin, case_handler, verifier, leader, citizen) thử thao tác vượt quyền → phải 403 ở API và ẩn UI
5. Browser console: không lỗi đỏ; network: không request failed âm thầm

## ĐỢT B — Hợp đồng API & Dữ liệu

1. Với mọi route trong app/backend/routes/: bảng method+path+auth+permission+validation+test coverage
2. Đối chiếu từng call FE (grep fetch/request trong frontend) vs route BE → phát hiện FRONTEND-BACKEND-CONTRACT-MISMATCH (sai path, sai payload, sai response shape)
3. DB: schema vs migration chain nhất quán; foreign key/index/constraint đầy đủ; orphan records check bằng SQL thật
4. Máy trạng thái: so transitions trong code vs DB seed vs tài liệu → 3 nguồn phải khớp

## ĐỢT C — An ninh (security agent chủ trì)

1. Authn: token verify mọi route protected; blocklist hoạt động; secret không hardcode
2. Authz: quét route thiếu middleware permission; test IDOR thủ công (đổi id trong URL giữa 2 user)
3. Upload: mime sniff thật, giới hạn size từ config, path traversal, tên file an toàn
4. Injection/XSS: tham số query luôn parameterized; output escape
5. Rate limit: cấu hình ăn thật (test vượt ngưỡng nhận 429)
6. Header an ninh: helmet còn hiệu lực phần không giao cho Caddy; Caddy phát HSTS duy nhất
7. Dependency scan (npm audit) — chốt danh sách CVE phải xử lý

## ĐỢT D — Hiệu năng & Chất lượng mã

1. Đo trước khi tối ưu: thời gian phản hồi các endpoint chính (curl -w), bundle size build, số query/endpoint chính (log SQL)
2. N+1: rà service gọi query trong loop
3. Dead code: export không dùng, component không import, route không consumer → danh sách dọn (task riêng, không xóa bừa)
4. Duplicate logic FE/BE constants → một nguồn hoặc checklist đồng bộ

## ĐỢT E — Triển khai & Tài liệu

1. Docker build từ sạch chạy được; init DB client mới ra đúng schema như migration chain
2. env.example khớp 100% biến code đọc (2 chiều)
3. Backup/restore DB: dump → restore vào DB tạm → đối chiếu số dòng
4. Docs: README setup đúng từng bước; CHANGELOG cập nhật; docs mô tả hiện trạng không mô tả "ý định"

## Luật chơi các đợt

- Mỗi đợt tạo task Kanban riêng cho agent phù hợp (coder/security/deployment/QA), spec đính kèm acceptance criteria đo được
- Orchestrator tự chạy những phần kiểm chứng nhanh (grep/curl/test) để tiết kiệm; việc sửa code luôn giao agent
- Phát hiện nào cũng vào ORCH-03 ngay cả khi sẽ hoãn sửa
- Kết thúc mỗi đợt: báo cáo AUDIT STATUS cho chủ dự án (P0-P4 counts, phase, active task, blocker, next) — KHÔNG report lẻ từng task nhỏ
