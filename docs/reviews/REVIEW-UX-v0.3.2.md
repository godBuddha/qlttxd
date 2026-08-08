# REVIEW-UX — QLTTXD v0.3.2
**Hạng mục:** IA, Information hierarchy, User journey/flow, Dashboard, Role-based UX, Business workflow, Productivity, Scalability (frontend)
**Người review:** researcher (profile) · **Ngày:** 2026-08-06 · **Phạm vi:** chỉ xem, không sửa source
**Căn cứ:** BRIEF.md, docs/05-thiet-ke-giao-dien.md, docs/02-quy-trinh-nghiep-vu.md, toàn bộ `app/frontend/src/**`, screenshots v0.3.2, README.md, docs/AUDIT-REPORT-v0.3.2.md

---

## 1. Tóm tắt định tính

Hệ thống đã đạt **functional/IA ổn định về cấu trúc**: shell gồm header + sidebar + main, routing không còn dùng `useState` thuần (đã tích hợp `history.pushState/popstate`), các trang lazy-load bọc `ErrorBoundary+Suspense`, state machine chỉ offer chuyển trạng thái hợp lệ (qua `TRANSITIONS`), ảnh minh chứng không còn đưa JWT vào URL (`/api/v1/attachments/...` + header). Các vấn đề C-04, H-03, H-05, M-03 từ audit v0.3.2 đã **được xử lý** trong vòng này.

Tuy nhiên trải nghiệm **theo vai trò (role UX) và mức năng suất (productivity)** vẫn ở mức "màn hình chung cho mọi vai trò": dashboard và danh sách hồ sơ giống hệt nhau giữa admin / cán bộ thụ lý / xác minh viên / lãnh đạo, thiếu worklist "việc cần tôi xử lý", thiếu approval queue cho lãnh đạo, và một số vấn đề IA/breadcrumb (spec 05 yêu cầu breadcrumb nhưng chưa triển khai).

## 2. Điểm đã được khắc phục từ vòng audit trước (đã verify)

| Audit cũ | Trạng thái v0.3.2 | Bằng chứng |
|---|---|---|
| C-04 no client routing | ✅ Đã fix | `src/main.jsx` dùng `window.history.pushState` + `popstate`, deep-link `/cases/:id`, redirect theo role sau login |
| H-03 dropdown tất cả states | ✅ Đã fix | `CaseDetail.jsx` render `TRANSITIONS[item.trang_thai]` (chỉ bước hợp lệ) |
| H-05 no error boundary | ✅ Đã fix | Mọi lazy page bọc `<Suspense>` + `<ErrorBoundary>` |
| M-03 no search debounce | ✅ Đã fix | `CaseList.jsx` debounce 400ms |
| C-01 token in URL (ảnh) | ✅ Đã fix | `EvidenceImage.jsx` fetch blob qua `/api/v1/attachments/{f}/view` + header `X-Auth-Token`, revoke URL |
| H-07 push realtime | 🟡 Có SSE | `thong-bao/stream` + fallback polling 30s (nhưng xem UX-14 dưới) |

---

## 3. PHÁT HIỆN (kèm ID, mức độ, file/component, tiêu chí chấp nhận)

### 🔴 HIGH

**UX-01 — Webhooks dữ liệu chung: không có dashboard & KPI theo vai trò.**
- **Mô tả:** `pages/Dashboard.jsx` render cùng 1 bộ (3 stat + 3 chart) cho mọi vai trò có `case.view` (admin, cán bộ thụ lý, xác minh viên, lãnh đạo). Xác minh viên cần "hàng chờ xác minh", lãnh đạo cần tiến độ đóng hồ sơ/phạt, nhưng không có variant nào. Chart là thanh tĩnh — không click vào segment để lọc.
- **File/Component:** `app/frontend/src/pages/Dashboard.jsx`, `components/Status.jsx` (`Chart`).
- **Acceptance:** ① Mỗi vai trò thấy ≥1 KPI hoặc action liên quan trực tiếp đến việc của họ (vd verifier: "chờ xác minh"; leader: "hồ sơ quá hạn"). ② Click vào 1 segment chart dẫn sang `CaseList` đã filter sẵn trạng thái đó.

**UX-02 — Chuyển trạng thái không được "cổng" bởi việc hoàn tất bước tiên quyết.**
- **Mô tả:** `TRANSITIONS` chỉ ràng buộc bậc liền kề (adjacency), không kiểm tra hồ sơ đã có biên bản/quyết định/khắc phục chưa. Một hồ sơ có thể bị đẩy thẳng từ `cho_lap_bien_ban` → `da_ra_quyet_dinh` mà chưa hề có quyết định nào; system không chặn, không cảnh báo bước còn thiếu.
- **File/Component:** `app/frontend/src/lib/constants.js` (`TRANSITIONS`), `pages/CaseDetail.jsx` (`action-box`).
- **Acceptance:** ① Không thể nhảy tới trạng thái cần artifact chưa tồn tại (vd không có biên bản thì không tới `da_lap_bien_ban`/`da_ra_quyet_dinh`). ② UI nêu rõ bước tiếp theo cần thao tác (guided workflow) thay vì select trống + nút "Cập nhật".

**UX-14 — Token JWT bị đưa vào query string của SSE notification.**
- **Mô tả:** `components/BellNotification.jsx` mở `EventSource(`/api/v1/thong-bao/stream?token=<JWT>`)`; backend `routes/thong-bao.js` verify `req.query.token`. Đây **cùng lớp lỗi C-01** mà vòng này đã khắc phục cho ảnh — JWT lại rơi vào browser history / proxy log / Referer. (Giới hạn: `EventSource` không set header, nên đây là chỗ cần thiết kế lại, không phải bỏ qua.)
- **File/Component:** `app/frontend/src/components/BellNotification.jsx` (dòng ~63), `app/backend/routes/thong-bao.js`.
- **Acceptance:** ① Không JWT nào xuất hiện trong URL của SSE. ② Giải pháp thay thế: cookie-only event stream, hoặc đăng ký SSE xong auth qua short-lived code/header, hoặc fallback polling thuần không cần token URL.
---
### 🟠 MEDIUM

**UX-03 — Không có worklist theo vai trò / không phân biệt Handler–Verifier–Leader ở UI.**
- **Mô tả:** `main.jsx` phân biệt chỉ bằng cờ `isOfficer = can(user,'case.view')`; Cán bộ thụ lý và Xác minh viên (2 vai trò khác nghiệp vụ) nhận cùng trang "Hồ sơ xử lý" không lọc theo vai người đang thao tác. Lãnh đạo không có hàng chờ duyệt ban-hành / phê duyệt biên lảo. RBAC đúng ở tầng quyền, nhưng UX vai trò chưa hiện hữu.
- **File/Component:** `app/frontend/src/main.jsx`, `pages/CaseList.jsx`, `pages/Dashboard.jsx`.
- **Acceptance:** ① Có thêm bộ lọc/queue mặc định "Việc cần tôi" cho handler/verifier. ② Lãnh đạo thấy danh sách quyết định/biên bản đang chờ duyệt với action phê duyệt/từ chối ngay trên list.

**UX-04 — Breadcrumb thiếu (viphạm spec T5) + nhóm sidebar không nhất quán.**
- **Mô tả:** `docs/05-thiet-ke-giao-dien.md §5` yêu cầu "mỗi màn hình phải có breadcrumb" nhưng chỉ `CaseDetail` có nút back (←). Nhóm "Quản trị" chỉ bọc Người dùng/Phân quyền/Nhật ký; "Địa điểm", "Danh mục", "Báo cáo", "Bản đồ" treo ngoài group.
- **File/Component:** `app/frontend/src/main.jsx` (nav ~dòng 216–315).
- **Acceptance:** ① Breadcrumb hiển thị hết các trang sâu (Hồ sơ → Chi tiết). ② Các mục nav được nhóm logic (Công việc / Thống kê / Quản trị) thay vì san bằng.

**UX-05 — Timeline không phải lịch sử xử lý thật.###
- **Mô tả:** `Timeline` (`CaseDetail.jsx`) chỉ render 2 mục cứng: "Khởi tạo hồ sơ" + trạng thái hiện tại; không hiển thị chuỗi biến đổi trạng thái, ai làm, khi nào — dù audit log phía backend đã có đủ.
- **File/Component:** `app/frontend/src/pages/CaseDetail.jsx` (`Timeline`).
- **Acceptance:** ① Timeline tái hiện từng bước chuyển trạng thái + tác nhân + timestamp. ② Có nguồn dữ liệu lịch sử riêng (không phụ thuộc bảng audit) để tránh lộ PII audit cho cán bộ.

**UX-06 — Tab Khắc phục còn lộ hint giới hạn sản phẩm + label chưa bản địa hoá.**
- **Mô tả:** `Remedy` hiển thị văn bản dành cho dev ("API chi tiết hồ sơ hiện chưa trả danh sách khắc phục..."), select trạng thái dùng `x.replaceAll('_',' ')` → ra "dang_thuc_hien" dạng thô thay vì nhãn tiếng Việt đã có sẵn.
- **File/Component:** `app/frontend/src/pages/CaseDetail.jsx` (`Remedy`, dòng ~544–566).
- **Acceptance:** ① Không còn hint kỹ thuật hiển thị cho end-user. ② Trạng thái khắc phục dùng nhãn tiếng Việt bản địa hoá. ③ Danh sách khắc phục đã tạo hiển thị lại được trong cùng phiên làm việc.

**UX-08 — Công dân không theo dõi được vị thế báo cáo của mình.**
- **Mô tả:** "Báo cáo của tôi" (`ReportTable`) không có cột trạng thái xử lý; citizen không thể tra cứu mã báo cáo / biết báo cáo đang ở đâu trong pipeline.
- **File/Component:** `app/frontend/src/pages/CitizenPage.jsx` (`ReportTable`).
- **Acceptance:** ① Báo cáo của citizen hiển thị trạng thái hiện hành (từ `ho_so` liên kết nếu có) hoặc trạng thái riêng. ② Cho phép tra cứu theo mã khi chưa đăng nhập/thất lạc.

**UX-09 — Báo cáo (Leader): chart luôn = snapshot global, export = theo filter → 2 số liệu mâu thuẫn.**
- **Mô tả:** `ReportPage.jsx` nạp `/thong-ke/tong-quan` vào charts (không theo filter), trong khi nút Xuất CSV/PDF gọi `/thong-ke/xuat` với filter. User thấy chart toàn cục nhưng tải file chỉ chứa subset → gây hiểu nhầm số liệu.
- **File/Component:** `app/frontend/src/pages/ReportPage.jsx` (`applyFilters` chỉ áp cho `download`).
- **Acceptance:** ① Chart và export dùng chung bộ filter (nhấn "Áp dụng" → cả chart + export). ② Nhãn nêu rõ phạm vi dữ liệu đang hiển thị.

**UX-10 — Admin Users thiếu search/pagination UI; CaseList pagination thô sơ.**
- **Mô tả:** API `admin/users` hỗ trợ `limit/page` nhưng `AdminUsersPage.jsx` không có ô tìm kiếm/khu phân trang → dữ liệu vượt trang 1 không với tới. `CaseList` chỉ có "Trang trước/sau", không số trang, không thông báo tổng số.
- **File/Component:** `app/frontend/src/admin/AdminUsersPage.jsx`, `pages/CaseList.jsx`.
- **Acceptance:** ① Admin users có ô tìm kiếm + phân trang thực sự. ② CaseList báo tổng số kết quả, cho phép nhảy trang / giới hạn kết quả.

**UX-13 — Bản đồ toàn cục (BanDo) render toàn bộ marker không phân trang/cluster.**
- **Mô tả:** `BanDoPage.jsx` fetch `/ban-do/vi-pham` bỏ toàn bộ và vẽ từng `circleMarker` (không clustering, không filter theo trạng thái trên map). Dữ liệu tăng → nhồi bộ nhớ/trình duyệt; đã được audit M-15 nêu nhưng vẫn còn ở frontend.
- **File/Component:** `app/frontend/src/pages/BanDoPage.jsx`, `app/backend/routes/ban-do.js`.
- **Acceptance:** ① Clustering marker hoặc phân trang/tiled trên zoom. ② Map có bộ lọc trạng thái để giảm payload.
---
### 🟢 LOW

**UX-07 — `window.confirm` (native) dùng cho hành động huỷ, trái style modal hiện có.**
- `OfficerReportsPage.convertToCase`, `AdminLocationsPage.handleDelete`, `AdminCatalogPage.handleDelete` dùng `window.confirm`; các action khác dùng modal tuỳ chỉnh → không đồng nhất, không tái lập được confirmation.
- **Acceptance:** Thống nhất confirmation modal tại các điểm phá huỷ/chuyển hoá dữ liệu.

**UX-11 — Lộ quyền nội bộ (raw codes) trong sidebar cho end-user.**
- `main.jsx` render `Quyền: {user.permissions?.join(', ')}` — chuỗi quyền dev (vd `case.view, case.update…`) hiện cho người dùng; nên thay bằng tên vai trò đã bản địa hoá; bị ẩn trên mobile.
- **Acceptance:** Sidebar hiện vai trò (nhãn tiếng Việt), không hiện raw permission codes.

**UX-12 — Truy cập bàn phím/A11y nhưng khó khám phá; thiếu `aria-selected` trên tab.**
- Tab `CaseDetail` điều hướng bằng phím Arrow ←/→/Enter (gán lên toàn `window`) khó nhận biết; tab buttons thiếu `aria-selected`/`role="tab"`; charts là div không có ngữ nghĩa bảng thay thế.
- **Acceptance:** ① Tab có `role/aria-selected` đúng và chỉ bắt phím khi tab đang focus. ② Chart có thêm bảng văn bản tổng hợp hoặc `aria-label` đầy đủ.

---

## 4. Tổng hợp mức ưu tiên

| Sev | Count | Khuyến nghị |
|---|--|--|
| 🔴 High | 3 | UX-01, UX-02, UX-14 → xử lý trước release rộng rãi |
| 🟠 Medium | 8 | UX-03..06, UX-08..10, UX-13 → sprint tiếp theo |
| 🟢 Low | 3 | UX-07, UX-11, UX-12 → backlog |

**Thứ tự nên làm:** UX-14 (bảo mật, ngắn) → UX-02 (chặn workflow sai) → UX-01+UX-03 (khác biệt vai trò — giá trị năng suất lớn nhất) → UX-09 (đúng số liệu leader) → còn lại.

## 5. Files đã khảo sát
`main.jsx`, `lib/constants.js`, `lib/AuthContext.jsx`, `lib/api.js`, `pages/{Dashboard, CaseList, CaseDetail, CitizenPage, ReportPage, OfficerReportsPage, ProfilePage, BanDoPage}.jsx`, `admin/{AdminUsersPage, AdminRolesPage, AdminLocationsPage, AdminCatalogPage}.jsx`, `components/{Login, BellNotification, MapView, Status, EvidenceImage, NotFound, Loading}.jsx`, `styles.css`, `docs/05-thiet-ke-giao-dien.md`, `docs/02-quy-trinh-nghiep-vu.md`, `docs/AUDIT-REPORT-v0.3.2.md`, screenshots v0.3.2 (32 ảnh), `app/backend/routes/{ho-so, bao-cao, thong-ke, ban-do, thong-bao, admin-users}.js`.