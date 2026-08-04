# Template nghiệm thu task QLTTXD

> Sử dụng template này cho MỌI task QLTTXD. Coder/worker điền đầy đủ trước
> khi chuyển review-required. Reviewer xác nhận từng mục trước khi complete.
> Cập nhật: 2026-08-02 (P0.1 remediation v2).

---

## Thông tin task

| Trường           | Giá trị |
|-------------------|---------|
| Task ID           |         |
| Tiêu đề           |         |
| Assignee (profile)|         |
| Skill bắt buộc    |         |
| Workspace         |         |
| Dependencies      |         |

---

## 1. Acceptance Criteria

Liệt kê rõ ràng, kiểm tra được. Dạng Given/When/Then khi có thể.

| # | Tiêu chí                                              | Đạt? | Bằng chứng |
|---|-------------------------------------------------------|------|------------|
| 1 |                                                       |      |            |
| 2 |                                                       |      |            |
| 3 |                                                       |      |            |

---

## 2. Files Changed

| File                        | Loại thay đổi (new/modify/delete) | Mô tả ngắn |
|-----------------------------|-----------------------------------|-------------|
|                             |                                   |             |

---

## 3. Tests & Evidence

### 3.1 Test commands đã chạy

```sh
# Liệt kê lệnh và kết quả
```

### 3.2 Kết quả test

| Test case          | Kết quả | Ghi chú |
|--------------------|---------|---------|
|                    |         |         |

### 3.3 Evidence runtime (BẮT BUỘC cho code tasks)

- [ ] Backend: `/health` trả 200
- [ ] Backend: login trả JWT
- [ ] Backend: protected endpoint không token trả 401
- [ ] Backend: protected endpoint có token trả 200
- [ ] Backend: thiếu quyền trả 403
- [ ] Frontend: `npm run build` PASS
- [ ] Frontend: render thực tế không có pageerror
- [ ] Database: schema chạy sạch trên DB rỗng
- [ ] E2E: flow chính (login → ... → thống kê) PASS

---

## 4. Reviewer Approval — Gate-by-gate evidence

Bảng này trace đúng **14 bước** trong quality gate loop (xem `08-quality-gate-process.md`).
Reviewer PHẢI đánh dấu từng gate đã đạt; nếu chưa chạy, ghi "chưa chạy" vào cột Bằng chứng.

### 4.1 Gate evidence (reviewer điền từng mục)

| # | Quality Gate                          | Đạt? | Bằng chứng (lệnh, output, screenshot) | Actor đã thực hiện |
|---|---------------------------------------|------|----------------------------------------|---------------------|
| 1 | Requirements/specify                  |      |                                        | Researcher/writer   |
| 2 | Architecture                          |      |                                        | Researcher/writer   |
| 3 | Task/dependencies                     |      |                                        | Orchestrator        |
| 4 | Implementation                        |      |                                        | Coder               |
| 5 | Self-test                             |      |                                        | Coder               |
| 6 | Review-required (coder tự chuyển)     |      |                                        | Coder               |
| 7 | Independent review                    |      |                                        | Reviewer            |
| 8 | Fixes (nếu có)                        |      |                                        | Coder               |
| 9 | Review-required (sau fix)             |      |                                        | Coder               |
| 10| Independent re-review (sau fix)       |      |                                        | Reviewer            |
| 11| Regression                            |      |                                        | Coder               |
| 12| Security/perf/a11y check              |      |                                        | Security/QA         |
| 13| Verified                              |      |                                        | Reviewer            |
| 14| Complete                              |      |                                        | Orchestrator/reviewer |
| 15| Docs/handoff                          |      |                                        | Writer/coder        |

> **Lưu ý**: Nếu chưa chạy test/runtime trong task này, KHÔNG đánh dấu "Đạt"
> cho các gate liên quan (self-test, regression, verified). Ghi rõ "chưa chạy"
> vào cột Bằng chứng.

### 4.2 Reviewer checklist

| Mục                              | Reviewer xác nhận | Ghi chú |
|----------------------------------|-------------------|---------|
| Code review (diff sạch, logic đúng)|                   |         |
| Test chạy lại thành công          |                   |         |
| Runtime smoke pass                |                   |         |
| Không có secret/password trong code|                  |         |
| Accessibility cơ bản đạt          |                   |         |
| Docs cập nhật (nếu cần)          |                   |         |
| Post-fix loop đúng (review-required → independent review → regression) | | |

**Reviewer**: _________________  
**Ngày**: _________________  
**Kết luận**: [ ] PASS  [ ] FAIL (ghi lý do bên dưới)

---

## 5. Known Risks

| Rủi ro                                  | Mức độ (low/med/high) | Mitigation |
|-----------------------------------------|----------------------|------------|
| Boundary seed hình chữ nhật giả lập     | high                 | Thay GADM/OSM khi production |
| COUNT+1 sequence không chịu concurrent   | high                 | Dùng sequence/counter khi production |
| Password demo trong seed         | high                 | Không dùng ở production; mật khẩu thay đổi sau đăng nhập đầu |
| Tile map OSM có thể 403 offline         | low                  | Tách lỗi tile khỏi lỗi React |

---

## 6. Rollback & Handoff

### Rollback plan
- Git revert commit: _________________
- Restore file từ backup: _________________
- Database rollback: _________________

### Handoff notes
- Task tiếp theo: _________________
- Dependency đã gỡ: _________________
- Docs đã cập nhật: _________________

---

## 7. Checklist cuối (coder tự kiểm tra trước khi chuyển review)

- [ ] Code hoàn tất, không TODO lớn còn lại
- [ ] Test chạy PASS (ghi lệnh + output)
- [ ] Smoke check runtime (nếu là code task)
- [ ] Files changed đã ghi ở mục 2
- [ ] Known risks đã ghi ở mục 5
- [ ] Chuyển task sang `review-required` bằng `kanban_block(kind="dependency", reason="review-required: ...")`

## 8. Checklist reviewer (trước khi complete)

- [ ] Đọc diff/file changed
- [ ] Chạy lại test độc lập
- [ ] Kiểm tra runtime (nếu là code task)
- [ ] Xác nhận acceptance criteria đạt
- [ ] Ghi evidence vào task comment
- [ ] Nếu có fix: xác nhận post-fix loop (review-required → independent review → regression)
- [ ] Unblock/complete task
