# QLTTXD v0.3.2 — KẾ HOẠCH TRIỂN KHAI SAU REVIEW

Ngày: 2026-08-06
Trạng thái: PLAN ONLY — chưa sửa code, chưa triển khai implementation

## 1. Mục tiêu

Xử lý có truy vết toàn bộ Issue từ:

- `docs/AUDIT-REPORT-v0.3.2.md`
- `docs/REVIEW-UX-v0.3.2.md`
- `docs/reviews/A11Y-REVIEW-v0.3.2.md`

Mọi thay đổi phải đi theo chuỗi:

`Requirement → Specification → Issue → Epic → Task → Code → Test → Review → Release`

## 2. Trạng thái hiện tại

| Nhóm | Raw Issue | Trạng thái |
|---|---:|---|
| Full-stack audit | 44 | Có Issue đã fix/mitigate và Issue mở |
| UX review | 14 | 3 High, 8 Medium, 3 Low còn cần xử lý |
| A11Y review | 14 | 2 Critical, 4 High, 6 Medium, 2 Low |
| Tổng raw | 72 | Có overlap, phải trace từng ID, không đếm trùng |

### Đã có bằng chứng fix/mitigation, cần regression

- C-01 ảnh: blob/header auth.
- C-04 client-side routing.
- H-03 valid transition options.
- H-05 ErrorBoundary/Suspense.
- M-03 debounce search.
- H-07 SSE + polling fallback: chưa hoàn tất do UX-14.
- M-05 token storage: đã mitigation nhưng còn residual access-token XSS risk.

## 3. Specification Gate — blocker trước implementation

Không tự quyết định các nội dung sau:

| ID | Nội dung cần phê duyệt | Người quyết định |
|---|---|---|
| B-SPEC-01 | SSE auth: cookie-only, polling, hay one-time stream credential; attachment URL policy | Security + Architecture |
| B-SPEC-02 | Ma trận 13 state → artifact bắt buộc → role → quyền override | Product + Legal + Backend |
| B-SPEC-03 | KPI, assignment, SLA, overdue và worklist của từng role | Product Owner |
| B-SPEC-04 | Contract lịch sử workflow, actor/time/PII masking | Architecture + Legal |
| B-SPEC-05 | Citizen status lookup, OTP/captcha, dữ liệu tối thiểu, anti-enumeration | Security + Product |
| B-SPEC-06 | Audit retention, archive, legal hold, restore SLA | Legal + Operations |
| B-SPEC-07 | Source of truth cho seed/dataset pháp lý/địa giới | Product + Legal + DB |
| B-SPEC-08 | Danh mục public/private và cache policy | Security + Product |
| B-SPEC-09 | Có làm TypeScript, dark mode, error tracking trong release này không | Architecture + PO |
| B-SPEC-10 | Target cho PWA, PDF metadata, Swagger, Docker image | Engineering Manager |

**Gate:** mỗi blocker phải có quyết định, owner, ngày phê duyệt, version specification và risk acceptance nếu defer.

## 4. Epic triển khai

| Epic | Nội dung | Priority |
|---|---|---|
| E0 | Specification, test baseline, traceability, CI | P0 |
| E1 | Authentication, SSE, token, audit, retention | P0/P1 |
| E2 | Workflow state machine, artifact gating, timeline | P0/P1 |
| E3 | Role dashboard, worklist, approval queue, citizen tracking | P1 |
| E4 | Reporting, export parity, PostGIS map scale | P1 |
| E5 | Accessible Dialog, Tabs, lightbox, keyboard, map fallback | P0/P1 |
| E6 | Migration, indexes, validation, pagination, health, timeout | P0/P1/P2 |
| E7 | Service Worker, OpenAPI, backup, docs, runtime | P1/P2 |
| E8 | Component refactor, CSS/token, splitting, TypeScript decision | P2/P3 |
| E9 | Optional PWA, dark mode, PDF metadata | P3 |

## 5. Thứ tự triển khai tối ưu

```text
M0 Specification Gate
  ↓
S0 Baseline + traceability + formatting
  ↓
S1 P0 Security + accessibility foundation
  ↓
S2 Workflow gates + role UX + citizen status
  ↓
S3 API/DB/report/map/runtime reliability
  ↓
S4 Maintainability + optional enhancements
  ↓
M4 Full re-review against every original Issue
  ↓
Release Candidate → Production Readiness Gate
```

## 6. Sprint Planning

### M0 — Specification Gate

**Output:** các B-SPEC-01..10 được approve hoặc defer chính thức.

Không được bắt đầu task phụ thuộc khi chưa có decision.

### Sprint 0 — Baseline & Safety Net

Tasks:

- `T-E0-01`: Baseline backend/frontend/E2E/A11Y/performance.
- `T-E0-02`: Traceability matrix và formatting gate.
- `T-E1-03`: Password change invalidate toàn bộ session.
- `T-E1-04`: Trust proxy và source-IP audit.
- `T-E6-01`: Migration runner safe design/implementation.

Exit criteria:

- Backend baseline 159/159 không giảm.
- Frontend baseline 41/41 không giảm.
- Có test matrix và mapping toàn bộ Issue.

### Sprint 1 — P0 Security & Accessibility

Tasks:

- `T-E1-01`: ADR cho SSE/attachment token transport.
- `T-E1-02`: SSE không JWT trong URL.
- `T-E5-01`: Shared accessible Dialog.
- `T-E5-02`: Accessible lightbox.
- `T-E5-03`: Keyboard cho click-only controls.
- `T-E5-04`: Shared ARIA Tabs.
- `T-E5-05`: Map/citizen non-pointer fallback.
- `T-E2-01`: State/artifact matrix.

Exit criteria:

- Không còn token trong URL.
- Không còn A11Y Critical.
- Modal/lightbox/tabs/map có keyboard test.
- State matrix được Product/Legal approve.

### Sprint 2 — Workflow & Role Operations

Tasks:

- `T-E2-02`: Backend workflow/artifact gating.
- `T-E2-03`: Guided workflow UI.
- `T-E2-04`: Case workflow history API/DB.
- `T-E2-05`: Timeline/remedy persistence/localization.
- `T-E3-01`: Role KPI/worklist contract.
- `T-E3-02`: Role-aware dashboard.
- `T-E3-03`: Worklist + leader approval queue.
- `T-E3-04`: Citizen status and safe lookup.

Exit criteria:

- Không chuyển state nếu thiếu artifact bắt buộc.
- Handler/verifier/leader có queue riêng.
- Citizen xem được trạng thái hợp lệ.
- Timeline hiển thị actor/time/history thật.

### Sprint 3 — Data, Reporting, Spatial & Runtime

Tasks:

- `T-E4-01`: Unified filtered statistics contract.
- `T-E4-02`: Chart/table/export parity.
- `T-E4-03`: Map bbox/filter/clustering.
- `T-E6-02`: Indexes, totals, pagination contracts.
- `T-E6-03`: Validation consistency.
- `T-E6-04`: Timeout/readiness/health dependency.
- `T-E1-05`: Reset token + audit retention.
- `T-E7-01`: Service Worker deployment-safe caching.
- `T-E7-02`: OpenAPI/Swagger parity.
- `T-E7-04`: Backup/restore automation.

Exit criteria:

- Chart/table/export cùng query/filter/scope.
- Map payload bounded và có load test.
- Migration/backup/restore diễn tập thành công.
- Health/readiness/timeout hoạt động.

### Sprint 4 — Maintainability & Optional Scope

Tasks:

- `T-E5-06`: Skip link, route focus, live regions, contrast, table semantics.
- `T-E5-07`: Tokens, reduced motion, Confirm/DataTable/Pagination dùng chung.
- `T-E7-03`: Dependency/docs/version cleanup.
- `T-E7-05`: Structured error/logging/observability.
- `T-E8-01`: Granular code splitting/performance budget.
- `T-E8-02`: TypeScript ADR/migration decision.
- `T-E8-03`: Docker optimization.
- `T-E9-01`: Dark mode/PWA/PDF metadata nếu được approve.

## 7. Dependency Graph

```text
B-SPEC-01 → E1 SSE/attachment transport → security tests
B-SPEC-02 → E2 state/artifact matrix → backend gates → guided UI
B-SPEC-03 → E3 KPI/worklist contract → dashboard/approval queue
B-SPEC-04 → E2 history API → timeline UI
B-SPEC-05 → E3 citizen lookup + map fallback
B-SPEC-06 → audit retention/archive/restore

E0 baseline ───────────────→ tất cả implementation
E5 Dialog ─────────────────→ modal/lightbox/confirm
E5 Tabs ───────────────────→ CaseDetail/AdminCatalog tabs
E6 Migration ──────────────→ indexes/retention/spatial changes
E4 Report contract ────────→ chart/export UI
E7 SW strategy ────────────→ deployment release
```

Có thể triển khai song song sau baseline:

- Trust proxy.
- Password token invalidation.
- Formatting/traceability.
- Migration runner design.
- Shared Dialog/Tabs design.
- Test foundation.

Không triển khai song song nếu cùng sửa:

- Auth transport.
- State machine/service.
- Cùng component modal/tabs.
- Cùng migration/schema.
- Cùng API statistics contract.

## 8. Quy chuẩn Task

Mỗi task trong Kanban bắt buộc có:

- Task ID.
- Epic.
- Requirement ID.
- Issue ID.
- Specification ID/version.
- Module.
- Priority/Difficulty/Estimate.
- Owner và reviewer độc lập.
- Dependency.
- Files dự kiến.
- Frontend/Backend/Database/API impact.
- Permission/workflow impact.
- Tests cần cập nhật.
- Acceptance Criteria.
- Definition of Done.
- Rollback Plan.
- Risk.

Không dispatch task thiếu Specification ID hoặc Acceptance Criteria.

## 9. Regression Plan

Sau mỗi task phải chạy phần liên quan và cuối sprint chạy full suite:

- Frontend build/unit/component/E2E.
- Backend unit/integration.
- API status/auth/RBAC/validation/OpenAPI.
- Database fresh/upgrade/migration/rollback/restore.
- Business state matrix và artifact gating.
- UI/UX loading/empty/error/permission/success.
- Responsive: 320/375/768/1024/1440 px.
- Accessibility: axe, Tab, Enter, Space, Escape, arrows, focus, contrast.
- Performance: bundle, API payload/latency, map marker count, render/memory.
- Security: token URL scan, XSS/CSP, cookie/CSRF, IDOR, RBAC, log redaction.

## 10. Release Gate

Chỉ tạo Release Candidate khi:

- Không còn Critical/High mở.
- B-SPEC-01..08 đã approve hoặc có risk acceptance chính thức.
- 100% Requirement/Specification có traceability.
- Acceptance Criteria có evidence.
- Backend 159/159 và frontend baseline + tests mới pass.
- Accessibility không còn blocker.
- Migration, backup, restore, health, monitoring, rollback đã diễn tập.
- Product Owner, Legal, Security, Tech Lead và QA Lead approve.

## 11. Vòng Review bắt buộc sau triển khai

Sau Sprint 4 không được kết luận hoàn thành ngay. Phải:

1. Re-run full-stack audit.
2. Re-run UX/IA/role/workflow review.
3. Re-run WCAG 2.1 AA review.
4. Đối chiếu toàn bộ `C-01..C-06`, `H-01..H-11`, `M-01..M-15`, `L-01..L-12`, `UX-01..UX-14`, `A11Y-A1..A5`, `A11Y-B1..B8`.
5. Issue còn tồn tại phải tạo Task mới.
6. Lặp lại cho đến khi không còn Critical/High và không còn regression.

## 12. Definition of Production Ready

- Không còn Critical/High chưa xử lý hoặc chưa risk-accepted.
- 100% Acceptance Criteria đạt.
- 100% test gate pass trong môi trường sạch.
- Workflow được Product/Legal xác nhận.
- RBAC/API/DB/security có positive và negative tests.
- WCAG không còn blocker.
- Chart/table/export/map được đối soát.
- Backup/restore, monitoring, alerting, incident và rollback runbook hoàn tất.
- Full review vòng mới không phát hiện Issue đáng kể.

**Kết luận:** Hiện tại chỉ ở trạng thái `PLAN READY / SPECIFICATION GATE REQUIRED`; chưa được phép triển khai code hoặc đánh dấu Production Ready.
