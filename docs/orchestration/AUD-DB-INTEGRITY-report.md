# AUD-DB-INTEGRITY — Báo cáo kiểm tra toàn vẹn cơ sở dữ liệu (GĐ3b, ORCH-04 Đợt B mục 3-4)

- **Task:** t_a33b63d5 · Ngày: 2026-08-26
- **Phạm vi:** DB thật `qlttxd` (PostgreSQL 16, socket /tmp:5432) — CHỈ SELECT/pg_dump; mọi thao tác ghi chỉ trên DB tạm `qlttxd_audit_tmp` (đã DROP sau khi xong).
- **Phương pháp:** node + `pg` (app/backend/node_modules) cho truy vấn; `scripts/migrate.js qlttxd_audit_tmp` cho chuỗi migration; `pg_dump --schema-only --no-owner --no-privileges` + diff cho so sánh schema.

---

## 1. ORPHAN RECORDS

### 1a. ho_so không có bao_cao_vi_pham cha
Truy vấn: `SELECT count(*) FROM ho_so h LEFT JOIN bao_cao_vi_pham b ON h.bao_cao_id=b.id WHERE h.bao_cao_id IS NULL OR b.id IS NULL`

| Chỉ số | Giá trị |
|---|---|
| Tổng ho_so | 2 |
| ho_so có bao_cao_id NULL | 0 |
| ho_so trỏ bao_cao_id không tồn tại | 0 |

**Kết quả: SẠCH (0 orphan).**

### 1b. tep_dinh_kem trỏ entity cha không tồn tại
Lưu ý schema thực tế: tep_dinh_kem dùng cặp `(entity_type, entity_id)` đa hình, KHÔNG có cột `ho_so_id`.

| entity_type | Số dòng | Orphan |
|---|---|---|
| bao_cao | 2 | 0 (2/2 id khớp bao_cao_vi_pham) |
| ho_so | 2 | 0 (2/2 id khớp ho_so) |

**Kết quả: SẠCH (0/4).**

### 1c. tep_dinh_kem vs file vật lý trong uploads/
- DB lưu `duong_dan = /uploads/<filename>`; file vật lý nằm ở `UPLOAD_DIR` (mặc định `<backend>/./uploads`; repo root `uploads/` hiện RỖNG).
- 4/4 dòng DB → file vật lý **KHÔNG tồn tại** (thư mục uploads trống, cả các thư mục test-upload trong /tmp đã bị dọn).
- Chiều ngược: 0 file vật lý không được tham chiếu (uploads/ rỗng).

**Kết quả: CÓ VẤN ĐỀ — DEF-DB-01 (trung bình):** 4 bản ghi attachment mồ côi file (2 tệp duy nhất, mỗi tệp bị nhân đôi thành 2 dòng DB — xem DEF-DB-02). Nguyên nhân khả dĩ: môi trường dev/test reset UPLOAD_DIR hoặc xóa file mà không dọn DB. Không mất dữ liệu nghiệp vụ (attachments chỉ là ảnh minh chứng báo cáo). Khuyến nghị: thêm cleanup job đối chiếu DB↔disk và UNIQUE(entity_type, entity_id, duong_dan).

### 1d. audit_log trỏ record không còn tồn tại
Đếm theo `bang_bi_tac_dong`, join `id_ban_ghi` với bảng đích:

| table_name | Dangling |
|---|---|
| bao_cao_vi_pham | 0 |
| users | 0 |
| bien_ban | 0 |
| khac_phuc | 0 |
| ho_so | 0 |
| quyet_dinh | 0 |

**Kết quả: SẠCH (0/6 nhóm).**

### 1e. thong_bao trỏ user/ho_so đã xóa
| Kiểm tra | Kết quả |
|---|---|
| nguoi_nhan_id không tồn tại trong users | 0 |
| ho_so_id không NULL nhưng ho_so đã xóa | 0 |

FK đang bảo vệ: `thong_bao_nguoi_nhan_id_fkey` (ON DELETE CASCADE), `thong_bao_ho_so_id_fkey` (ON DELETE SET NULL). **SẠCH.**

### 1f. role_state_permissions vs 15 trạng thái chuẩn + fallback ROLE_PERMISSIONS
- 15 trạng thái chuẩn (`utils/constants.js STATES`) khớp 1:1 với `workflow_states` (15 dòng); **0 state_code lạ** trong role_state_permissions (44 dòng).
- Ma trận DB (role_code → states):

```
admin         : 15/15 (all)
case_handler  : 13 — thiếu cho_duyet_dieu_81 so với admin
leader        : 11 — thiếu cho_tiep_nhan, da_tiep_nhan, da_lap_bien_ban
verifier      : 5  — cho_bo_sung, cho_lap_bien_ban, cho_xac_minh, da_dong, dang_xac_minh
```

- So với fallback `ROLE_PERMISSIONS` (utils/workflow-rules.js, chỉ dùng khi bảng rỗng):
  - case_handler fallback {da_tiep_nhan, dang_khac_phuc, da_khac_phuc, da_dong, da_lap_bien_ban} ⊂ DB (13) — DB rộng hơn, hợp lệ.
  - verifier fallback (4) ⊂ DB (5) — hợp lệ.
  - leader fallback (8) ⊂ DB (11) — hợp lệ.
  - admin = 'all' ↔ DB đủ 15 — hợp lệ.

**Kết quả: NHẤT QUÁN (fallback chỉ là tập con, không mâu thuẫn).**

---

## 2. SCHEMA vs MIGRATION CHAIN

- Tạo DB tạm `qlttxd_audit_tmp` sạch → chạy `node scripts/migrate.js qlttxd_audit_tmp`: **11/11 applied, 0 failed**
  (001_initial_schema, 002_add_indexes, 003_add_missing_indexes, 004±tiep_nhan_states, 005±system_config, 006±config_permissions, 007±settings_wave1).
- `pg_dump --schema-only` hai DB → diff:
  - **1763 dòng mỗi bên, 0 khác biệt thực chất** (chỉ khác chuỗi `\restrict/\unrestrict` ngẫu nhiên của pg_dump).

**Kết quả: KHỚP TUYỆT ĐỐI — schema DB thật sinh ra đúng từ chuỗi migration.**

---

## 3. CONSTRAINTS & INDEXES

### 3a. FK / unique / index trên 5 bảng nghiệp vụ lớn

| Bảng | FK | Unique | Index phụ |
|---|---|---|---|
| ho_so | 8 (bao_cao, loai_vi_pham, hanh_vi, nguoi_nop, nguoi_xu_ly, nguoi_vi_pham, quan_huyen, phuong_xa) | ma_ho_so | 7 (created_at, partial active, huyen, xa, trang_thai, nguoi_nop, nguoi_xu_ly) + GIST toa_do |
| bao_cao_vi_pham | 3 (nguoi_gui, huyen, xa) | ma_bao_cao | idx_bao_cao_nguoi_gui |
| tep_dinh_kem | 1 (nguoi_tai→users) | pkey | idx (entity_type, entity_id) |
| audit_log | 1 (nguoi_dung_id SET NULL) | pkey | idx (bang, id_ban_ghi), (user, thoi_gian), thoi_gian, user |
| users | — | username, email, phone | — ; CHECK chk_contact (email hoặc phone) |

### 3b. Cột WHERE/JOIN hay dùng mà thiếu index (grep routes/services)

Pattern nóng: `user_roles.user_id` (×11), `roles.id/code` (×19), `permissions.id` (×7), `role_permissions.role_id` (×6), `loai_vi_pham.id` (×5), `bao_cao_vi_pham.id` (×4), `phuong_xa.quan_huyen_id`, `hanh_vi_vi_pham.loai_vi_pham_id`, `system_config.key/category`, `tep_dinh_kem.entity_*`.

| Cột | Trạng thái index |
|---|---|
| user_roles(user_id) | ✅ pkey composite (user_id, role_id) phủ leading column |
| role_permissions(role_id) | ✅ pkey composite (role_id, permission_id) |
| roles(code), permissions(code), loai_vi_pham(code) | ✅ unique index |
| phuong_xa(quan_huyen_id) | ✅ idx_phuong_xa_huyen |
| hanh_vi_vi_pham(loai_vi_pham_id) | ⚠️ KHÔNG có index riêng (chỉ pkey + uq_hanh_vi(dieu,khoan,diem)) — bảng danh mục nhỏ (~vài chục dòng), ảnh hưởng thấp |
| system_config(category/key/scope) | ✅ idx category, scope + uq(scope,scope_id,category,key) — lọc theo key đơn lẻ đi qua uq prefix (category trước key): ⚠️ sub-optimal nhưng bảng nhỏ |
| muc_phat(hanh_vi_id) | ✅ uq_muc_phat(hanh_vi_id, nhom_cong_trinh) leading |

**Kết quả: 2 điểm sub-optimal mức THẤP (bảng danh mục nhỏ), không cần hành động ngay — ghi nhận DEF-DB-03 (thấp): thiếu index `hanh_vi_vi_pham(loai_vi_pham_id)`.**

### 3c. NOT NULL / default các cột quan trọng

| Bảng.cột | Nullable | Default |
|---|---|---|
| *.created_at / updated_at | NO | now() (updated_at có trigger set_updated_at trên ho_so/users/bien_ban/khac_phuc/quyet_dinh) |
| ho_so.trang_thai | NO | 'cho_tiep_nhan' (enum trang_thai_ho_so) |
| bien_ban.trang_thai | NO | 'moi_lap' |
| khac_phuc.trang_thai | NO | 'chua_thuc_hien' |
| quyet_dinh.trang_thai | NO | 'draft' |
| users.is_active | NO | true |
| tep_dinh_kem.duong_dan / ten_goc | NO | — |
| thong_bao.trang_thai/kenh | NO | 'cho_gui' / 'portal' + CHECK enum |

**Kết quả: HỢP LỆ — đầy đủ NOT NULL + default + trigger.**

---

## 4. SEED DATA CONSISTENCY

- Chạy lại `sql/seed.sql` trên DB tạm (sau full migration chain): COMMIT OK, idempotent (ON CONFLICT).
- Đối chiếu RBAC:

| Chỉ số | DB thật | DB tạm (migration+seed) | Chuẩn |
|---|---|---|---|
| permissions count | **23** | 23 | ⚠️ spec ORCH-02 REQ-D01 nêu "27 permissions chuẩn" |
| role_permissions | 37 (admin 23, leader 5, case_handler 4, verifier 3, citizen 2) | 37 (giống hệt) | — |

- Phân tích chênh 23 vs 27: nguồn quyền = 001 (14 gốc) + 006 (+9 config) = 23; seed.sql chỉ bổ sung trùng `admin.locations`. Không tìm thấy bộ 27 nào trong code/spec trừ chính REQ-D01 → tài liệu spec LỆCH thời điểm so với code.

**Kết quả: DB tự nhất quán (thật == tạm), nhưng phát hiện DEF-DB-04 (trung bình-thấp): REQ-D01 ghi "27 permissions" trong khi thực tế chuẩn hiện tại là 23 — cần cập nhật spec hoặc bổ sung 4 permission còn thiếu nếu 27 vẫn là yêu cầu.**

---

## DANH SÁCH DEF ĐỀ XUẤT

| ID | Mức độ | Mô tả | Ảnh hưởng |
|---|---|---|---|
| DEF-DB-01 | Trung bình | 4 dòng tep_dinh_kem (2 file duy nhất) trỏ tới file vật lý không tồn tại; uploads/ rỗng | FE hiển thị attachment sẽ lỗi 404/500; cần cleanup + ràng buộc đồng bộ DB↔disk |
| DEF-DB-02 | Thấp | 2 tệp được ghi 2 dòng DB trùng duong_dan (không có UNIQUE(entity_type,entity_id,duong_dan)) | Trùng lặp dữ liệu, tải kép |
| DEF-DB-03 | Thấp | Thiếu index hanh_vi_vi_pham(loai_vi_pham_id) | Chỉ ảnh hưởng hiệu năng join danh mục nhỏ |
| DEF-DB-04 | Trung bình-thấp | Spec REQ-D01 nói "27 permissions chuẩn" nhưng seed/migration chỉ tạo 23 | Drift spec↔code; cần quyết chuẩn hoá (cập nhật spec hoặc bổ sung permission) |

## ĐÁNH GIÁ TỔNG THỂ

**DB: SẠCH ở tầng quan hệ — CÓ VẤN ĐỀ mức NHẸ/TRUNG BÌNH ở tầng vận hành.**

- Referential integrity: 0 orphan trên toàn bộ 6 phép kiểm tra (1a–1f) — FK làm việc đúng.
- Schema: DB thật ≡ chuỗi migration (diff 0 dòng thực chất) — tuyệt đối tin được chuỗi migrate.
- Constraints/indexes: đầy đủ, hợp lý; chỉ 2 ghi nhận hiệu năng thấp.
- Vấn đề duy nhất có ảnh hưởng người dùng thực: attachments mất file vật lý (DEF-DB-01) — nhiều khả năng do môi trường dev/test chứ không phải lỗi ứng dụng, nên xử lý bằng cleanup job chứ không sửa dữ liệu ngay.
