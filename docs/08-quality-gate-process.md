# Quy trình Quality Gate bắt buộc cho QLTTXD

> Tài liệu này quy định quy trình trạng thái Kanban, phân công vai trò,
> cách ly workspace và tiêu chí nghiệm thu cho mọi task phát triển QLTTXD.
> Cập nhật: 2026-08-02 (P0.1 remediation v2).

---

## 1. Chuỗi trạng thái Kanban — 14 bước (bắt buộc)

Mọi task QLTTXD phải đi qua **14 trạng thái** theo đúng thứ tự:

```
requirements/specify
    ↓
architecture
    ↓
task/dependencies
    ↓
implementation
    ↓
self-test
    ↓
review-required        ← coder/worker TỰ chuyển khi xong
    ↓
independent-review     ← reviewer ĐỘC LẬP kiểm tra
    ↓
fixes                  ← (nếu reviewer yêu cầu sửa)
    ↓
review-required        ← (coder sửa xong → quay lại review; BẮT BUỘC)
    ↓
independent-review     ← (reviewer re-review; không được bỏ qua)
    ↓
regression             ← (chạy lại test sau khi reviewer PASS)
    ↓
security/performance/accessibility check
    ↓
verified
    ↓
complete
    ↓
docs/handoff
```

**Quy tắc bất biến**: Sau khi `fixes`, task PHẢI quay lại `review-required` →
`independent-review`. Không được nhảy thẳng từ `fixes` sang `regression`.

### Quy tắc chuyển trạng thái

| Từ trạng thái            | Điều kiện chuyển tiếp                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| requirements/specify     | BRIEF, pháp lý, nghiệp vụ đã đọc; acceptance criteria rõ ràng          |
| architecture             | Kiến trúc, schema, API contract đã xác định; dependency liệt kê        |
| task/dependencies        | Task Kanban đã tạo với assignee, skill, workspace rõ ràng              |
| implementation           | Code/file thay đổi hoàn tất; không có TODO lớn còn lại                 |
| self-test                | Coder chạy test + smoke thành công; ghi kết quả vào task comment       |
| review-required (lần 1)  | **Bắt buộc**: coder TỰ chuyển; ghi files changed, test output, rủi ro  |
| independent-review       | Reviewer ĐỘC LẬP (không phải người viết code) đọc diff, chạy test      |
| fixes                    | Reviewer ghi rõ vấn đề; coder sửa; quay lại review-required            |
| review-required (lần 2+) | Coder sửa xong → comment fix details → block lại cho re-review         |
| independent-review (re)  | Reviewer re-review; nếu PASS → regression; nếu FAIL → fixes tiếp       |
| regression               | Chạy lại toàn bộ test sau khi reviewer xác nhận PASS; không regression |
| security/perf/a11y check | Kiểm tra RBAC, injection, upload, accessibility theo ma trận bên dưới  |
| verified                 | Reviewer xác nhận đạt; ghi evidence vào task comment                   |
| complete                 | Orchestrator hoặc reviewer ghi nhận; cập nhật docs                     |
| docs/handoff             | Cập nhật 07-huong-dan-van-hanh.md, TEST-RESULT.md, README nếu cần      |

### 1.1 Vòng lặp post-fix duy nhất (bắt buộc)

Khi reviewer yêu cầu sửa (`fixes`), coder PHẢI quay lại toàn bộ quy trình
từ `review-required` trở đi:

```
fixes (coder sửa)
    ↓
review-required         ← coder block lại cho re-review (BẮT BUỘC)
    ↓
independent-review      ← reviewer re-review (KHÔNG ĐƯỢC BỎ QUA)
    ↓
    ├─ PASS → regression → security/perf/a11y → verified → complete
    └─ CHANGES_REQUESTED → fixes → (quay lại review-required)
```

**Không được bỏ qua review-required + independent-review sau fix.**
Nếu reviewer PASS, mới được chuyển sang regression.
Nếu reviewer CHANGES_REQUESTED, quay lại fixes.

Nếu fix chỉ sửa docs/template (không sửa code), regression = kiểm tra lại
diff, headings, password scan và acceptance criteria.

### 1.2 Mapping Quality Gate ↔ Kanban native actions

Bảng dưới đây dùng đúng các Kanban CLI hiện có:

- `kanban_block(kind, reason)` — các kind hợp lệ: `dependency`, `needs_input`, `capability`, `transient`
- `kanban_comment(body)` — ghi evidence, ghi chú
- `kanban_complete(summary, metadata, artifacts)` — đánh dấu hoàn tất
- `kanban_create(title, assignee, ...)` — tạo task mới

| Quality Gate             | Kanban native action                                                                              | Actor/Profile         | Điều kiện                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| Requirements & specify   | `todo` → `running` (worker bắt đầu)                                                               | Orchestrator/coder    | BRIEF, acceptance criteria sẵn sàng                         |
| Architecture review      | `kanban_comment` (kiến trúc, schema, dependency)                                                  | Researcher/writer     | Output tiếng Việt có heading, bảng, assumptions/limitations |
| Task decomposition       | `kanban_create` (assignee, skill, workspace)                                                      | Orchestrator          | Dependency graph rõ ràng                                    |
| Implementation           | `running` (code/file thay đổi)                                                                    | Coder                 | Không có TODO lớn còn lại                                   |
| Self-test                | `kanban_comment` (test commands + output)                                                         | Coder                 | Test PASS, smoke PASS                                       |
| Review-required (lần 1)  | `kanban_block(kind="dependency", reason="review-required: ...")`                                  | Coder                 | Files changed, test output, rủi ro đã ghi                   |
| Independent review       | Reviewer đọc diff, chạy test, kiểm tra runtime                                                    | Reviewer              | Reviewer ≠ coder                                            |
| Fixes                    | Reviewer `kanban_comment` (vấn đề) → coder sửa                                                    | Reviewer + Coder      | Vấn đề rõ ràng, có thể fix                                  |
| Re-review (sau fix)      | Coder `kanban_comment` (fix details) → `kanban_block(kind="dependency", reason="re-review: ...")` | Coder                 | Fix đã hoàn tất                                             |
| Independent re-review    | Reviewer re-review diff + test                                                                    | Reviewer              | PASS → regression; FAIL → fixes tiếp                        |
| Regression               | `kanban_comment` (chạy lại test, không regression mới)                                            | Coder                 | Reviewer đã PASS trước đó                                   |
| Security/perf/a11y check | `kanban_comment` (ma trận RBAC, injection, a11y)                                                  | Security/QA reviewer  | Ma trận đầy đủ                                              |
| Verified                 | `kanban_comment` (reviewer xác nhận đạt + evidence)                                               | Reviewer              | Regression PASS, security/perf/a11y PASS                    |
| Complete                 | `kanban_complete(summary, metadata, artifacts)`                                                   | Orchestrator/reviewer | Reviewer approval + toàn bộ evidence                        |
| Docs/handoff             | Cập nhật 07, TEST-RESULT.md, README                                                               | Writer/coder          | Docs đã cập nhật                                            |

### 1.3 Quy tắc `kanban_block` kind

| Tình huống                             | Kind          | Ví dụ reason                                   |
| -------------------------------------- | ------------- | ---------------------------------------------- |
| Coder chờ reviewer review              | `dependency`  | `review-required: files changed + test output` |
| Coder chờ reviewer re-review (sau fix) | `dependency`  | `re-review: fixed issue X, re-ran tests`       |
| Worker cần input từ người              | `needs_input` | `needs credentials for deployment`             |
| Worker thiếu capability                | `capability`  | `no access to production DB`                   |
| Lỗi tạm thời có thể tự resolve         | `transient`   | `npm install timeout, will retry`              |

**Không dùng kind không có trong danh sách trên.**

---

## 2. Phân công vai trò và skill bắt buộc

Mỗi task Kanban PHẢI ghi rõ:

- **assignee**: tên profile thực hiện (coder, researcher, writer, reviewer)
- **skill**: skill bắt buộc mà assignee phải load trước khi làm việc

### Quy tắc workspace

- **Không cho hai agent cùng ghi workspace chính (`/workspace/ssd/qlttxd/app/`) song song.**
- Frontend và backend có thể chạy song song nếu chỉ đọc, nhưng khi sửa code phải có task riêng.
- Database migration luôn là task riêng, không chạy song song với backend code change.
- Mỗi coder task nên dùng `workspace_kind: dir` hoặc `workspace_kind: worktree` để cách ly.

### Quy tắc review

- **Coder/worker**: sau khi implementation + self-test xong, PHẢI tự chuyển task sang `review-required` bằng cách:
  1. Comment files changed, test commands & output, known risks
  2. Dùng `kanban_block(kind="dependency", reason="review-required: ...")`
- **Reviewer độc lập**: PHẢI đọc diff, chạy test thực tế, kiểm tra runtime trước khi unblock/complete
- **Không complete task chỉ dựa vào build PASS** nếu lỗi là runtime
- **Reviewer không được là người viết code trong cùng task**
- **Sau khi fix, coder PHẢI dùng `kanban_block(kind="dependency", reason="re-review: ...")`** để reviewer re-review trước khi regression

---

## 3. Ma trận Role → Skill → Loại kiểm tra

| Role               | Skill bắt buộc              | Loại kiểm tra chính                                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------- |
| **Researcher**     | qlttxd-legal-research       | Nguồn trích dẫn, bảng hành vi vi phạm, khung phạt, assumptions/limitations            |
| **Writer/Product** | qlttxd-product-spec         | Use case coverage, acceptance criteria Given/When/Then, API/data contract consistency |
| **Frontend**       | qlttxd-frontend-ui          | npm run build, Playwright render, viewport mobile/desktop, keyboard a11y, WCAG AA     |
| **Backend**        | qlttxd-backend-api          | node --test, smoke /health + login + protected 401/403, state machine, audit log      |
| **Database**       | qlttxd-postgis-database     | Schema chạy sạch trên DB rỗng, FK, GiST index, ST_Contains, migration rollback        |
| **QA/E2E**         | qlttxd-qa-e2e               | Login → báo cáo → hồ sơ → biên bản → quyết định → khắc phục → thống kê (10 bước)      |
| **Security/RBAC**  | qlttxd-security-rbac        | Auth matrix 200/401/403, IDOR, upload malicious, secret scan, audit completeness      |
| **Deployment**     | qlttxd-fullstack-deployment | Smoke full-stack, process management, port check, backup/restore, docs update         |
| **Orchestrator**   | qlttxd-orchestration        | Task decomposition, dependency graph, workspace isolation, review enforcement         |

---

## 4. Checklist cho từng loại task

### 4.1 Research/Legal task

- [ ] Đọc toàn bộ tài liệu trong `taplieu/` liên quan
- [ ] Trích điều/khoản/điểm cụ thể
- [ ] Bảng hành vi vi phạm + khung phạt + biện pháp khắc phục
- [ ] Đánh dấu nội dung cần chuyên gia xác nhận
- [ ] Output tiếng Việt có heading, bảng, assumptions/limitations

### 4.2 Product Spec task

- [ ] Actors/RBAC rõ ràng
- [ ] Use cases với happy/error/alternate paths
- [ ] Acceptance criteria Given/When/Then
- [ ] API contract nhất quán với schema
- [ ] Tách MVP khỏi phase sau

### 4.3 Backend task

- [ ] Route + actor + permission + input/output contract
- [ ] Validate boundary ở server
- [ ] Parameterized SQL, transaction cho multi-write
- [ ] State machine validate chuyển trạng thái
- [ ] Audit log cho mọi thay đổi dữ liệu
- [ ] node --test PASS
- [ ] Smoke: /health, login 200+JWT, protected 401/403

### 4.4 Frontend task

- [ ] Semantic HTML, label cho input, button có tên
- [ ] Mobile-first responsive
- [ ] Focus-visible, keyboard navigation
- [ ] Loading/empty/error/success states
- [ ] npm run build PASS
- [ ] Playwright render thực tế (nếu có)
- [ ] Không dùng màu làm tín hiệu duy nhất

### 4.5 Database task

- [ ] Migration idempotent hoặc có rollback
- [ ] Spatial column SRID rõ ràng + GiST index
- [ ] Seed tách khỏi schema, deterministic
- [ ] setup-db.sh cảnh báo xóa dữ liệu
- [ ] Kiểm tra số bảng, FK, extension PostGIS

### 4.6 QA/E2E task

- [ ] Baseline: ports, process, database, commit state
- [ ] Health smoke: PostgreSQL, backend /health, frontend HTTP 200
- [ ] Auth matrix: login đúng/sai, token thiếu/hỏng/hết hạn
- [ ] RBAC matrix: 5 roles × permissions
- [ ] E2E 10 bước đầy đủ
- [ ] UI browser check: no pageerror, root mounted, text hiện diện

### 4.7 Security task

- [ ] Trust boundary diagram
- [ ] JWT config, expiry, password hash, CORS
- [ ] IDOR check cho từng route
- [ ] Upload malicious filename/type/size
- [ ] Secret scan trong source/log/docs
- [ ] Audit completeness

### 4.8 Deployment task

- [ ] Smoke full-stack: DB + backend + frontend
- [ ] Process management (kill old process)
- [ ] Port conflict check
- [ ] Backup trước migration
- [ ] Docs update (07-huong-dan-van-hanh.md)

---

## 5. Nguyên tắc bất biến

1. **Không sửa application code, schema hoặc runtime data trong task orchestration/quality gate.**
2. **Không complete task thiếu review độc lập.**
3. **Không cho hai coder ghi cùng file chính song song.**
4. **Không coi build PASS là bằng chứng runtime PASS.**
5. **Không đưa secret, password demo hoặc JWT vào docs/task/skill.**
6. **Mọi task phải có acceptance criteria rõ ràng trước khi bắt đầu implementation.**
7. **Reviewer phải là profile khác với coder/worker thực hiện.**
8. **Sau fix, PHẢI quay lại review-required → independent review; không nhảy thẳng regression.**

---

## 6. Rollback và handoff

- Khi task fail: giữ trạng thái hiện tại, ghi rõ nguyên nhân vào comment
- Rollback: dùng git revert hoặc restore file từ backup
- Handoff: cập nhật docs, ghi files changed, known risks và next steps
- Blocked task: ghi rõ nguyên nhân và next action để người tiếp theo có thể tiếp tục
