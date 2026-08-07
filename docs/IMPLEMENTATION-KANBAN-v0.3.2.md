# QLTTXD v0.3.2 — KẾ HOẠCH TRIỂN KHAI (triển khai kỹ thuật)

**Ngày bắt đầu:** 2026-08-06
**Trạng thái:** ĐANG TRIỂN KHAI — Sprint 0/1 (Accessibility Epic E5 + test baseline)
**Nguyên tắc:** Truy vết Recommendation → Issue → Epic → Task → Code → Test → Review → Release. Không sửa theo cảm tính, không tự quyết định, không đánh dấu hoàn thành nếu thiếu evidence.

---

## A. Trạng thái xác minh trước khi triển khai (verify-current-state)

Trước khi tạo task, đã đối chiếu code thực tế với báo cáo. Nhiều issue trong `AUDIT-REPORT-v0.3.2.md` đã được sửa sau này nhưng chưa có regression evidence trong kế hoạch:

| Issue | Trạng thái code thực tế | Hành động kế hoạch |
|---|---|---|
| C-02 password → invalidate tokens | ĐÃ CÓ `auth.js:355` | Regression-verify, KHÔNG re-implement |
| C-03 trust proxy | ĐÃ CÓ `server.js:52` (TRUST_PROXY default 1) | Regression-verify + test proxy/direct |
| C-04 client routing | ĐÃ CÓ pushState/popstate | Regression-verify |
| C-06 formatting | Cần kiểm tra | Chỉ format an toàn (diff review), không tùy tiện |
| H-02 migration runner | ĐÃ CÓ `scripts/migrate.js` + `schema_migrations` | Add `npm run migrate` script + test upgrade/fresh |
| H-03 valid transition options | ĐÃ CÓ TRANSITIONS | Regression-verify |
| H-05 ErrorBoundary lazy | ĐÃ CÓ | Regression-verify |
| H-07 SSE | Có nhưng dùng JWT ?token= (UX-14) | Cần B-SPEC-01 decision |
| M-03 debounce | ĐÃ CÓ 400ms | Regression-verify |
| M-05 token storage | MITIGATED (5min + HttpOnly + CSP) | Cần B-SPEC-01 / security review residual |
| H-11 reset token cleanup | UserTokensCleanup có cho blocklist; reset_token riêng cần verify | Verify + thêm nếu thiếu |
| E5 Accessibility | CHƯA làm | **Triển khai ngay** (WCAG 2.1 AA là yêu cầu bắt buộc spec, không cần phê duyệt nghiệp vụ) |

**Kết luận:** nhiệm vụ không nằm trong các spec blocker, có thể triển khai ngay là **Epic E5 (Accessibility Foundation)** và **Epic E0 test baseline**.

---

## B. Epic đang triển khai (Sprint 0 - đợt 1)

| Kanban ID | Task | Epic | Priority | Assignee | Trạng thái |
|---|---|---|---|---|---|
| t_13d9db1e | FE-E5-01 Shared accessible Dialog | E5 | P0 | coder | dispatched |
| t_34f4e0df | FE-E5-02 Accessible lightbox | E5 | P0 | coder | dispatched |
| t_993ab1be | FE-E5-03 Keyboard click-only controls | E5 | P0 | coder | dispatched |
| t_d933cd92 | FE-E5-04 Accessible ARIA Tabs | E5 | P0 | coder | dispatched |
| t_e0e2de95 | FE-E5-05 Map + citizen non-pointer | E5 | P0 | coder | dispatched |
| t_a52f2b31 | FE-E0-01 A11Y test harness (axe+keyboard) | E0 | P1 | security | dispatched |
| t_3989703e | FE-E5-06 Skip link, focus, live, contrast, semantics | E5 | P1 | coder | dispatched |

**Ghi chú rủi ro song song:** E5-02 (lightbox) và E5-04 (tabs) đều sửa `CaseDetail.jsx` → có nguy cơ conflict file. Đã giới hạn bằng nhiệm vụ riêng; cần theo dõi merge.

---

## C. Epic chờ Specification Gate (KHÔNG triển khai trong đợt này)

| Epic | Blocker cần phê duyệt | Lý do chặn |
|---|---|---|
| E1 Auth/SSE/retention | B-SPEC-01 (SSE token transport), B-SPEC-06 | JWT ?token= là lỗi security; cần chọn cookie-only/polling/one-time trước |
| E2 Workflow/state | B-SPEC-02 (state→artifact matrix), B-SPEC-04 (history contract) | Không được tự quyết định nghiệp vụ |
| E3 Role UX | B-SPEC-03 (KPI/SLA/assignment), B-SPEC-05 (citizen lookup privacy) | Cần Product/Legal |
| E4 Reporting/Map | scope policy | Cần chốt contract báo cáo |
| E6 DB/API | B-SPEC-07 (seed data source), retention | Cần source of truth dữ liệu |
| E7 Delivery | B-SPEC-10 | NFR target |
| E8/E9 | B-SPEC-09 (TS/dark/error tracking) | Quyết định kiến trúc |

---

## D. Bước tiếp theo sau đợt 1

1. Theo dõi 7 task E5; verify từng acceptance qua test.
2. Tạo `npm run migrate` script + regression task cho C-02/C-03/C-04/M-03/H-02/H-05 (verify-current-state, không re-implement).
3. Tạo `TA-*` regression backend tests cho auth/state/index.
4. Khi B-SPEC-01..10 được phê duyệt → mở các task E1..E8 bị chặn.
5. Sau khi hợp nhất toàn bộ → chạy vòng Review mới trước khi kết luận Production Ready.

---

## E. Quy ước truy vết

Mỗi task Kanban bắt buộc có: Task ID, Epic, Requirement/Spec, Issue ID, Module, Priority/Difficulty/Estimate, Owner, Dependency, Files, Frontend/Backend/DB/API impact, Permission/Workflow impact, Tests, Acceptance Criteria, DoD, Rollback, Risk.

**KHÔNG** đánh dấu task complete nếu thiếu: test evidence, review approval độc lập, files changed.
