# Checklist: thêm / chỉnh sửa trạng thái hồ sơ (workflow states)

## Mục đích

Trạng thái hồ sơ được định nghĩa **đồng bộ ở 3 nơi** (DB, backend, frontend) cộng với
ma trận phân quyền. Khi thêm hoặc sửa một trạng thái mà chỉ sửa 1 nơi, hệ thống sẽ
lệch: backend chặn transition, frontend hiển thị fallback "Không rõ", phân quyền bị
thiếu. Đây là hardcode report mục **HC-05** — xem chi tiết tại
`docs/settings-center/03-hardcode-report.md` (mục HC-05).

## Checklist bắt buộc (làm theo thứ tự)

1. **Migration SQL mới** — tạo file migration mới (KHÔNG sửa migration cũ đã chạy):
   - Cập nhật enum trạng thái (cột `trang_thai` / kiểu enum tương ứng).
   - Seed bản ghi mới vào bảng `workflow_states` (kèm nhãn hiển thị, thứ tự).
2. **Backend constants** — `app/backend/utils/constants.js`:
   - Thêm/sửa trong `STATES`, `STATE_LABELS`, và `TRANSITIONS`
     (transition nào cho phép đi vào/ra trạng thái mới).
3. **Frontend fallback** — `app/frontend/src/lib/constants.js`:
   - Đồng bộ fallback constants để UI không hiển thị "Không rõ" khi API chưa có
     dữ liệu `workflow_states`.
4. **Ma trận phân quyền** — kiểm tra bảng/seed `role_state_permissions`:
   - Mỗi role cần phải được gán quyền phù hợp với trạng thái mới
     (xem/xử lý/chuyển tiếp). Thiếu dòng ở đây = role đó không thao tác được.
5. **Chạy full test**:
   - Backend: `node --test --test-concurrency=1` (từ `app/backend`).
   - Frontend: `npx vitest run` + `npm run build` (từ `app/frontend`).

## Lưu ý

- Không bao giờ sửa trực tiếp migration đã được áp dụng trên môi trường thật —
  luôn tạo migration mới.
- Sau khi hoàn tất, cập nhật CHANGELOG nếu hành vi chuyển trạng thái thay đổi.
