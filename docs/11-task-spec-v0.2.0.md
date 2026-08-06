# TASK SPECIFICATION — GÓI NÂNG CẤP QLTTXD v0.2.0

> Theo MASTER PROMPT – AI TEAM LEADER (skill `master-prompt-ai-team-leader`)
> Bám sát: `docs/10-ke-hoach-nang-cap-v0.2.0.md` (Single Source of Truth)
> Mỗi task: đủ 16 trường theo TASK SPECIFICATION. Agent KHÔNG tự suy diễn; mơ hồ → block + báo cptr.

---

## T-01 — Migration 002 + 8 CRUD endpoints địa điểm + tests

| Trường           | Giá trị                                                |
| ---------------- | ------------------------------------------------------ |
| Task ID          | T-01                                                   |
| Requirement ID   | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-14 |
| Specification ID | SPEC-DB-001, SPEC-API-001, SPEC-TEST-001               |
| Owner            | coder (backend)                                        |
| Priority         | P0                                                     |
| Difficulty       | Cao                                                    |
| Dependency       | —                                                      |
| Estimated Time   | 1 ngày                                                 |

**Description:** Triển khai tầng database + API cho Quản lý địa điểm:

1. Migration `sql/migrations/002_admin_locations.up.sql`: thêm permission `('admin.locations','Quản lý địa điểm (đơn vị hành chính)','admin')` ON CONFLICT DO NOTHING; gán role admin (`role_permissions` WHERE r.code='admin' AND p.code='admin.locations'); ghi `schema_migrations`. Down: gỡ role_permissions → permissions → schema_migrations.
2. Cập nhật `sql/schema.sql`: thêm dòng permission `admin.locations` (cho DB reset mới).
3. Sửa `sql/verify-db.sql` L51: `seeded_demo_users=5` → `count(*)=0`; thêm kiểm tra tồn tại `admin.locations` + admin có quyền.
4. Trong `server.js` thêm 8 endpoints (sau `authenticateWithBlocklist` + `authorize('admin.locations')`):
   - GET `/api/v1/admin/quan-huyen` (list kèm số phường + boundary ST_AsGeoJSON)
   - POST `/api/v1/admin/quan-huyen` {ma, ten, boundary}
   - PATCH `/api/v1/admin/quan-huyen/:id`
   - DELETE `/api/v1/admin/quan-huyen/:id` (guard 409)
   - GET `/api/v1/admin/phuong-xa?quan_huyen_id=`
   - POST `/api/v1/admin/phuong-xa` {ma, ten, quan_huyen_id, boundary}
   - PATCH `/api/v1/admin/phuong-xa/:id`
   - DELETE `/api/v1/admin/phuong-xa/:id` (guard 409)
5. Validation: ma `^[0-9A-Za-z-]{1,20}$` bắt buộc + unique (409 trùng); ten ≤200 bắt buộc; boundary GeoJSON → `ST_GeomFromGeoJSON` → check `ST_IsValid`, `GeometryType='MULTIPOLYGON'`, `ST_SRID=4326` (400 lỗi cụ thể); quan_huyen_id tồn tại (404).
6. Guard xóa: pre-check phường con / bao_cao_vi_pham / ho_so → 409 kèm số lượng; bắt ngoại lệ 23503 → 409.
7. Audit mọi POST/PATCH/DELETE: `audit(client, req, 'create'|'update'|'delete', 'quan_huyen'|'phuong_xa', id, {ma,ten})`.
8. Giữ nguyên GET công khai `/api/v1/danh-muc/*`.
9. Test `test/admin-locations.test.js`: 401 không token; 403 leader/citizen; 200 CRUD; 409 trùng ma; 400 boundary sai; 409 xóa có ràng buộc; audit_log có bản ghi.

**Input:** `docs/10-ke-hoach-nang-cap-v0.2.0.md`, `sql/schema.sql`, `sql/seed.sql`, `sql/verify-db.sql`, `app/backend/server.js`, pattern migration 001.

**Output:** migration 002 up/down; schema.sql/verify-db.sql cập nhật; server.js + 8 endpoints; test/admin-locations.test.js; báo cáo files changed + evidence.

**Checklist:**

- [ ] Migration 002 up chạy sạch trên DB đang chạy (không lỗi, idempotent)
- [ ] Down chạy sạch
- [ ] schema.sql có dòng admin.locations
- [ ] verify-db.sql sửa L51 + kiểm tra mới
- [ ] 8 endpoints có đủ auth + authorize
- [ ] Validation đầy đủ (ma/ten/boundary/quan_huyen_id)
- [ ] Guard 409 đủ 3 kiểu (phường con/hồ sơ/báo cáo)
- [ ] Audit đủ
- [ ] GET công khai danh-muc không vỡ

**Acceptance Criteria:** migration up/down idempotent; `admin.locations` chỉ admin; CRUD hoạt động; 409 guard; 403 cho leader/citizen; verify-db pass; test mới PASS + 46 cũ PASS.

**Review Checklist:** theo mục 12 của kế hoạch (đặc biệt: naming, validate, guard, permission, audit, không phá danh-muc công khai).

**Testing Checklist:** theo mục 13 của kế hoạch (unit + integration + regression 46 test cũ).

**Done Definition:** code xong → self-test pass → review độc lập (T-08 sau cùng) → evidence đầy đủ.

---

## T-02 — AdminLocationsPage + menu + preview polygon

| Trường           | Giá trị                        |
| ---------------- | ------------------------------ |
| Task ID          | T-02                           |
| Requirement ID   | REQ-01, REQ-02, REQ-03, REQ-05 |
| Specification ID | SPEC-UI-001                    |
| Owner            | coder (frontend)               |
| Priority         | P0                             |
| Difficulty       | Trung bình                     |
| Dependency       | T-01                           |
| Estimated Time   | 1 ngày                         |

**Description:** Trong `app/frontend/src/main.jsx`:

1. Trang `AdminLocationsPage`: 2 panel — trái danh sách quận (tên, mã, số phường, nút Sửa/Xóa); phải danh sách phường của quận đang chọn (hoặc tất cả khi chưa chọn).
2. Nút "Thêm quận"/"Thêm phường" mở modal (mẫu `AdminUsersPage`): trường ma, ten (+ select quan_huyen_id cho phường), textarea GeoJSON boundary, **preview polygon** trên bản đồ (mở rộng `MapView` với prop polygons dùng `L.geoJSON`, hoặc component `BoundaryPreview` mới).
3. Xóa có confirm; hiển thị lỗi 409/400 từ backend rõ ràng (toast/notice).
4. Menu: nút "📍 Địa điểm" trong nhóm "Quản trị" — chỉ render khi `can(user,'admin.locations')`.
5. Routing: case `route.page === 'admin-locations'` trong `<main>`.
6. Trạng thái: loading (spinner), empty ("Chưa có quận/phường"), error (lỗi API), permission (ẩn menu khi không có quyền).
7. Responsive: 2 panel xếp dọc trên mobile, ngang trên desktop.

**Input:** SPEC-UI-001 (trong kế hoạch mục 8), `main.jsx` hiện tại, `MapView` hiện có.

**Output:** `main.jsx` cập nhật; báo cáo files changed + evidence (build PASS).

**Checklist:**

- [ ] 2 panel layout đúng
- [ ] Modal tạo/sửa đủ trường + validate client
- [ ] Preview polygon render được
- [ ] Xóa confirm + hiển thị 409/400
- [ ] Menu chỉ hiện khi có permission
- [ ] Loading/empty/error state đủ
- [ ] Responsive

**Acceptance Criteria:** trang hoạt động CRUD qua API T-01; preview polygon hiển thị; menu chỉ admin; build PASS.

**Review Checklist:** UI/UX khớp SPEC-UI-001; naming; accessibility (label, focus); responsive.

**Testing Checklist:** UI render; polygon preview; modal; menu ẩn/hiện; build.

**Done Definition:** build PASS; self-test browser (nếu môi trường cho phép) hoặc API smoke qua proxy; review độc lập.

---

## T-03 — E2E smoke địa điểm + verify-db + build

| Trường           | Giá trị                                  |
| ---------------- | ---------------------------------------- |
| Task ID          | T-03                                     |
| Requirement ID   | REQ-01..06, REQ-14                       |
| Specification ID | SPEC-API-001, SPEC-UI-001, SPEC-TEST-001 |
| Owner            | qa                                       |
| Priority         | P0                                       |
| Difficulty       | Trung bình                               |
| Dependency       | T-01, T-02                               |
| Estimated Time   | 0.5 ngày                                 |

**Description:** Chạy E2E smoke toàn luồng: admin login → GET list → POST tạo quận/phường mới → PATCH sửa → DELETE phường không ràng buộc → 409 khi xóa quận còn phường; leader/citizen bị 403; verify-db.sql chạy pass; frontend build PASS; hồi quy 46 test backend cũ PASS.

**Input:** T-01, T-02 outputs; DB đang chạy (PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd).

**Output:** báo cáo E2E + evidence (API responses, test logs, build log).

**Checklist:**

- [ ] E2E smoke CRUD đầy đủ
- [ ] 403 cho leader/citizen
- [ ] verify-db pass
- [ ] build frontend PASS
- [ ] 46 test cũ PASS

**Acceptance Criteria:** mọi bước E2E PASS; verify-db PASS; build PASS; regression PASS.

**Review Checklist:** evidence đầy đủ; không phá tính năng cũ.

**Testing Checklist:** E2E + regression.

**Done Definition:** mọi evidence PASS; báo cáo QA rõ ràng.

---

## T-04 — Hardening: rate limit + helmet + upload MIME + dọn mồ côi

| Trường           | Giá trị                                   |
| ---------------- | ----------------------------------------- |
| Task ID          | T-04                                      |
| Requirement ID   | REQ-07, REQ-08, REQ-09, REQ-10            |
| Specification ID | SPEC-API-002, SPEC-API-003, SPEC-TEST-002 |
| Owner            | coder (backend)                           |
| Priority         | P1                                        |
| Difficulty       | Cao                                       |
| Dependency       | T-01                                      |
| Estimated Time   | 1 ngày                                    |

**Description:** Trong `server.js` (+ package.json):

1. Rate limit (`express-rate-limit`): login 10 req/15ph/IP; auth endpoints; upload 429 kèm Retry-After; cấu hình qua env.
2. Helmet: thay header thủ công bằng `helmet()`; CSP đảm bảo `img-src` cho phép tile OSM (Leaflet vẫn chạy).
3. Upload MIME magic-byte (file-type): whitelist jpeg/png/gif/webp; từ chối file giả .jpg (nội dung không phải ảnh); giới hạn kích thước.
4. Script dọn tệp mồ côi: rà `uploads/` không có trong `tep_dinh_kem` → xóa (hoặc báo cáo tùy flag).
5. Health mở rộng: `/health` + DB ping + uptime.
6. Tests: 429 sau vượt ngưỡng; upload file giả bị chặn; header CSP/HSTS có mặt.

**Input:** SPEC-API-002/003, `server.js`, `package.json`, `uploads/`.

**Output:** server.js + package.json cập nhật; script dọn mồ côi; tests; evidence.

**Checklist:**

- [ ] Rate limit hoạt động (429)
- [ ] Helmet không phá map
- [ ] Upload MIME chặn file giả
- [ ] Script dọn mồ côi an toàn
- [ ] /health có DB ping
- [ ] Test pass

**Acceptance Criteria:** các hành vi bảo mật đúng; bản đồ vẫn hoạt động; test PASS.

**Review Checklist:** security review; không phá upload hợp lệ.

**Testing Checklist:** unit + integration + security test.

**Done Definition:** test PASS; review security.

---

## T-05 — Báo cáo CSV/PDF + che PII

| Trường           | Giá trị                     |
| ---------------- | --------------------------- |
| Task ID          | T-05                        |
| Requirement ID   | REQ-12, REQ-13              |
| Specification ID | SPEC-API-004, SPEC-TEST-002 |
| Owner            | coder (backend)             |
| Priority         | P1                          |
| Difficulty       | Cao                         |
| Dependency       | T-01                        |
| Estimated Time   | 1 ngày                      |

**Description:** Trong `server.js`:

1. `GET /api/v1/thong-ke/xuat?loai=csv|pdf&tu_ngay&den_ngay&quan_huyen_id` — authorize `report.statistics`.
2. CSV: header + dữ liệu (theo trạng thái/quận/tháng), escape đúng, BOM UTF-8.
3. PDF: pdfkit + font Unicode nhúng (Noto Sans) render bảng đơn giản tiếng Việt.
4. Che PII: SĐT/email/CMND của người gửi + người vi phạm — che theo quyền (chỉ đủ khi `case.view` hoặc role cao); áp dụng cả xuất lẫn API detail.
5. Phân trang/batch cho dữ liệu lớn; thời gian < 2s quy mô vừa (NFR-02).
6. Tests: CSV đúng header/BOM; PDF sinh file; PII che đúng quyền; 403 không quyền.

**Input:** SPEC-API-004, `server.js`, `docs/03-dac-ta-nghiep-vu.md` (NFR/FR báo cáo).

**Output:** server.js cập nhật; tests; evidence.

**Checklist:**

- [ ] CSV đúng định dạng
- [ ] PDF tiếng Việt đúng font
- [ ] PII che đúng quyền
- [ ] Phân trang/batch
- [ ] Test pass

**Acceptance Criteria:** xuất CSV/PDF hoạt động; PII che đúng; test PASS.

**Review Checklist:** security (PII), performance (<2s), định dạng file.

**Testing Checklist:** unit + integration + performance.

**Done Definition:** test PASS; review.

---

## T-06 — Trang Báo cáo + nút xuất

| Trường           | Giá trị          |
| ---------------- | ---------------- |
| Task ID          | T-06             |
| Requirement ID   | REQ-12, REQ-13   |
| Specification ID | SPEC-UI-002      |
| Owner            | coder (frontend) |
| Priority         | P1               |
| Difficulty       | Trung bình       |
| Dependency       | T-05             |
| Estimated Time   | 0.5 ngày         |

**Description:** Trong `main.jsx`:

1. Trang "Báo cáo" (leader/admin — có `report.statistics`): chọn khoảng thời gian, quận, loại CSV/PDF, nút tải (download file).
2. Nút xuất trên Dashboard (cùng quyền).
3. Hiển thị dữ liệu đã che PII.
4. Loading/empty/error state.

**Input:** SPEC-UI-002, `main.jsx`, T-05 API.

**Output:** `main.jsx` cập nhật; build PASS.

**Checklist:**

- [ ] Trang Báo cáo đủ filter + nút xuất
- [ ] Tải file CSV/PDF thành công
- [ ] PII che hiển thị
- [ ] Menu đúng quyền
- [ ] Build PASS

**Acceptance Criteria:** xuất qua UI hoạt động; build PASS.

**Review Checklist:** UI/UX; accessibility; download file.

**Testing Checklist:** UI + build.

**Done Definition:** build PASS; smoke qua proxy.

---

## T-07 — Hồi quy toàn bộ + E2E hardening/báo cáo

| Trường           | Giá trị                     |
| ---------------- | --------------------------- |
| Task ID          | T-07                        |
| Requirement ID   | REQ-07..13                  |
| Specification ID | SPEC-API-00x, SPEC-TEST-002 |
| Owner            | qa                          |
| Priority         | P1                          |
| Difficulty       | Trung bình                  |
| Dependency       | T-04, T-05, T-06            |
| Estimated Time   | 0.5 ngày                    |

**Description:** Hồi quy toàn bộ: 46 test cũ + ~20 test mới PASS; build frontend PASS; E2E hardening (429, upload giả bị chặn) + báo cáo (CSV/PDF/PII) PASS; verify-db pass; kiểm tra bản đồ vẫn hoạt động sau helmet.

**Input:** T-04..T-06 outputs.

**Output:** báo cáo QA tổng hợp + evidence.

**Checklist:** theo mục 13 kế hoạch.

**Acceptance Criteria:** toàn bộ PASS; không regression.

**Done Definition:** evidence PASS.

---

## T-08 — Review bảo mật độc lập

| Trường           | Giá trị    |
| ---------------- | ---------- |
| Task ID          | T-08       |
| Requirement ID   | REQ-01..15 |
| Specification ID | Tất cả     |
| Owner            | security   |
| Priority         | P1         |
| Difficulty       | Cao        |
| Dependency       | T-01..T-07 |
| Estimated Time   | 0.5 ngày   |

**Description:** Review độc lập toàn gói: RBAC (admin.locations đúng), SQL injection (boundary/param), upload (MIME, path traversal), secret (không lộ), rate limit, helmet, audit, PII, CORS/CSP. Trả findings kèm mức độ; chặn release nếu có HIGH.

**Input:** toàn bộ diff T-01..T-07.

**Output:** báo cáo security review (findings + mức độ + khuyến nghị).

**Checklist:** theo REVIEW CHECKLIST + mục 12 kế hoạch.

**Acceptance Criteria:** không finding HIGH; findings MEDIUM/LOW có kế hoạch xử lý (fix trong task này hoặc ghi risk).

**Done Definition:** báo cáo + chấp thuận (hoặc fix xong).

---

## T-09 — Deploy nâng cấp + docs + release v0.2.0

| Trường           | Giá trị         |
| ---------------- | --------------- |
| Task ID          | T-09            |
| Requirement ID   | REQ-15          |
| Specification ID | SPEC-DEPLOY-001 |
| Owner            | deployment      |
| Priority         | P0              |
| Difficulty       | Trung bình      |
| Dependency       | T-08            |
| Estimated Time   | 1 ngày          |

**Description:** Trên hệ thống đang chạy:

1. `scripts/backup.sh` → backup DB + uploads (giữ bản).
2. Chạy migration 002 (test trên bản sao trước nếu có thể).
3. Deploy bản mới (backend + frontend build) → health check `/health`.
4. Hồi quy nhanh (smoke chính) — downtime < 30 phút.
5. Cập nhật `README.md` (API mới + tính năng) + report v0.2.0 (criteria, files changed, evidence, risks, reviewer approval).
6. Git commit + tag v0.2.0; tree sạch.

**Input:** T-08 chấp thuận; stack đang chạy.

**Output:** hệ thống nâng cấp xong; README + report; commit + tag.

**Checklist:**

- [ ] Backup thành công
- [ ] Migration OK
- [ ] Deploy OK + health OK
- [ ] Hồi quy smoke OK
- [ ] Docs + report đủ
- [ ] Commit + tag v0.2.0

**Acceptance Criteria:** hệ thống chạy bản mới; docs/report đầy đủ; git sạch.

**Done Definition:** release xong; bàn giao.

---

## MA TRẬN ĐỐI CHIẾU TASK ↔ KẾ HOẠCH (Bước 7 — Requirement Traceability)

| Requirement          | T-01 | T-02 | T-03 | T-04 | T-05 | T-06 | T-07 | T-08 | T-09 |
| -------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| REQ-01 CRUD quận     | ✅   | ✅   | ✅   |      |      |      |      | ✅   |      |
| REQ-02 CRUD phường   | ✅   | ✅   | ✅   |      |      |      |      | ✅   |      |
| REQ-03 Boundary      | ✅   | ✅   | ✅   |      |      |      |      | ✅   |      |
| REQ-04 Guard 409     | ✅   |      | ✅   |      |      |      |      | ✅   |      |
| REQ-05 Permission    | ✅   | ✅   | ✅   |      |      |      |      | ✅   |      |
| REQ-06 Audit         | ✅   |      | ✅   |      |      |      |      | ✅   |      |
| REQ-07 Rate limit    |      |      |      | ✅   |      |      | ✅   | ✅   |      |
| REQ-08 Headers       |      |      |      | ✅   |      |      | ✅   | ✅   |      |
| REQ-09 Upload MIME   |      |      |      | ✅   |      |      | ✅   | ✅   |      |
| REQ-10 Dọn mồ côi    |      |      |      | ✅   |      |      | ✅   | ✅   |      |
| REQ-11 Health/secret |      |      |      | ✅   |      |      | ✅   | ✅   |      |
| REQ-12 CSV/PDF       |      |      |      |      | ✅   | ✅   | ✅   | ✅   |      |
| REQ-13 Che PII       |      |      |      |      | ✅   | ✅   | ✅   | ✅   |      |
| REQ-14 verify-db     | ✅   |      | ✅   |      |      |      | ✅   | ✅   |      |
| REQ-15 Docs/release  |      |      |      |      |      |      |      | ✅   | ✅   |

**Kết luận đối chiếu:** Mọi REQ-01..15 đều có task phụ trách; không bỏ sót. Mỗi task có đủ 16 trường; dependency rõ; review/test đầy đủ.
