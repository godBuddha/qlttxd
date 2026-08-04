# SPEC REFACTOR-001: Tách server.js thành modules

> Task: coder | Priority: P1 | Dependency: PHASE3A (done)

## Mục tiêu
Tách server.js (1518 dòng) thành modules có cấu trúc. Mỗi route/middleware/logic trong file riêng. server.js chỉ setup + mount.

## Cấu trúc mới
```
app/backend/
  routes/
    auth.js          (login, logout, setup-admin, forgot-password, reset-password, change-password)
    bao-cao.js       (CRUD reports, to-ho-so)
    ho-so.js         (CRUD cases, state transitions, bien-ban, quyet-dinh, khac-phuc, ban-hanh)
    thong-ke.js      (statistics, export CSV/PDF)
    admin/
      users.js       (CRUD users)
      roles.js       (roles + permissions)
      audit-log.js   (audit log listing)
      locations.js   (quan-huyen, phuong-xa CRUD)
      catalog.js     (loai-vi-pham, hanh-vi, muc-phat CRUD)
    ban-do.js        (global map)
    thong-bao.js     (notifications)
    danh-muc.js      (public catalogs)
  middleware/
    auth.js          (makeAuthenticate, authorize)
    upload.js        (multer config)
    rate-limit.js    (rate limiters)
  lib/
    audit.js         (audit function)
    business-code.js (nextCode, BUSINESS_CODE_SEQUENCES)
    geo.js           (coordinate, pointSelect, parseBoundary)
    notification.js  (createThongBao)
  server.js          (< 150 dòng: setup + mount routes)
```

## Quy tắc
- KHÔNG thay đổi API behavior (endpoint paths, request/response format)
- KHÔNG thay đổi middleware order
- Mỗi file export function nhận `pool` + `authenticateWithBlocklist` làm params
- server.js: buildApp() gọi mỗi route module với pool
- Test: 132/132 phải pass SAU refactor

## Acceptance Criteria
- server.js < 150 dòng
- Mỗi route file < 150 dòng
- Test suite 132/132 PASS
- Không thay đổi API behavior
- Không thay đổi middleware order
