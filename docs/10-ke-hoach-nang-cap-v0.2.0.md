# KẾ HOẠCH NÂNG CẤP QLTTXD v0.2.0 — GÓI MỞ RỘNG 3 PHASE

> Soạn theo MASTER PROMPT – AI TEAM LEADER (skill `master-prompt-ai-team-leader`)
> Trạng thái: KẾ HOẠCH ĐÃ DUYỆT — sẵn sàng phân rã task và giao agent
> Ngày: 2026-08-03

---

## 1. PHÂN TÍCH YÊU CẦU

**Yêu cầu khách:** Bổ sung tính năng cho phép **admin** thêm/xóa/sửa **địa điểm** (đơn vị hành chính), chỉ tài khoản admin có chức năng này, ghi trực tiếp vào database, triển khai **đồng bộ toàn hệ thống** (DB → API → Frontend → Tests → Docs).

**Quyết định đã chốt với khách:**

| #   | Quyết định         | Giá trị                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------- |
| Q1  | Phạm vi "địa điểm" | Đơn vị hành chính: `quan_huyen` + `phuong_xa`                                                     |
| Q2  | Ranh giới          | Có — admin nhập/cập nhật boundary GeoJSON (MultiPolygon, SRID 4326), có validate + preview bản đồ |
| Q3  | Phân quyền         | Permission **mới** `admin.locations`, gán riêng cho role `admin`                                  |
| Q4  | Hành vi xóa        | **Chặn xóa (409)** nếu địa điểm đang được phường con / hồ sơ / báo cáo tham chiếu                 |
| Q5  | Phạm vi gói        | **Cả gói mở rộng 3 phase**: Phase A Địa điểm → Phase B Hardening → Phase C Báo cáo                |
| Q6  | Kịch bản bàn giao  | **Nâng cấp hệ thống đang chạy** (backup → migration → deploy → hồi quy)                           |

**Hiện trạng hệ thống (đối chiếu mã nguồn):**

- DB 19 bảng + PostGIS; `quan_huyen` (6 quận seed), `phuong_xa` (12 phường seed), boundary MultiPolygon 4326.
- FK: `phuong_xa.quan_huyen_id` CASCADE; `bao_cao_vi_pham`/`ho_so` → `quan_huyen_id`/`phuong_xa_id` NO ACTION.
- RBAC: `permissions` + `role_permissions`; middleware `authorize(...)`; admin được seed gán toàn bộ permissions; permissions nạp động vào JWT lúc login.
- API: chỉ GET công khai `/api/v1/danh-muc/quan-huyen`, `/phuong-xa`. **Không có CRUD admin.**
- Frontend: SPA 1 file `main.jsx`; `AdminUsersPage`/`AdminRolesPage` là mẫu; `MapView` chỉ vẽ điểm.
- Security: CSP header thủ công; chưa có rate limit/helmet/MIME magic-byte/dọn tệp mồ côi.
- Báo cáo: chỉ dashboard thống kê; chưa xuất CSV/PDF.
- Bug kèm: `verify-db.sql` dòng 51 kiểm tra `seeded_demo_users = 5` — LỖI THỜI (users demo đã xóa) → sẽ fail.
- Backend test 46/46 PASS; git v0.1.0 + v0.1.1, tree sạch.

---

## 2. CÁC ĐIỂM CHƯA RÕ (đã làm rõ)

| Điểm                     | Trạng thái                    |
| ------------------------ | ----------------------------- |
| Tên permission           | ✅ `admin.locations`          |
| Hành vi xóa có ràng buộc | ✅ Chặn 409                   |
| Phạm vi đợt              | ✅ Cả 3 phase                 |
| Nơi lưu tài liệu         | ✅ `qlttxd/docs/` (thuộc ssd) |

Không còn điểm chưa rõ. Nếu agent gặp mơ hồ trong khi triển khai → **block task, không tự suy diễn**, báo cptr để hỏi khách.

---

## 3. CÂU HỎI ĐÃ HỎI VÀ TRẢ LỜI (lịch sử)

1. Phạm vi địa điểm? → Đơn vị hành chính (quan_huyen + phuong_xa).
2. Nhập ranh giới? → Có, GeoJSON MultiPolygon + preview.
3. Cơ chế phân quyền? → Permission mới, gán riêng admin.
4. Tên permission? → `admin.locations`.
5. Hành vi xóa? → Chặn 409 khi có ràng buộc.
6. Phạm vi gói? → Cả 3 phase.
7. Kịch bản bàn giao? → Nâng cấp hệ thống đang chạy.

---

## 4. PHẠM VI CÔNG VIỆC

### Nằm trong phạm vi

- Phase A: Quản lý địa điểm (migration 002 + 8 CRUD API + trang admin + tests).
- Phase B: Hardening (rate limit, helmet, upload MIME magic-byte, dọn tệp mồ côi, quản lý secret/health).
- Phase C: Báo cáo CSV/PDF + che dữ liệu cá nhân + trang báo cáo.
- Sửa `verify-db.sql` lỗi thời; cập nhật docs/README; release v0.2.0; commit git.
- Nâng cấp an toàn trên hệ thống đang chạy: backup → migration → deploy → hồi quy → nghiệm thu.

### Nằm NGOÀI phạm vi (KHÔNG làm)

- Không đổi kiến trúc tổng thể (vẫn Express + React + PostGIS).
- Không thay seed ranh giới bằng nguồn chính thức (chỉ ghi chú cảnh báo; việc nhập dữ liệu chuẩn thuộc nghiệp vụ khách).
- Không xây chữ ký số/PDF mẫu biên bản chính thức, không tích hợp tile server tự host (ghi TODO).
- Không thay đổi luồng nghiệp vụ 13 trạng thái, không thêm role mới.

---

## 5. KIẾN TRÚC ĐỀ XUẤT

```
Frontend (main.jsx)                    Backend (server.js)                    PostgreSQL
┌─────────────────────────┐   REST    ┌──────────────────────────┐   SQL    ┌──────────────────────┐
│ AdminLocationsPage      │ ────────▶ │ /api/v1/admin/quan-huyen │ ───────▶ │ quan_huyen          │
│  • 2 panel quận/phường  │  JSON    │ /api/v1/admin/phuong-xa  │  (param) │ phuong_xa           │
│  • Modal tạo/sửa        │          │ authorize('admin.locations')         │ permissions(+mới)   │
│  • Preview polygon      │ ◀─────── │ validate + guard 409 + audit         │ role_permissions    │
│  • Xóa có xác nhận      │  JSON    │                          │ ◀─────── │ audit_log           │
└─────────────────────────┘          │ Rate limit + helmet (B)  │          └──────────────────────┘
   Menu "Địa điểm" chỉ     │          │ Upload MIME + dọn mồ côi(B)│
   khi can('admin.locations')         │ Xuất CSV/PDF + che PII(C)│
                                      └──────────────────────────┘
```

- **Single Source of Truth**: tài liệu này + spec từng thành phần; agent chỉ bám tài liệu, không tự suy diễn.
- **Naming**: tuân theo convention hiện có (`admin.users`, `admin.audit` → `admin.locations`; route `/api/v1/admin/...`).
- **Pattern**: theo `authorize()` + `audit()` + transaction có sẵn trong server.js.
- **Migration**: theo pattern `001_atomic_business_codes` (up/down + `schema_migrations`).

---

## 6. DANH SÁCH MODULE

| ID  | Module                             | Lớp            | Phase |
| --- | ---------------------------------- | -------------- | ----- |
| M1  | Quản lý địa điểm                   | DB + API + UI  | A     |
| M2  | Migration 002 + verify-db fix      | DB             | A     |
| M3  | Rate limiting                      | Backend        | B     |
| M4  | Security headers (helmet)          | Backend        | B     |
| M5  | Upload an toàn (MIME + dọn mồ côi) | Backend        | B     |
| M6  | Secret/health/giám sát             | Backend/Deploy | B     |
| M7  | Báo cáo CSV/PDF                    | Backend + UI   | C     |
| M8  | Che dữ liệu cá nhân                | Backend        | C     |
| M9  | Docs + Release v0.2.0              | Docs/Deploy    | A+B+C |

---

## 7. DANH SÁCH REQUIREMENT

| ID     | Requirement                      | Module | Acceptance tóm tắt                               |
| ------ | -------------------------------- | ------ | ------------------------------------------------ |
| REQ-01 | Admin CRUD quận/huyện            | M1     | Thêm/sửa/xóa quận, ghi thẳng DB, chỉ admin       |
| REQ-02 | Admin CRUD phường/xã             | M1     | Thêm/sửa/xóa phường (gắn quận), chỉ admin        |
| REQ-03 | Nhập/cập nhật boundary GeoJSON   | M1     | MultiPolygon 4326 hợp lệ, preview được           |
| REQ-04 | Chặn xóa khi có ràng buộc        | M1     | Xóa quận còn phường/hồ sơ → 409                  |
| REQ-05 | Permission admin.locations       | M1/M2  | Chỉ role admin có; leader/citizen 403            |
| REQ-06 | Audit mọi thay đổi địa điểm      | M1     | Ghi audit_log đủ                                 |
| REQ-07 | Rate limit auth/upload           | M3     | Vượt ngưỡng → 429                                |
| REQ-08 | Security headers chuẩn           | M4     | CSP/HSTS/nosniff/... qua helmet; bản đồ vẫn chạy |
| REQ-09 | Upload kiểm tra nội dung thật    | M5     | File giả .jpg bị từ chối (magic-byte)            |
| REQ-10 | Dọn tệp mồ côi                   | M5     | Script rà uploads/ không có trong DB             |
| REQ-11 | Health mở rộng + secret an toàn  | M6     | /health có DB ping; secret không lộ              |
| REQ-12 | Xuất báo cáo CSV/PDF             | M7     | Theo trạng thái/quận/tháng, đúng định dạng       |
| REQ-13 | Che dữ liệu cá nhân khi xuất/xem | M8     | SĐT/email/CMND che theo quyền                    |
| REQ-14 | Sửa verify-db lỗi thời           | M2     | Chạy pass, kiểm tra admin.locations              |
| REQ-15 | Docs + Release v0.2.0            | M9     | README, report nghiệm thu, commit+tag            |

---

## 8. DANH SÁCH SPECIFICATION CẦN XÂY DỰNG

| ID              | Spec                                                   | Áp dụng cho |
| --------------- | ------------------------------------------------------ | ----------- |
| SPEC-DB-001     | Migration 002 + thay đổi schema.sql/verify-db.sql      | DB          |
| SPEC-API-001    | 8 endpoints CRUD địa điểm (chi tiết từng API)          | Backend     |
| SPEC-API-002    | Rate limit + helmet cấu hình                           | Backend     |
| SPEC-API-003    | Upload MIME + script dọn mồ côi                        | Backend     |
| SPEC-API-004    | Báo cáo CSV/PDF + che PII                              | Backend     |
| SPEC-UI-001     | AdminLocationsPage (2 panel + modal + preview polygon) | Frontend    |
| SPEC-UI-002     | Trang Báo cáo + nút xuất                               | Frontend    |
| SPEC-TEST-001   | Test backend admin-locations                           | Tests       |
| SPEC-TEST-002   | Test hardening + báo cáo                               | Tests       |
| SPEC-DEPLOY-001 | Backup → migration → deploy → hồi quy → release v0.2.0 | Deploy      |

> Mỗi spec được viết đầy đủ theo chuẩn FRONTEND/BACKEND/API/DATABASE SPECIFICATION của MASTER PROMPT (mục chi tiết trong tài liệu spec con, đặt tại `qlttxd/docs/specs/`).

---

## 9. PHÂN RÃ TASK

| Task ID | Requirement ID | Spec ID                                   | Owner            | Priority | Difficulty | Dependency       | Ước lượng | Mô tả                                                                                                                      |
| ------- | -------------- | ----------------------------------------- | ---------------- | -------- | ---------- | ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| T-01    | REQ-01..06,14  | SPEC-DB-001, SPEC-API-001, SPEC-TEST-001  | coder (backend)  | P0       | Cao        | —                | 1 ngày    | Migration 002 (permission admin.locations + gán admin) + 8 CRUD endpoints + guard 409 + audit + sửa verify-db + unit tests |
| T-02    | REQ-01..06     | SPEC-UI-001                               | coder (frontend) | P0       | Trung bình | T-01             | 1 ngày    | AdminLocationsPage (2 panel, modal, preview polygon, xóa confirm) + menu theo permission                                   |
| T-03    | REQ-01..06,14  | SPEC-API-001, SPEC-UI-001, SPEC-TEST-001  | qa               | P0       | Trung bình | T-01, T-02       | 0.5 ngày  | E2E smoke CRUD địa điểm + verify-db + build frontend + hồi quy 46 test cũ                                                  |
| T-04    | REQ-07..10     | SPEC-API-002, SPEC-API-003, SPEC-TEST-002 | coder (backend)  | P1       | Cao        | T-01             | 1 ngày    | Rate limit + helmet + upload MIME magic-byte + script dọn mồ côi + tests                                                   |
| T-05    | REQ-12,13      | SPEC-API-004, SPEC-TEST-002               | coder (backend)  | P1       | Cao        | T-01             | 1 ngày    | Báo cáo CSV/PDF + che PII + tests                                                                                          |
| T-06    | REQ-12,13      | SPEC-UI-002                               | coder (frontend) | P1       | Trung bình | T-05             | 0.5 ngày  | Trang Báo cáo + nút xuất + hiển thị dữ liệu che                                                                            |
| T-07    | REQ-07..13     | SPEC-API-00x, SPEC-TEST-002               | qa               | P1       | Trung bình | T-04, T-05, T-06 | 0.5 ngày  | Hồi quy toàn bộ + E2E hardening/báo cáo                                                                                    |
| T-08    | REQ-01..15     | Tất cả                                    | security         | P1       | Cao        | T-01..T-07       | 0.5 ngày  | Review bảo mật độc lập: RBAC, injection, upload, secret, rate limit                                                        |
| T-09    | REQ-15         | SPEC-DEPLOY-001                           | deployment       | P0       | Trung bình | T-08             | 1 ngày    | Backup → migration → deploy → hồi quy → docs v0.2.0 → commit + tag                                                         |

---

## 10. DEPENDENCY GIỮA CÁC TASK

```
T-01 ──▶ T-02 ──▶ T-03 ──▶ T-08 ──▶ T-09
  └──────▶ T-04 ──▶ T-07 ──▶ T-08
  └──────▶ T-05 ──▶ T-06 ──▶ T-07
```

- T-01 là nền (migration + API) — không thể thiếu.
- T-02, T-04, T-05 chạy sau T-01 (có thể song song, nhưng **không cùng ghi workspace chính** — mỗi agent dùng workspace riêng).
- T-03 sau T-01+T-02; T-07 sau T-04+T-05+T-06; T-08 sau tất cả; T-09 cuối cùng.

---

## 11. RỦI RO

| ID      | Rủi ro                              | Mức        | Giảm thiểu                                                              |
| ------- | ----------------------------------- | ---------- | ----------------------------------------------------------------------- |
| RISK-01 | Xóa quận cascade xóa phường bất ngờ | Cao        | Guard pre-check 409 + FK NO ACTION làm lớp bảo vệ cuối (bắt 23503)      |
| RISK-02 | Boundary sai → dò quận/phường sai   | Cao        | Validate ST_IsValid + MultiPolygon + SRID 4326; preview map; test point |
| RISK-03 | Helmet phá bản đồ (CSP tile OSM)    | Trung bình | Cấu hình img-src cho tile; test browser thực tế                         |
| RISK-04 | Rate limit chặn nhầm user thật      | Trung bình | Ngưỡng hợp lý + whitelist IP nội bộ qua env                             |
| RISK-05 | Upload magic-byte bỏ sót            | Trung bình | Whitelist 4 loại (jpeg/png/gif/webp); test file giả                     |
| RISK-06 | PDF tiếng Việt lỗi font             | Trung bình | Font Unicode nhúng (Noto Sans); test trước                              |
| RISK-07 | Migration trên DB thật lỗi          | Cao        | Backup trước; migration idempotent; test trên bản sao trước             |
| RISK-08 | Xung đột workspace agent            | Trung bình | Task tuần tự từng phase; workspace riêng cho agent                      |
| RISK-09 | Lộ dữ liệu cá nhân khi xuất         | Cao        | Che PII theo quyền; test từng vai trò                                   |

---

## 12. CHECKLIST REVIEW

Mỗi task khi review phải kiểm tra: Requirement, Specification, Architecture, Naming, Folder, Code Style, Performance, Security, Accessibility, Responsive, UI, UX, API, Database, Error Handling, Logging, Testing, Documentation, Consistency, Regression.

Riêng gói này bổ sung:

- [ ] API CRUD địa điểm khớp SPEC-API-001 (method/path/status/validation/error code).
- [ ] Guard 409 đúng (quận còn phường / hồ sơ / báo cáo).
- [ ] Permission `admin.locations` chỉ admin; leader/citizen 403.
- [ ] Boundary validate đầy đủ (isValid, MultiPolygon, 4326).
- [ ] Audit đủ mọi thay đổi.
- [ ] Rate limit không chặn nhầm; helmet không phá map.
- [ ] Upload MIME từ chối file giả; script dọn mồ côi an toàn.
- [ ] CSV/PDF đúng định dạng; PII che đúng quyền.
- [ ] verify-db pass; 46 test cũ + test mới pass.

---

## 13. CHECKLIST TESTING

- [ ] Unit test: validation ma/ten/boundary; guard 409; permission 401/403/200.
- [ ] Integration test: CRUD roundtrip qua API + audit_log.
- [ ] E2E: admin tạo→sửa→xóa địa điểm; leader/citizen bị chặn.
- [ ] UI test: preview polygon render; modal; xóa confirm.
- [ ] Visual test: 2 panel layout; responsive (mobile/tablet/desktop).
- [ ] Regression: 46 test backend cũ PASS; build frontend PASS.
- [ ] Performance: CRUD < 2s; báo cáo quy mô vừa < 2s (NFR-02).
- [ ] Security: rate limit 429; upload giả bị chặn; secret không lộ; scan cơ bản.
- [ ] Accessibility: form có label; modal focus trap; bàn phím điều hướng.

---

## 14. ĐIỀU KIỆN HOÀN THÀNH (DEFINITION OF DONE)

1. Migration 002 up/down idempotent; `admin.locations` chỉ admin; verify-db pass.
2. 8 CRUD API + 3 nhóm hardening + 2 nhóm báo cáo hoạt động đúng spec.
3. Frontend: trang Địa điểm + Báo cáo hoạt động; menu đúng quyền; preview polygon.
4. 46 test cũ + ~20 test mới PASS; build frontend PASS; E2E full-flow PASS.
5. Security review (T-08) PASS — không còn finding HIGH.
6. Deploy trên hệ thống đang chạy: backup OK → migration OK → deploy OK → hồi quy OK → downtime < 30 phút.
7. Docs: README API mới + report v0.2.0 (criteria, files changed, evidence, risks, reviewer approval).
8. Git: commit + tag v0.2.0, tree sạch.
9. Mọi Requirement REQ-01..15 truy vết đủ: Requirement → Spec → Task → Impl → Test → Review → Release.

---

## QUY TẮC CHO AGENT (bắt buộc đọc trước khi làm)

1. **Chỉ bám tài liệu này + spec con.** Không tự suy diễn, không thêm chức năng, không sáng tạo ngoài phạm vi.
2. **Mỗi task phải đối chiếu**: Requirement ID ↔ Spec ID ↔ file đụng chạm ↔ acceptance criteria.
3. **Không sửa file ngoài phạm vi task**; không đụng code module khác (trừ khi task yêu cầu).
4. **Ghi rõ files changed + evidence (test output, build log, API response)** trong báo cáo.
5. **Gặp mơ hồ → block task, báo cptr**, không tự đoán.
6. **Không tự commit git** trừ task T-09.
7. **Tuân thủ full-stack gate**: self-test → review độc lập → fixes → regression → security/accessibility check → verified → complete → docs.
8. **Workspace**: mỗi agent dùng workspace riêng (`dir:/workspace/ssd/qlttxd/...`), không ghi đè file của agent khác đang chạy song song.

---

## PHỤ LỤC A — BẢN MÔ TẢ CHI TIẾT TỪNG THÀNH PHẦN (đối chiếu hiện trạng → thay đổi)

| Thành phần          | Hiện trạng (file)                          | Thay đổi (task)                                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `quan_huyen`        | schema.sql L147-153; 6 quận seed           | + CRUD qua API; guard xóa (T-01)                                    |
| `phuong_xa`         | schema.sql L156-163; 12 phường seed        | + CRUD qua API; guard xóa (T-01)                                    |
| `permissions`       | schema.sql L533-546 (13 quyền)             | + `admin.locations` (T-01)                                          |
| `role_permissions`  | seed.sql L52-81                            | + gán admin.locations cho admin (T-01)                              |
| `schema_migrations` | migrations/001_*                           | + 002_admin_locations (T-01)                                        |
| `server.js`         | 457 dòng, buildApp(), authorize(), audit() | + 8 CRUD + rate limit + helmet + upload MIME + báo cáo (T-01,04,05) |
| `main.jsx`          | 263 dòng, AdminUsersPage/RolesPage         | + AdminLocationsPage + trang Báo cáo + menu (T-02,06)               |
| `verify-db.sql`     | L51 seeded_demo_users=5 (SAI)              | Sửa thành 0 + kiểm tra admin.locations (T-01)                       |
| Test backend        | test/*.js 46 test                          | + admin-locations.test.js + hardening/báo cáo tests (T-01,04,05)    |
| `README.md`         | Bảng API hiện có                           | + API mới + mô tả tính năng (T-09)                                  |
| Git                 | v0.1.0 + v0.1.1                            | + v0.2.0 (T-09)                                                     |
