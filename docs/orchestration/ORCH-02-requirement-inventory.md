# ORCH-02 — Sổ Yêu cầu (Requirement Inventory)

Mục tiêu: mọi yêu cầu của QLTTXD gom về 1 nơi, có ID, phân loại, và truy vết được. Nguồn: BRIEF.md, docs/ (spec, kiến trúc, roadmap), docs-phapluat/ (NĐ 15/2021, NĐ 16/2022, NĐ 50, NĐ 62), quyết định chủ dự án trong các chat, seed RBAC 27 quyền, máy trạng thái hồ sơ.

Quy ước phân loại: FUNC (chức năng) · NFUNC (phi chức năng) · SEC · DATA · UIUX · API · DB · WORKFLOW · COMPLIANCE · DEPLOY · DOC

## Khối A — Xác thực & Người dùng
- REQ-A01 [FUNC/SEC] Đăng nhập JWT: access ngắn hạn + refresh, blocklist khi logout, jti duy nhất
- REQ-A02 [FUNC] Tạo admin đầu tiên qua setup-admin (không user demo)
- REQ-A03 [FUNC/SEC] Quên mật khẩu: token một lần có hạn dùng, rate limit theo khóa cấu hình
- REQ-A04 [FUNC] Quản lý người dùng CRUD + gán vai trò (admin only)
- REQ-A05 [SEC] Mật khẩu bcrypt rounds theo cấu hình; không log mật khẩu/token
- REQ-A06 [FUNC] Hồ sơ cá nhân đổi mật khẩu; SSE token riêng hết hạn nhanh

## Khối B — Hồ sơ vi phạm & Máy trạng thái
- REQ-B01 [WORKFLOW] Máy trạng thái 15 bước cho luồng xử lý đơn vi phạm xây dựng
- REQ-B02 [WORKFLOW] Chuyển trạng thái chỉ theo ma trận transitions được phép; ghi audit mỗi lần chuyển
- REQ-B03 [WORKFLOW] Quyền từng trạng thái theo vai trò (role_state_permissions)
- REQ-B04 [FUNC] Tạo hồ sơ kèm ảnh upload + tọa độ bản đồ (PostGIS)
- REQ-B05 [FUNC] Biên bản kiểm tra, quyết định xử phạt, theo dõi khắc phục
- REQ-B06 [DATA] Không xóa cứng dữ liệu nghiệp vụ; soft delete/cancel có audit
- REQ-B07 [FUNC] Công dân gửi báo cáo → cán bộ tiếp nhận → xác minh → xử lý (luồng E2E trọng yếu)

## Khối C — Cấu hình hệ thống (Settings Center)
- REQ-C01 [FUNC/API] Toàn bộ cấu hình nằm trong DB qua bảng config; sửa tại Settings là hiệu lực thật (HC-03 đã xử lý W1)
- REQ-C02 [API] API bulk/import(dry-run)/test-smtp/purge-now theo spec Wave 1
- REQ-C03 [UIUX] Shell v2 tự sinh từ manifest; thêm module = thêm file khai báo
- REQ-C04 [UIUX] Tìm kiếm Ctrl+K; lịch sử thay đổi + hoàn tác
- REQ-C05 [SEC] Secret chỉ ở .env; GET trả "***"; test-smtp không leak credentials
- REQ-C06 [SEC] HSTS do Caddy phát duy nhất; HSTS_MAX_AGE env hóa (W4)
- REQ-C07 [FUNC] Version hiển thị đọc từ package.json build-time (HC-06, W4)

## Khối D — Vai trò & Quyền (RBAC)
- REQ-D01 [SEC] 27 permissions chuẩn theo seed; admin full; verifier/handler giới hạn đúng ma trận
- REQ-D02 [SEC] Không IDOR: truy cập tài nguyên theo sở hữu/quyền; kiểm tra cả list lẫn detail
- REQ-D03 [SEC] Frontend ẩn nút theo quyền nhưng backend PHẢI chặn độc lập

## Khối E — Nhật ký & Báo cáo
- REQ-E01 [DATA] Audit log đầy đủ hành động nhạy cảm: ai, lúc nào, làm gì, giá trị cũ/mới
- REQ-E02 [FUNC] Retention tự động theo config + purge thủ công gated flag
- REQ-E03 [FUNC] Thống kê/báo cáo tổng hợp theo thời gian, trạng thái, khu vực
- REQ-E04 [FUNC] Xuất dữ liệu JSON mask secret

## Khối F — Pháp lý & Tuân thủ
- REQ-F01 [COMPLIANCE] Luồng xử lý tuân NĐ 35/2019 & NĐ 15/2021 (xây dựng), thông tư hướng dẫn
- REQ-F02 [COMPLIANCE] Văn bản quyết định đúng thể thức (skill gov-docx-rendering tham khảo)
- REQ-F03 [DATA] Dữ liệu cá nhân công dân tối thiểu hóa, không public

## Khối G — Hạ tầng & Triển khai
- REQ-G01 [DEPLOY] docker-compose dựng đủ BE+FE+DB+Caddy; healthcheck đúng
- REQ-G02 [DEPLOY] Migration up/down đầy đủ; init script cho client mới đồng bộ với migration chain
- REQ-G03 [NFUNC] Rate limit đa tầng global/write/user/auth theo config
- REQ-G04 [NFUNC] Log có cấu trúc; không log secret; error không leak stack ra client
- REQ-G05 [DOC] README/env.example/docs mô tả đúng implementation hiện trạng

## Khối H — Giao diện
- REQ-H01 [UIUX] Responsive mobile/tablet/desktop; form validate + loading/empty/error states
- REQ-H02 [UIUX] Accessibility: label, focus ring, aria-live, keyboard nav, Esc đóng dialog
- REQ-H03 [UIUX] Bản đồ Leaflet chọn vị trí + hiển thị điểm hồ sơ

> Khi audit phát hiện yêu cầu mới từ tài liệu/pháp luật → bổ sung vào sổ này với ID kế tiếp (REQ-Ixx...), đánh dấu nguồn.
