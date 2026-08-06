# Thiết kế cơ sở dữ liệu QLTTXD

> Tài liệu thiết kế lược đồ cơ sở dữ liệu cho Hệ thống Quản lý Trật tự Xây dựng
> (QLTTXD), dựa trên Bản đặc tả nghiệp vụ (`docs/03-dac-ta-nghiep-vu.md`) và
> phân tích pháp lý Nghị định 16/2022/NĐ-CP (`docs/01-phan-tich-phap-ly.md`).
> File lược đồ thực thi tương ứng: `sql/schema.sql`.

---

## 1. Tổng quan kiến trúc dữ liệu

Hệ thống sử dụng **PostgreSQL 16** làm cơ sở dữ liệu quan hệ chính và **PostGIS**
để quản lý toàn bộ dữ liệu không gian (vị trí điểm vi phạm, ranh giới đơn vị hành
chính). Lược đồ được tổ chức theo **6 cụm (module)** logic, mỗi cụm gồm các bảng
có liên quan chặt chẽ với nhau:

| #   | Cụm                               | Bảng                                                                               | Mục đích                                                              |
| --- | --------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Nhận dạng & phân quyền (RBAC)** | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`                  | Tài khoản người dùng và kiểm soát truy cập dựa trên vai trò           |
| 2   | **Đơn vị hành chính (GIS)**       | `quan_huyen`, `phuong_xa`                                                          | Ranh giới hành chính dạng đa giác phục vụ tra cứu vị trí              |
| 3   | **Danh mục pháp lý**              | `loai_vi_pham`, `hanh_vi_vi_pham`, `muc_phat`                                      | Nhóm hành vi, hành vi cụ thể và khung mức phạt theo Điều 16 NĐ16/2022 |
| 4   | **Hồ sơ xử lý**                   | `bao_cao_vi_pham`, `ho_so`, `nguoi_vi_pham`, `bien_ban`, `quyet_dinh`, `khac_phuc` | Toàn bộ vòng đời một vụ việc vi phạm                                  |
| 5   | **Giao tiếp & lưu trữ**           | `thong_bao`, `tep_dinh_kem`                                                        | Thông báo cho người dân/cán bộ và tệp đính kèm (ảnh, văn bản)         |
| 6   | **Kiểm toán**                     | `audit_log`                                                                        | Nhật ký mọi thao tác quan trọng để truy vết                           |

### 1.1 Sơ đồ ERD dạng văn bản

```
                                  ┌──────────┐
                  ┌───────────────│  roles   │
                  │               └────┬─────┘
              ┌───┴────┐         ┌──────┴─────────┐
              │users   │  N:N    │role_permissions│
              └───┬────┘         └──────┬─────────┘
                  │                     │
              ┌───┴────┐           ┌────┴─────┐
              │user_roles           permissions
              └────────┘

   ┌──────────────┐ 1      N ┌────────────────┐
   │  quan_huyen  │──────────│   phuong_xa    │
   └──────────────┘          └────────────────┘

   ┌─────────────────┐ 1   N ┌──────────────────┐ 1   N ┌──────────┐
   │  loai_vi_pham   │───────│ hanh_vi_vi_pham  │───────│ muc_phat │
   └─────────────────┘       └──────────────────┘       └──────────┘

   ┌───────────────────┐     ┌───────────────────┐
   │bao_cao_vi_pham    │────→│      ho_so        │────→┌─────────────┐
   │  (người dân gửi)  │     │  (vụ việc)        │     │nguoi_vi_pham│
   └───────────────────┘     └───┬───────────┬───┘     └─────────────┘
                                 │           │
                    ┌────────────┴───┐  ┌────┴─────────────┐
                    │    bien_ban    │  │   quyet_dinh     │
                    └───────┬────────┘  └───────┬──────────┘
                            └───────────────────┘
                                 │
                          ┌──────┴───────┐
                          │  khac_phuc   │
                          └──────────────┘

   Các thực thể phụ:  thong_bao (liên kết nguoi_dung + ho_so)
                      tep_dinh_kem (đa hình, liên kết entity_type + entity_id)
                      audit_log (đa mục đích, liên kết mọi bảng quan trọng)
```

Quy tắc đặt tên: tên bảng viết thường, dùng dấu gạch dưới; khóa chính luôn là
`id UUID` (sinh tự động bằng `gen_random_uuid()`); cột khóa ngoại mang hậu tố
`_id`; cột thời gian là `timestamptz` (lưu UTC, hiển thị theo múi giờ máy khách);
các bảng chính có `created_at`/`updated_at` do trigger `set_updated_at()` tự động
cập nhật. Vì hệ thống phục vụ chính quyền địa phương, mọi bảng nghiệp vụ đều có
trường `ma_...` (mã hồ sơ, mã biên bản, mã quyết định) để in lên văn bản hành chính.

---

## 2. Danh sách bảng và mô tả

| Bảng               | Mô tả ngắn                                                 | Liên kết chính               |
| ------------------ | ---------------------------------------------------------- | ---------------------------- |
| `users`            | Người dùng hệ thống (công dân, cán bộ, lãnh đạo, quản trị) | → `user_roles`               |
| `roles`            | Vai trò (citizen, case_handler, verifier, leader, admin)   | → `role_permissions`         |
| `permissions`      | Quyền hạn cụ thể theo module/hành động                     | ← `role_permissions`         |
| `user_roles`       | Gán vai trò cho người dùng (N:N)                           | `users`, `roles`             |
| `role_permissions` | Gán quyền cho vai trò (N:N)                                | `roles`, `permissions`       |
| `quan_huyen`       | Quận/huyện, kèm ranh giới đa giác (GIS)                    | → `phuong_xa`                |
| `phuong_xa`        | Phường/xã, kèm ranh giới đa giác (GIS)                     | `quan_huyen`                 |
| `loai_vi_pham`     | Nhóm hành vi vi phạm (4 nhóm)                              | → `hanh_vi_vi_pham`          |
| `hanh_vi_vi_pham`  | Hành vi vi phạm cụ thể (khoản 1–13 Điều 16 NĐ16/2022)      | `loai_vi_pham`, → `muc_phat` |
| `muc_phat`         | Khung mức phạt theo nhóm công trình (1/2/3)                | `hanh_vi_vi_pham`            |
| `bao_cao_vi_pham`  | Báo cáo vi phạm do người dân gửi (kèm tọa độ GIS)          | → `ho_so`                    |
| `ho_so`            | Hồ sơ xử lý vụ việc — bảng trung tâm, có state machine     | nhiều bảng                   |
| `nguoi_vi_pham`    | Chủ thể bị xử lý (cá nhân/tổ chức)                         | ← `ho_so`, `bien_ban`        |
| `bien_ban`         | Biên bản vi phạm hành chính                                | `ho_so`, `nguoi_vi_pham`     |
| `quyet_dinh`       | Quyết định xử phạt                                         | `ho_so`, `bien_ban`          |
| `khac_phuc`        | Theo dõi biện pháp khắc phục hậu quả                       | `ho_so`, `quyet_dinh`        |
| `thong_bao`        | Thông báo cho người dân/cán bộ                             | `users`, `ho_so`             |
| `tep_dinh_kem`     | Tệp đính kèm (ảnh chứng cứ, văn bản scan) — đa hình        | bất kỳ thực thể              |
| `audit_log`        | Nhật ký kiểm toán mọi thao tác                             | bất kỳ thực thể              |

---

## 3. Chi tiết từng bảng

### 3.1 Cụm RBAC

**Bảng `users`**

| Cột                         | Kiểu dữ liệu   | Khóa/Ràng buộc                  | Ghi chú                       |
| --------------------------- | -------------- | ------------------------------- | ----------------------------- |
| `id`                        | `UUID`         | PK, default `gen_random_uuid()` | Khóa chính                    |
| `username`                  | `CITEXT`       | UNIQUE, NOT NULL                | Không phân biệt hoa thường    |
| `email`                     | `CITEXT`       | UNIQUE                          |                               |
| `phone`                     | `VARCHAR(20)`  | UNIQUE                          |                               |
| `full_name`                 | `VARCHAR(200)` | NOT NULL                        |                               |
| `password_hash`             | `TEXT`         | NOT NULL                        | Băm argon2id/bcrypt           |
| `is_active`                 | `BOOLEAN`      | NOT NULL, default TRUE          | Khóa tài khoản                |
| `last_login_at`             | `TIMESTAMPTZ`  |                                 | Lần đăng nhập gần nhất        |
| `created_at` / `updated_at` | `TIMESTAMPTZ`  | NOT NULL, default now()         | Trigger cập nhật `updated_at` |

Ràng buộc `CHECK (email IS NOT NULL OR phone IS NOT NULL)` đảm bảo có ít nhất
một kênh liên hệ.

**Bảng `roles`** — `id`, `code` (UNIQUE, vd `citizen`), `name`, `description`, `created_at`.

**Bảng `permissions`** — `id`, `code` (UNIQUE, vd `case.approve`), `name`, `module`, `description`, `created_at`.

**Bảng `user_roles`** — `(user_id, role_id)` PK kép, khóa ngoại `ON DELETE CASCADE`, `assigned_at`.

**Bảng `role_permissions`** — `(role_id, permission_id)` PK kép, khóa ngoại `ON DELETE CASCADE`.

### 3.2 Cụm đơn vị hành chính (GIS)

**Bảng `quan_huyen`**

| Cột          | Kiểu dữ liệu                   | Ràng buộc        | Ghi chú                  |
| ------------ | ------------------------------ | ---------------- | ------------------------ |
| `id`         | `UUID`                         | PK               |                          |
| `ma`         | `VARCHAR(20)`                  | UNIQUE, NOT NULL | Mã đơn vị hành chính     |
| `ten`        | `VARCHAR(200)`                 | NOT NULL         | Tên quận/huyện           |
| `boundary`   | `GEOMETRY(MultiPolygon, 4326)` |                  | Ranh giới, có GIST index |
| `created_at` | `TIMESTAMPTZ`                  | NOT NULL         |                          |

**Bảng `phuong_xa`** tương tự, thêm cột `quan_huyen_id` (FK → `quan_huyen`,
`ON DELETE CASCADE`). Cả hai bảng có `GIST` index trên cột `boundary` để phục vụ
các truy vấn không gian như "tìm phường/xã chứa điểm vi phạm".

### 3.3 Cụm danh mục pháp lý (Điều 16 NĐ16/2022)

**Bảng `loai_vi_pham`** — phân loại cấp 1 thành 4 nhóm:
`N_AT_CT` (an toàn, vệ sinh công trường), `N_GPXD` (thủ tục giấy phép),
`N_CLQH` (chất lượng, quy hoạch, lấn chiếm), `N_TAIPHAM` (cố tình, tái phạm).
Cột: `id`, `code` (UNIQUE), `ten`, `mo_ta`, `so_thu_tu`, `created_at`.

**Bảng `hanh_vi_vi_pham`**

| Cột               | Kiểu           | Ràng buộc                | Ghi chú            |
| ----------------- | -------------- | ------------------------ | ------------------ |
| `id`              | `UUID`         | PK                       |                    |
| `loai_vi_pham_id` | `UUID`         | FK → `loai_vi_pham`      |                    |
| `dieu`            | `VARCHAR(10)`  | NOT NULL, default `'16'` |                    |
| `khoan`           | `VARCHAR(10)`  | NOT NULL                 | Khoản 1..13        |
| `diem`            | `VARCHAR(10)`  |                          | Điểm a/b/c nếu có  |
| `ten`             | `VARCHAR(500)` | NOT NULL                 | Mô tả ngắn hành vi |
| `mo_ta`           | `TEXT`         |                          | Mô tả đầy đủ       |
| `is_active`       | `BOOLEAN`      | NOT NULL, default TRUE   |                    |
| `created_at`      | `TIMESTAMPTZ`  |                          |                    |

Ràng buộc `UNIQUE (dieu, khoan, diem)` chống trùng hành vi. Seed dữ liệu theo
đúng Điều 16 gồm 12 hành vi (khoản 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13; khoản
11 thuộc phạm vi xử lý của pháp luật đất đai, khoản 14–17 là quy định bổ trợ
không phải hành vi).

**Bảng `muc_phat`** — khung mức phạt theo **nhóm công trình**:

| Cột               | Kiểu          | Ràng buộc                       | Ghi chú      |
| ----------------- | ------------- | ------------------------------- | ------------ |
| `id`              | `UUID`        | PK                              |              |
| `hanh_vi_id`      | `UUID`        | FK → `hanh_vi_vi_pham`, CASCADE |              |
| `nhom_cong_trinh` | `INT`         | CHECK IN (1,2,3)                | Nhóm 1/2/3   |
| `muc_toi_thieu`   | `BIGINT`      | CHECK ≥ 0                       | Đơn vị: đồng |
| `muc_toi_da`      | `BIGINT`      | CHECK ≥ `muc_toi_thieu`         |              |
| `created_at`      | `TIMESTAMPTZ` |                                 |              |

`UNIQUE (hanh_vi_id, nhom_cong_trinh)`. **Quy tắc nghiệp vụ quan trọng**: giá trị
lưu trong `muc_phat` là mức phạt dành cho **tổ chức**; khi chủ thể là **cá nhân**,
mức phạt = **1/2** mức phạt tổ chức (điểm c khoản 3, khoản 5 Điều 4 NĐ16/2022).
Mức phạt cá nhân không lưu cố định mà **tính tự động tại tầng nghiệp vụ** khi
biết `loai_chu_the` của `nguoi_vi_pham` để tránh sai lệch dữ liệu.

### 3.4 Cụm hồ sơ xử lý

**Bảng `bao_cao_vi_pham`** — báo cáo do người dân gửi:
`id`, `ma_bao_cao` (UNIQUE), `nguoi_gui_id` (FK → `users`, có thể NULL khi gửi
ẩn danh), `nguoi_gui_ten`, `nguoi_gui_sdt`, `nguoi_gui_email`, `mo_ta` (NOT NULL),
`dia_chi`, `quan_huyen_id`, `phuong_xa_id`, `toa_do GEOMETRY(Point,4326)`,
`thoi_gian_xay_ra`, `created_at`.

**Bảng `ho_so`** — bảng trung tâm. Kiểu enum `trang_thai_ho_so` định nghĩa vòng
đời hồ sơ (xem mục 5). Cột chính: `id`, `ma_ho_so` (UNIQUE), `bao_cao_id` (FK),
`loai_vi_pham_id`, `hanh_vi_id` (điền sau khi xác minh), `nguoi_nop_id` (cán bộ
thụ lý), `trang_thai`, `nguoi_vi_pham_id`, `dia_chi`, `quan_huyen_id`,
`phuong_xa_id`, `toa_do` (GIST index), `thoi_gian_xay_ra`, `mo_ta`,
`muc_phat_du_kien` (BIGINT ≥ 0), `dang_thi_cong` (BOOLEAN, liên quan Điều 81),
`han_hop_phap_hoa` (DATE, hạn hoàn thiện hồ sơ xin cấp phép 30/90 ngày),
`ghi_chu`, `created_at`, `updated_at`, `deleted_at` (gạch mềm phục vụ lưu trữ).

**Bảng `nguoi_vi_pham`** — `id`, `loai_chu_the` (CHECK `ca_nhan`/`to_chuc`),
`ten` (NOT NULL), `cmnd_cccd` (CMND/CCCD hoặc MST), `dia_chi`, `sdt`, `email`,
`nguoi_dai_dien` (cho tổ chức), `created_at`.

**Bảng `bien_ban`** — `id`, `ma_bien_ban` (UNIQUE), `ho_so_id` (FK, CASCADE),
`nguoi_lap_id` (FK → users), `nguoi_vi_pham_id`, `hanh_vi_id`, `thoi_gian_lap`,
`noi_dung`, `hinh_thuc_xu_phat` (default `phat_tien`), `muc_phat_du_kien`,
`trang_thai` (CHECK: `moi_lap`/`cho_phe_duyet`/`da_ban_hanh`/`da_huy`),
`created_at`, `updated_at`.

**Bảng `quyet_dinh`** — `id`, `ma_quyet_dinh` (UNIQUE), `bien_ban_id`,
`ho_so_id` (FK, CASCADE), `nguoi_ky_id` (FK → users), `so_tien_phat` (BIGINT ≥ 0,
mức phạt thực tế), `can_cu_phap_ly` (trích dẫn điều/khoản), `hinh_thuc_phat_bo_sung`
(tước GPXD, tịch thu tang vật...), `bien_phap_khac_phuc_hau_qua` (buộc che chắn,
phá dỡ, điều chỉnh GPXD...), `ngay_ban_hanh` (DATE), `trang_thai` (CHECK:
`draft`/`da_ban_hanh`/`da_giao`/`da_thi_hanh`/`da_huy`), `created_at`, `updated_at`.

**Bảng `khac_phuc`** — `id`, `ho_so_id` (FK, CASCADE), `quyet_dinh_id` (FK,
SET NULL), `bien_phap` (NOT NULL, nội dung biện pháp khắc phục), `mo_ta`,
`han_thuc_hien` (DATE, hạn thực hiện), `trang_thai` (CHECK:
`chua_thuc_hien`/`dang_thuc_hien`/`da_thuc_hien`/`qua_han`/`cuong_che`/`da_kiem_tra`),
`nguoi_theo_doi_id`, `ngay_hoan_thanh`, `created_at`, `updated_at`.

### 3.5 Cụm giao tiếp & lưu trữ

**Bảng `thong_bao`** — `id`, `nguoi_nhan_id` (FK → users, CASCADE), `ho_so_id`
(FK, SET NULL), `loai` (`bao_cao`/`xac_minh`/`bien_ban`/`quyet_dinh`/`khac_phuc`),
`tieu_de`, `noi_dung`, `kenh` (CHECK: `portal`/`email`/`sms`), `trang_thai`
(CHECK: `cho_gui`/`da_gui`/`that_bai`/`da_doc`), `ngay_gui`, `created_at`. Bảng
này đáp ứng UC-05 và FR-05 (gửi thông báo xử phạt cho người vi phạm).

**Bảng `tep_dinh_kem`** — thiết kế **đa hình**: mỗi tệp thuộc về một thực thể bất
kỳ qua cặp `(entity_type, entity_id)`. Cột: `id`, `entity_type` (vd
`bao_cao`/`ho_so`/`bien_ban`/`quyet_dinh`/`khac_phuc`), `entity_id` (UUID),
`ten_goc`, `duong_dan` (đường dẫn/object key, vd MinIO), `loai_file` (MIME),
`kich_thuoc` (BIGINT ≥ 0), `nguoi_tai_id`, `created_at`. Có index
`(entity_type, entity_id)` để truy vấn nhanh tệp của một hồ sơ. Đáp ứng yêu cầu
gửi/lưu/xem ảnh hoạt động vi phạm.

### 3.6 Cụm kiểm toán

**Bảng `audit_log`** — `id` (BIGSERIAL PK), `nguoi_dung_id` (FK → users, SET
NULL), `hanh_dong`, `bang_bi_tac_dong` (tên bảng), `id_ban_ghi` (UUID),
`chi_tiet` (JSONB, lưu before/after), `ip` (VARCHAR(45)), `thoi_gian`. Có index
theo `(bang_bi_tac_dong, id_ban_ghi)`, theo `thoi_gian` và theo `nguoi_dung_id`.
Đáp ứng NFR-04 (audit log, traceability) — mọi thao tác quan trọng được ghi lại
kèm dấu thời gian, người dùng, hành động.

---

## 4. Quan hệ giữa các bảng

Mô tả các mối quan hệ chính (bên cạnh sơ đồ text ở mục 1):

- **RBAC**: `users` N:N `roles` qua `user_roles`; `roles` N:N `permissions` qua
  `role_permissions`. Người dùng có nhiều vai trò, một vai trò có nhiều quyền —
  đủ để triển khai nguyên tắc **ít quyền nhất** (least privilege) theo NFR-01.
- **Hành chính**: `quan_huyen` 1:N `phuong_xa`. Một phường/xã thuộc đúng một
  quận/huyện; xóa quận/huyện sẽ xóa các phường/xã con (CASCADE).
- **Danh mục pháp lý**: `loai_vi_pham` 1:N `hanh_vi_vi_pham` (một nhóm nhiều
  hành vi); `hanh_vi_vi_pham` 1:N `muc_phat` (một hành vi có 1–3 khung mức phạt
  theo nhóm công trình).
- **Luồng hồ sơ**: `bao_cao_vi_pham` 1:0..1 `ho_so` (một báo cáo có thể tạo một
  hồ sơ; hồ sơ cũng có thể được tạo thủ công ngoài báo cáo). `ho_so` 1:N
  `bien_ban`, `ho_so` 1:N `quyet_dinh`, `ho_so` 1:N `khac_phuc`, `ho_so` N:1
  `nguoi_vi_pham`. Một biên bản sinh ra tối đa một quyết định xử phạt
  (`quyet_dinh.bien_ban_id`), và một quyết định có nhiều biện pháp khắc phục
  (`khac_phuc.quyet_dinh_id`).
- **Phụ trợ**: `thong_bao` tham chiếu `users` (người nhận) và `ho_so`;
  `tep_dinh_kem` đa hình trỏ tới bất kỳ thực thể nào qua `(entity_type, entity_id)`;
  `audit_log` tương tự nhưng theo dõi mọi bảng quan trọng.

Ràng buộc toàn vẹn tham chiếu được khai báo đầy đủ bằng FOREIGN KEY kèm hành vi
`ON DELETE` phù hợp (CASCADE cho quan hệ phụ thuộc chặt, SET NULL / RESTRICT cho
quan hệ tham chiếu) để tránh dữ liệu mồ côi.

---

## 5. Lược đồ trạng thái hồ sơ (state machine)

Bảng `ho_so` dùng enum `trang_thai_ho_so` để quản lý vòng đời một vụ việc, khớp
với quy trình nghiệp vụ: _tiếp nhận → xác minh → lập biên bản → ra quyết định →
theo dõi khắc phục → đóng hồ sơ_ (mục 9, tài liệu đặc tả).

```
             (người dân gửi)             (cán bộ tiếp nhận)
 bao_cao_vi_pham ─────────────────► cho_tiep_nhan ──────────► cho_xac_minh
                                        │                        │ (thiếu thông tin)
                                        │                        ▼
                                        │                   cho_bo_sung ──┐
                                        │                        ▲        │ (bổ sung đủ)
                                        │                        └────────┘
                                        │                        ▼
                                        │                   dang_xac_minh
                                        │                        │
                                        │          ┌─────────────┴─────────────┐
                                        │   (đủ cơ sở)                  (không đủ / ngoài thẩm quyền)
                                        │          ▼                              ▼
                                        │   cho_lap_bien_ban                    da_huy
                                        │          ▼
                                        │   da_lap_bien_ban ──► cho_ra_quyet_dinh ──► da_ra_quyet_dinh
                                        │          │                                  │
                                        │          │            (công trình đang thi công)
                                        │          │                                  ▼
                                        │          │                            cho_duyet_dieu_81
                                        │          │                                  │
                                        │          ▼                                  ▼
                                        │          └──────────────► dang_khac_phuc ──► da_khac_phuc ──► da_dong
                                        │                                                  ▲
                                        │                                                  │ (không đạt, quay lại)
                                        └──────────────────────────────────────────────────┘
```

**Mô tả các trạng thái:**

| Trạng thái          | Ý nghĩa                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `cho_tiep_nhan`     | Báo cáo mới gửi, chờ cán bộ tiếp nhận (mặc định khi tạo hồ sơ)        |
| `cho_xac_minh`      | Đã tiếp nhận, xếp hàng chờ xác minh                                   |
| `dang_xac_minh`     | Cán bộ xác minh, phân loại hành vi                                    |
| `cho_bo_sung`       | Thiếu thông tin, yêu cầu bổ sung (quay lại xác minh khi đủ)           |
| `cho_lap_bien_ban`  | Xác minh có căn cứ, đủ điều kiện lập biên bản                         |
| `da_lap_bien_ban`   | Đã lập biên bản vi phạm                                               |
| `cho_ra_quyet_dinh` | Chờ ban hành quyết định xử phạt                                       |
| `da_ra_quyet_dinh`  | Đã ban hành quyết định xử phạt                                        |
| `cho_duyet_dieu_81` | Công trình đang thi công, xử lý theo quy trình Điều 81 (hợp pháp hóa) |
| `dang_khac_phuc`    | Theo dõi thực hiện biện pháp khắc phục hậu quả                        |
| `da_khac_phuc`      | Đã khắc phục xong, chờ kiểm tra lại                                   |
| `da_dong`           | Đóng hồ sơ (hoàn tất) — trạng thái cuối                               |
| `da_huy`            | Hủy (không đủ cơ sở, ngoài thẩm quyền, thuộc pháp luật đất đai...)    |

Các trạng thái `da_dong` và `da_huy` là **trạng thái cuối** (không chuyển tiếp ra
ngoài). Trong lược đồ hiện tại, việc **kiểm soát chuyển tiếp hợp lệ** được thực
hiện ở tầng ứng dụng kết hợp ràng buộc `CHECK`; nếu cần bảo đảm nghiêm ngặt hơn,
có thể bổ sung **trigger kiểm tra chuyển tiếp trạng thái** (được đề xuất tại mục 7)
để chặn các bước nhảy không hợp lệ ngay tại cơ sở dữ liệu.

---

## 6. Chỉ mục và tối ưu truy vấn GIS

### 6.1 Chỉ mục không gian (PostGIS)

Cột `toa_do` dùng kiểu `GEOMETRY(Point, 4326)` với **GIST index** để phục vụ truy
vấn "tìm vi phạm trong phạm vi bán kính quanh một điểm" hoặc "liệt kê vi phạm
trong một phường/xã":

```sql
CREATE INDEX idx_ho_so_toa_do ON ho_so USING GIST (toa_do);
```

Các cột `boundary` của `quan_huyen`/`phuong_xa` cũng có GIST index. Mẫu truy vấn
thực dụng:

```sql
-- Tìm phường/xã chứa một điểm vi phạm
SELECT px.ten
FROM phuong_xa px
WHERE ST_Contains(px.boundary, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326));

-- Liệt kê hồ sơ vi phạm trong bán kính 1 km quanh một điểm
SELECT id, ma_ho_so
FROM ho_so
WHERE toa_do IS NOT NULL
  AND ST_DWithin(toa_do, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 1000);

-- Đếm vi phạm theo quận/huyện (dùng cho báo cáo thống kê)
SELECT qh.ten, COUNT(h.id)
FROM ho_so h JOIN quan_huyen qh ON ST_Contains(qh.boundary, h.toa_do)
GROUP BY qh.ten;
```

### 6.2 Các chỉ mục B-tree thông thường

- `ho_so`: `trang_thai` (lọc theo trạng thái), `nguoi_nop_id`, `quan_huyen_id`,
  `phuong_xa_id`, `created_at` (phục vụ thống kê theo thời gian).
- `phuong_xa`: `quan_huyen_id`.
- `tep_dinh_kem`: `(entity_type, entity_id)` — truy vấn tệp theo thực thể.
- `audit_log`: `(bang_bi_tac_dong, id_ban_ghi)`, `thoi_gian`, `nguoi_dung_id`.

### 6.3 Khuyến nghị tối ưu

1. **Phân vùng (partitioning)** bảng `ho_so` theo `created_at` khi dữ liệu tăng
   lớn (triệu hồ sơ) để tăng tốc truy vấn theo thời gian và dễ dọn dữ liệu cũ.
2. **Bảng `audit_log`** nên chuyển sang bảng riêng (hoặc tách schema `audit`) và
   cấu hình **lưu trữ dữ liệu không thay đổi (append-only)** — không cho UPDATE/
   DELETE để bảo đảm tính bất biến của log theo NFR-04.
3. Chuẩn hóa SRID **4326** (WGS84) cho dữ liệu bản đồ; nếu cần tính toán diện
   tích chính xác hãy chuyển đổi tạm sang SRID 3857 hoặc UTM phù hợp bằng
   `ST_Transform`.
4. Cân nhắc **lọc không gian trước khi nối (JOIN)** — PostGIS ưu tiên dùng GIST
   index qua `ST_DWithin` thay vì so sánh trực tiếp.

---

## 7. Ràng buộc toàn vẹn, trigger, audit logging

### 7.1 Ràng buộc toàn vẹn

- **PRIMARY KEY** trên mọi bảng (`id UUID` / `BIGSERIAL` cho `audit_log`).
- **FOREIGN KEY** với `ON DELETE` phù hợp: `CASCADE` cho quan hệ phụ thuộc chặt
  (`user_roles`, `role_permissions`, `phuong_xa`, `muc_phat`, `bien_ban`,
  `quyet_dinh`, `khac_phuc`), `SET NULL` / `RESTRICT` cho quan hệ tham chiếu
  (`nguoi_dung_id`, `quyet_dinh_id` trong `khac_phuc`).
- **UNIQUE** trên các mã nghiệp vụ: `username`, `email`, `phone` (users);
  `ma` (đơn vị hành chính); `code` (roles, permissions, loại vi phạm);
  `(dieu, khoan, diem)` (hành vi); `(hanh_vi_id, nhom_cong_trinh)` (mức phạt);
  `ma_bao_cao`, `ma_ho_so`, `ma_bien_ban`, `ma_quyet_dinh`.
- **CHECK** cho dữ liệu có tập giá trị hữu hạn: `nhom_cong_trinh IN (1,2,3)`,
  `muc_toi_da >= muc_toi_thieu`, `loai_chu_the IN ('ca_nhan','to_chuc')`, `kenh`,
  `trang_thai` của các bảng, `email OR phone` của `users`.

### 7.2 Trigger

- **`set_updated_at()`**: hàm PL/pgSQL + trigger `BEFORE UPDATE` trên `users`,
  `ho_so`, `bien_ban`, `quyet_dinh`, `khac_phuc` để tự cập nhật `updated_at`.
- **Đề xuất bổ sung** (chưa khai báo trong schema ban đầu, dành cho tầng chặt
  hơn): trigger **kiểm tra chuyển tiếp trạng thái hồ sơ** — viết hàm
  `check_ho_so_transition()` đối chiếu cặp `OLD.trang_thai → NEW.trang_thai` với
  danh sách chuyển tiếp hợp lệ, `RAISE EXCEPTION` nếu không hợp lệ. Điều này
  biến state machine ở mục 5 thành quy tắc bắt buộc tại CSDL.

### 7.3 Audit logging

Ngoài bảng `audit_log` (ghi thủ công từ tầng ứng dụng), có thể bổ sung **trigger
audit tự động**: hàm `audit_trigger()` đọc `TG_TABLE_NAME`, `TG_OP`, ghi
`OLD`/`NEW` vào `audit_log.chi_tiet` (JSONB). Để tránh đệ quy, chỉ gắn trigger
audit lên các bảng nghiệp vụ (không gắn lên `audit_log`). Khuyến nghị: giữ log
append-only, không cho phép sửa/xóa, và định kỳ xuất/sao lưu để phục vụ thanh
tra, kiểm toán theo yêu cầu pháp lý (NFR-04, mục 6 tài liệu đặc tả).

---

## 8. Ghi chú triển khai

1. Chạy script bằng lệnh `psql -U <user> -d <db> -f sql/schema.sql`. Script bọc
   trong transaction (`BEGIN`/`COMMIT`), có lệnh `DROP ... IF EXISTS ... CASCADE`
   đầu file để chạy lại được; **cẩn trọng khi chạy trên môi trường có dữ liệu thật**.
2. Cần cài sẵn extension `postgis` và `citext` (khai báo bằng
   `CREATE EXTENSION IF NOT EXISTS`).
3. Seed dữ liệu `loai_vi_pham`, `hanh_vi_vi_pham`, `muc_phat` theo Điều 16
   Nghị định 16/2022/NĐ-CP cùng các vai trò/quyền cơ bản đã được nhúng trong
   schema. Mức phạt cá nhân = 1/2 tổ chức do tầng nghiệp vụ tính tự động.
4. Dữ liệu GIS mẫu (ranh giới quận/huyện, phường/xã) cần được nhập từ nguồn bản
   đồ chính thức của địa phương; schema chỉ định nghĩa cấu trúc và chỉ mục.
